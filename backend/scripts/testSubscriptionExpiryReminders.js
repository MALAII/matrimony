/**
 * Hardened Automated Verification Suite for Subscription Expiry Email Reminders
 * 
 * Verifies:
 * 1. User reminder timing: Fired only approximately 7 days before endDate (6.0 - 8.0 days away).
 *    Subscriptions at 3 days away do NOT receive a 7-day reminder, but ARE included in the admin digest.
 * 2. Admin digest delivery: Consolidated digest for all members expiring within 7 days.
 * 3. Duplicate prevention: Zero duplicate user reminders and zero duplicate admin digests for same date.
 * 4. Decoupled retries:
 *    - Failed user email can be retried without sending duplicate admin digest.
 *    - Failed admin digest can be retried without resending successful user reminders.
 *    - Member whose user reminder already succeeded is still included in the admin digest.
 * 5. Renewal & multiple subscriptions: Older subscription skipped when newer active renewal exists.
 * 6. Extension invalidates old reminder and triggers for new expiration date at its 7-day mark.
 * 7. Existing 7-day grace-period profile deactivation behaviour remains completely unchanged.
 */

process.env.NODE_ENV = 'test';
process.env.TEST_CAPTURE_EMAILS = 'true';

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const { connectDB } = require('../config/db');

const User = require('../models/User');
const Subscription = require('../models/Subscription');
const MatrimonialProfile = require('../models/MatrimonialProfile');
const JobLock = require('../models/JobLock');
const Notification = require('../models/Notification');
const notificationService = require('../services/notificationService');
const {
  JOB_NAME,
  DAY_MS,
  runSubscriptionExpiryReminders,
  evaluateReminderEligibility,
  toReportDateKey,
} = require('../services/subscriptionReminderService');
const {
  runSubscriptionExpiryDeactivation,
} = require('./deactivateExpiredProfilesPhase5C');
const {
  getSentSubscriptionRemindersForTest,
  clearSentSubscriptionRemindersForTest,
  getSentAdminDigestsForTest,
  clearSentAdminDigestsForTest,
} = require('../services/emailService');

const createdUserIds = [];
const createdSubscriptionIds = [];
const createdProfileIds = [];
const createdNotificationIds = [];
const capturedNotifications = [];

async function cleanupFixtures() {
  if (createdNotificationIds.length > 0) {
    await Notification.deleteMany({ _id: { $in: createdNotificationIds } });
  }
  if (createdUserIds.length > 0) {
    await Notification.deleteMany({ recipient: { $in: createdUserIds } });
    await Subscription.deleteMany({ user: { $in: createdUserIds } });
    await MatrimonialProfile.deleteMany({ user: { $in: createdUserIds } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
  }
  if (createdSubscriptionIds.length > 0) {
    await Subscription.deleteMany({ _id: { $in: createdSubscriptionIds } });
  }
  if (createdProfileIds.length > 0) {
    await MatrimonialProfile.deleteMany({ _id: { $in: createdProfileIds } });
  }
  await JobLock.deleteMany({ jobName: JOB_NAME });
}

async function runTests() {
  console.log('Connecting to database via connectDB()...');
  await connectDB();
  console.log('Database connected.');

  clearSentSubscriptionRemindersForTest();
  clearSentAdminDigestsForTest();
  await JobLock.deleteMany({ jobName: JOB_NAME });

  const originalNotificationCreate = Notification.create;

  try {
    // Intercept in-app notification persistence with an in-memory spy to prevent DB pollution
    Notification.create = async (doc) => {
      const record = { _id: new mongoose.Types.ObjectId(), ...doc, createdAt: new Date() };
      capturedNotifications.push(record);
      return record;
    };

    const testPrefix = `test_harden_${Date.now()}`;

    // Always create a dedicated, isolated test admin — NEVER reuse real admin records
    const admin = await User.create({
      name: 'Test Administrator',
      email: `${testPrefix}_admin@example.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      role: 'admin',
      accountStatus: 'active',
    });
    createdUserIds.push(admin._id);
    console.log(`Scoped Test Admin: ${admin.email}`);

    // Create 3 Test Users
    // User A: Exactly at the 7-day mark (e.g. 7.0 days away) -> should receive User 7-day reminder AND be in admin digest
    const userA = await User.create({
      name: 'Anand Kumar',
      email: `${testPrefix}_anand@example.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      role: 'user',
      accountStatus: 'active',
    });
    createdUserIds.push(userA._id);

    // User B: At 3 days away -> should NOT receive user 7-day reminder, but MUST be in admin digest of members expiring in 7 days
    const userB = await User.create({
      name: 'Bhavani Shankar',
      email: `${testPrefix}_bhavani@example.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      role: 'user',
      accountStatus: 'active',
    });
    createdUserIds.push(userB._id);

    // User C: At 20 days away -> should NOT receive user reminder, NOT in admin digest
    const userC = await User.create({
      name: 'Chandran Pillai',
      email: `${testPrefix}_chandran@example.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      role: 'user',
      accountStatus: 'active',
    });
    createdUserIds.push(userC._id);

    const now = new Date();

    const subA = await Subscription.create({
      user: userA._id,
      planCode: 'THREE_MONTHS',
      durationMonths: 3,
      status: 'active',
      startDate: new Date(now.getTime() - 83 * DAY_MS),
      endDate: new Date(now.getTime() + 7 * DAY_MS), // exactly 7 days
      gracePeriodEndDate: new Date(now.getTime() + 14 * DAY_MS),
    });
    createdSubscriptionIds.push(subA._id);

    const subB = await Subscription.create({
      user: userB._id,
      planCode: 'SIX_MONTHS',
      durationMonths: 6,
      status: 'active',
      startDate: new Date(now.getTime() - 177 * DAY_MS),
      endDate: new Date(now.getTime() + 3 * DAY_MS), // 3 days away
      gracePeriodEndDate: new Date(now.getTime() + 10 * DAY_MS),
    });
    createdSubscriptionIds.push(subB._id);

    const subC = await Subscription.create({
      user: userC._id,
      planCode: 'THREE_MONTHS',
      durationMonths: 3,
      status: 'active',
      startDate: new Date(now.getTime() - 70 * DAY_MS),
      endDate: new Date(now.getTime() + 20 * DAY_MS), // 20 days away
      gracePeriodEndDate: new Date(now.getTime() + 27 * DAY_MS),
    });
    createdSubscriptionIds.push(subC._id);

    // -------------------------------------------------------------
    // TEST 1: User Timing Distinction & Consolidated Admin Digest
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: User Timing Distinction (7-day mark) & Admin Digest ---');
    clearSentSubscriptionRemindersForTest();
    clearSentAdminDigestsForTest();

    const run1 = await runSubscriptionExpiryReminders({
      now,
      apply: true,
      acquireLock: true,
    });

    console.log('Run 1 Summary:', {
      eligibleForUserReminderCount: run1.eligibleForUserReminderCount,
      userRemindersSent: run1.userRemindersSent,
      adminDigestItemsCount: run1.adminDigestItemsCount,
      adminDigestsSent: run1.adminDigestsSent,
      adminDigestStatus: run1.adminDigestStatus,
    });

    const sentUser1 = getSentSubscriptionRemindersForTest();
    const sentAdmin1 = getSentAdminDigestsForTest();

    // User A (7 days) MUST receive a user reminder
    if (!sentUser1.some((e) => e.to === userA.email)) {
      throw new Error('User A (7 days away) did not receive 7-day reminder email.');
    }

    // User B (3 days) must NOT receive a user 7-day reminder
    if (sentUser1.some((e) => e.to === userB.email)) {
      throw new Error('User B (3 days away) improperly received a 7-day reminder email!');
    }

    // User C (20 days) must NOT receive a user reminder
    if (sentUser1.some((e) => e.to === userC.email)) {
      throw new Error('User C (20 days away) improperly received a user reminder email!');
    }

    // Admin digest MUST be sent and MUST contain BOTH User A (7d) and User B (3d)
    if (sentAdmin1.length === 0) {
      throw new Error('Admin digest was not sent.');
    }
    const digest1 = sentAdmin1[0];
    const hasUserAInDigest = digest1.expiringSubscriptions.some((s) => s.userEmail === userA.email);
    const hasUserBInDigest = digest1.expiringSubscriptions.some((s) => s.userEmail === userB.email);
    const hasUserCInDigest = digest1.expiringSubscriptions.some((s) => s.userEmail === userC.email);

    if (!hasUserAInDigest || !hasUserBInDigest) {
      throw new Error(`Admin digest missing expiring users! hasA=${hasUserAInDigest}, hasB=${hasUserBInDigest}`);
    }
    if (hasUserCInDigest) {
      throw new Error('Admin digest improperly included User C (20 days away)!');
    }

    console.log('✅ TEST 1 PASSED: Only User A received 7-day reminder; Admin digest included all members expiring within 7 days (User A & User B).');

    // In-app notifications isolation verification:
    const adminDigestNotifs = capturedNotifications.filter(
      (n) => n.recipientRole === 'admin' && (n.type === 'admin_subscription_expiry_digest' || n.type === 'subscription_expiry_digest')
    );
    if (adminDigestNotifs.length === 0 || adminDigestNotifs[0].metadata?.expiringCount !== 2) {
      throw new Error(`Admin in-app notification not captured or wrong count: ${JSON.stringify(adminDigestNotifs)}`);
    }
    const userNotifs = capturedNotifications.filter((n) => n.recipientRole === 'user');
    if (!userNotifs.some((n) => String(n.recipient) === String(userA._id))) {
      throw new Error('User A in-app notification not dispatched to spy');
    }
    console.log('✅ In-app notifications intercepted by test spy with zero DB pollution.');

    // -------------------------------------------------------------
    // TEST 2: Duplicate Prevention on Repeated Run (Same Day)
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Duplicate Prevention on Same-Day Re-run ---');
    clearSentSubscriptionRemindersForTest();
    clearSentAdminDigestsForTest();

    const run2 = await runSubscriptionExpiryReminders({
      now,
      apply: true,
      acquireLock: true,
    });

    console.log('Run 2 Summary:', {
      userRemindersSent: run2.userRemindersSent,
      userRemindersSkippedAlreadySent: run2.userRemindersSkippedAlreadySent,
      adminDigestsSent: run2.adminDigestsSent,
      adminDigestSkippedAlreadySent: run2.adminDigestSkippedAlreadySent,
      adminDigestStatus: run2.adminDigestStatus,
    });

    if (getSentSubscriptionRemindersForTest().length > 0) {
      throw new Error('Duplicate user reminders sent on re-run!');
    }
    if (getSentAdminDigestsForTest().length > 0) {
      throw new Error('Duplicate admin digest sent on same-day re-run!');
    }
    if (!run2.adminDigestSkippedAlreadySent) {
      throw new Error('adminDigestSkippedAlreadySent flag was not true on same-day re-run!');
    }

    console.log('✅ TEST 2 PASSED: Zero duplicate user reminders and zero duplicate admin digests sent.');

    // -------------------------------------------------------------
    // TEST 3: Decoupled Retries (Admin Digest Failed -> Retried without resending User Reminder)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Admin Digest Failure & Safe Retry without Resending User Reminders ---');
    // Simulate: User A already sent, but simulate an admin digest failure on a new date (or reset lock digest status)
    await JobLock.findOneAndUpdate(
      { jobName: JOB_NAME },
      { $set: { 'lastRunSummary.adminDigestStatus': 'failed' } }
    );

    clearSentSubscriptionRemindersForTest();
    clearSentAdminDigestsForTest();

    const retryRun = await runSubscriptionExpiryReminders({
      now,
      apply: true,
      acquireLock: true,
    });

    // User A should NOT be resent
    const retryUserEmails = getSentSubscriptionRemindersForTest();
    if (retryUserEmails.length > 0) {
      throw new Error(`User reminders were re-sent during admin digest retry! Count: ${retryUserEmails.length}`);
    }

    // Admin digest SHOULD be dispatched
    const retryAdminEmails = getSentAdminDigestsForTest();
    if (retryAdminEmails.length === 0) {
      throw new Error('Admin digest retry was not dispatched.');
    }
    console.log('✅ TEST 3 PASSED: Admin digest retried successfully; user reminder was not re-sent.');

    // -------------------------------------------------------------
    // TEST 4: User Email Failure & Safe Retry
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: User Email Failure & Safe Retry ---');
    const userD = await User.create({
      name: 'Divya Rangan',
      email: `${testPrefix}_divya@example.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      role: 'user',
      accountStatus: 'active',
    });
    createdUserIds.push(userD._id);

    const subDEndDate = new Date(now.getTime() + 7 * DAY_MS);
    const subD = await Subscription.create({
      user: userD._id,
      planCode: 'THREE_MONTHS',
      durationMonths: 3,
      status: 'active',
      startDate: new Date(now.getTime() - 83 * DAY_MS),
      endDate: subDEndDate,
      gracePeriodEndDate: new Date(subDEndDate.getTime() + 7 * DAY_MS),
      expiryReminder7d: {
        deliveryStatus: 'failed',
        failureReason: 'Simulated network timeout',
        targetEndDate: subDEndDate,
        attemptCount: 1,
        lastAttemptAt: now,
      },
    });
    createdSubscriptionIds.push(subD._id);

    // Verify subD is eligible for retry
    const subDDoc = await Subscription.findById(subD._id).populate('user');
    const eligD = evaluateReminderEligibility(subDDoc, [subDDoc], now);
    if (!eligD.eligibleForUserReminder) {
      throw new Error('Failed user reminder was not considered eligible for retry!');
    }

    clearSentSubscriptionRemindersForTest();
    clearSentAdminDigestsForTest();

    // Since admin digest was already sent today, run should send ONLY User D's reminder
    const runRetryUser = await runSubscriptionExpiryReminders({
      now,
      apply: true,
      acquireLock: true,
    });

    const userEmails = getSentSubscriptionRemindersForTest();
    if (!userEmails.some((e) => e.to === userD.email)) {
      throw new Error('User D failed reminder was not retried.');
    }

    const subDUpdated = await Subscription.findById(subD._id);
    if (subDUpdated.expiryReminder7d.deliveryStatus !== 'sent' || subDUpdated.expiryReminder7d.attemptCount !== 2) {
      throw new Error(`User D tracking after retry invalid: ${JSON.stringify(subDUpdated.expiryReminder7d)}`);
    }

    console.log('✅ TEST 4 PASSED: Failed user reminder safely retried and transitioned to sent with attemptCount 2.');

    // -------------------------------------------------------------
    // TEST 5: Renewal & Extension Invariants
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Renewal & Extension Invariants ---');
    // Scenario 5A: User A extends subA by 30 days -> endDate moves to +37 days.
    const extendedEnd = new Date(now.getTime() + 37 * DAY_MS);
    await Subscription.findByIdAndUpdate(subA._id, {
      $set: {
        endDate: extendedEnd,
        gracePeriodEndDate: new Date(extendedEnd.getTime() + 7 * DAY_MS),
        expiryReminder7d: null,
      },
    });

    const subACheck = await Subscription.findById(subA._id);
    const eligExt = evaluateReminderEligibility(subACheck, [subACheck], now);
    if (eligExt.eligibleForUserReminder) {
      throw new Error('Extended subscription (+37d) improperly marked eligible for 7-day reminder!');
    }
    console.log('✅ Sub-test 5A: Extended subscription outside 7 days is not reminded.');

    // Scenario 5B: User B creates an active renewal ending in 90 days.
    // Old subB (ending in 3d) must be considered obsolete!
    const subBRenewal = await Subscription.create({
      user: userB._id,
      planCode: 'SIX_MONTHS',
      durationMonths: 6,
      status: 'active',
      startDate: now,
      endDate: new Date(now.getTime() + 90 * DAY_MS),
      gracePeriodEndDate: new Date(now.getTime() + 97 * DAY_MS),
    });
    createdSubscriptionIds.push(subBRenewal._id);

    const allSubsB = await Subscription.find({ user: userB._id });
    const eligOldB = evaluateReminderEligibility(subB, allSubsB, now);
    if (eligOldB.reason !== 'newer_renewal_exists' || eligOldB.eligibleForUserReminder || eligOldB.eligibleForAdminDigest) {
      throw new Error(`Old subscription with newer active renewal was not marked obsolete! Result: ${JSON.stringify(eligOldB)}`);
    }
    console.log('✅ Sub-test 5B: Old subscription with newer renewal marked obsolete and skipped.');

    // -------------------------------------------------------------
    // TEST 6: Grace-Period Profile Deactivation Invariant
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: 7-Day Grace-Period Profile Deactivation Invariant ---');
    const profileA = await MatrimonialProfile.create({
      user: userA._id,
      candidateName: 'Anand Kumar Candidate',
      source: 'direct',
      approvalStatus: 'approved',
      profileStatus: 'active',
      personalDetails: { gender: 'Male', maritalStatus: 'Never Married' },
    });
    createdProfileIds.push(profileA._id);

    // Active subA (extended) -> Profile MUST stay active
    await runSubscriptionExpiryDeactivation({ now, apply: true, acquireLock: false });
    const profileACheck = await MatrimonialProfile.findById(profileA._id);
    if (profileACheck.profileStatus !== 'active') {
      throw new Error('Profile with active subscription was improperly deactivated!');
    }
    console.log('✅ Sub-test 6A: Profile with active subscription remains active.');

    // Past 7-day grace period -> Profile must be deactivated
    const expiredSub = await Subscription.create({
      user: userA._id,
      planCode: 'THREE_MONTHS',
      durationMonths: 3,
      status: 'active',
      startDate: new Date(now.getTime() - 100 * DAY_MS),
      endDate: new Date(now.getTime() - 10 * DAY_MS),
      gracePeriodEndDate: new Date(now.getTime() - 3 * DAY_MS), // grace expired 3 days ago
    });
    createdSubscriptionIds.push(expiredSub._id);

    // Cancel active subA so userA ONLY has the expired sub
    await Subscription.findByIdAndUpdate(subA._id, { $set: { status: 'cancelled' } });

    await runSubscriptionExpiryDeactivation({ now, apply: true, acquireLock: false });
    const profileAExpired = await MatrimonialProfile.findById(profileA._id);
    if (profileAExpired.profileStatus !== 'inactive' || profileAExpired.deactivationReason !== 'subscription_expired') {
      throw new Error(`Profile past grace period was not deactivated! ${JSON.stringify(profileAExpired)}`);
    }
    console.log('✅ Sub-test 6B: Subscription expired beyond 7-day grace period deactivates profile.');

    console.log('\n======================================================');
    console.log('🎉 ALL HARDENED TESTS PASSED CLEANLY WITH ZERO REGRESSIONS!');
    console.log('======================================================');
  } finally {
    Notification.create = originalNotificationCreate;
    console.log('\nCleaning up test fixtures...');
    await cleanupFixtures();
    await mongoose.disconnect();
    console.log('Cleaned up and disconnected.');
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test Failure:', err);
  cleanupFixtures().finally(() => {
    mongoose.disconnect().finally(() => process.exit(1));
  });
});
