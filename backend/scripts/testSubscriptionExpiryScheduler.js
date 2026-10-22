/**
 * Comprehensive Integration Test Suite: Subscription Expiry & Grace-Period Scheduler
 *
 * Target: Isolated Test Database (matrimony_phase5c_test)
 *
 * Verifies:
 * 1. Active subscription (`now < endDate`) -> NOT deactivated.
 * 2. Exactly at `endDate` -> NOT deactivated (enters grace period).
 * 3. Mid-grace-period (`endDate < now < gracePeriodEndDate`) -> NOT deactivated.
 * 4. Exactly at `gracePeriodEndDate` -> NOT deactivated.
 * 5. Expired beyond grace period (`now > gracePeriodEndDate`) -> DEACTIVATED (`profileStatus: 'inactive'`, `deactivationReason: 'subscription_expired'`).
 * 6. Stale subscription status is marked 'expired' upon deactivation.
 * 7. Unlinked broker candidate (`user: null`) -> NOT deactivated.
 * 8. Linked broker candidate who never subscribed -> NOT deactivated.
 * 9. Linked broker candidate whose subscription expired beyond grace -> DEACTIVATED.
 * 10. Direct member who never subscribed -> NOT deactivated.
 * 11. Already inactive profile (`admin_action` or `member_action`) -> Never overwritten.
 * 12. Renewal/reactivation restores profile to 'active'.
 * 13. Idempotent repeat run causes 0 duplicate deactivations.
 * 14. Dry-run mode simulates without modifying database.
 * 15. Distributed lock lease prevents concurrent worker collision.
 * 16. Stale distributed lock lease recovers safely after expiry.
 * 17. Structured logs contain required telemetry and strictly zero PII.
 */

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load isolated test environment exclusively
dotenv.config({ path: path.join(__dirname, '../.env.test') });

const EXPECTED_TEST_DB = 'matrimony_phase5c_test';

const User = require('../models/User');
const MatrimonialProfile = require('../models/MatrimonialProfile');
const Subscription = require('../models/Subscription');
const JobLock = require('../models/JobLock');
const {
  JOB_NAME,
  runSubscriptionExpiryDeactivation,
} = require('./deactivateExpiredProfilesPhase5C');
const {
  acquireJobLock,
  releaseJobLock,
} = require('../services/jobLockService');
const {
  reactivateExpiredProfileIfEligible,
} = require('../services/subscriptionAccessService');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests += 1;
  if (condition) {
    passedTests += 1;
    console.log(`  [PASS] Test ${totalTests}: ${testName}`);
  } else {
    failedTests += 1;
    console.error(`  [FAIL] Test ${totalTests}: ${testName} - ${details}`);
  }
}

// Track created IDs for strict cleanup
const cleanupUserIds = [];
const cleanupProfileIds = [];
const cleanupSubIds = [];

const BASE_TIME = new Date('2026-10-01T12:00:00.000Z');
const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function createTestUser(emailSuffix, role = 'user', registrationSource = 'direct', broker = null) {
  const user = await User.create({
    name: `Test User ${emailSuffix}`,
    email: `test_exp_${emailSuffix}_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`,
    passwordHash: 'dummy_bcrypt_hash_1234567890',
    role,
    registrationSource,
    broker: broker || null,
    accountStatus: 'active',
  });
  cleanupUserIds.push(user._id);
  return user;
}

async function createTestProfile({
  user = null,
  profileStatus = 'active',
  deactivationReason = null,
  gender = 'male',
  caste = 'Kongu Vellalar',
  gothram = 'Kadayampatti',
}) {
  const profile = await MatrimonialProfile.create({
    user,
    profileStatus,
    deactivationReason,
    personalInfo: {
      fullName: 'Test Candidate',
      gender,
      dateOfBirth: new Date('1995-01-01'),
      maritalStatus: 'never_married',
    },
    communityDetails: {
      caste,
      gothram,
    },
  });
  cleanupProfileIds.push(profile._id);
  return profile;
}

async function createTestSubscription({
  user,
  startDate,
  endDate,
  gracePeriodEndDate = null,
  status = 'active',
  planCode = 'THREE_MONTHS',
}) {
  const sub = await Subscription.create({
    user,
    planCode,
    durationMonths: 3,
    status,
    startDate,
    endDate,
    gracePeriodEndDate: gracePeriodEndDate || new Date(endDate.getTime() + 7 * MS_PER_DAY),
  });
  cleanupSubIds.push(sub._id);
  return sub;
}

async function runTests() {
  console.log('\n================================================================');
  console.log(' Phase 5C Subscription Expiry & Grace-Period Scheduler Suite');
  console.log('================================================================\n');

  // Verify target database
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri || !mongoUri.includes(EXPECTED_TEST_DB)) {
    console.error(`[SAFETY ERROR] Database URI must target '${EXPECTED_TEST_DB}'. Found: ${mongoUri}`);
    process.exit(1);
  }

  await mongoose.connect(mongoUri, { autoIndex: false });
  assert(
    mongoose.connection.name === EXPECTED_TEST_DB,
    'Safety check: Connected strictly to isolated test database',
    `Connected to ${mongoose.connection.name}`
  );

  try {
    // -------------------------------------------------------------
    // Test 1: Active Subscription (now < endDate) -> NOT deactivated
    // -------------------------------------------------------------
    console.log('\n--- Scenario 1: Active Subscription Boundary ---');
    const user1 = await createTestUser('active_sub');
    const profile1 = await createTestProfile({ user: user1._id });
    const sub1StartDate = new Date(BASE_TIME.getTime() - 10 * MS_PER_DAY);
    const sub1EndDate = new Date(BASE_TIME.getTime() + 20 * MS_PER_DAY);
    await createTestSubscription({
      user: user1._id,
      startDate: sub1StartDate,
      endDate: sub1EndDate,
    });

    const res1 = await runSubscriptionExpiryDeactivation({
      now: BASE_TIME,
      apply: true,
      acquireLock: false,
    });
    const p1After = await MatrimonialProfile.findById(profile1._id);
    assert(
      p1After.profileStatus === 'active' && !res1.deactivatedProfileIds.includes(String(profile1._id)),
      'Profile with active subscription (now < endDate) remains active',
      `Status was: ${p1After.profileStatus}`
    );

    // -------------------------------------------------------------
    // Test 2: Exactly at endDate -> NOT deactivated (enters grace period)
    // -------------------------------------------------------------
    console.log('\n--- Scenario 2: Exactly at endDate Boundary ---');
    const user2 = await createTestUser('at_enddate');
    const profile2 = await createTestProfile({ user: user2._id });
    const sub2StartDate = new Date(BASE_TIME.getTime() - 90 * MS_PER_DAY);
    const sub2EndDate = new Date(BASE_TIME.getTime()); // Exactly now
    await createTestSubscription({
      user: user2._id,
      startDate: sub2StartDate,
      endDate: sub2EndDate,
    });

    const res2 = await runSubscriptionExpiryDeactivation({
      now: BASE_TIME,
      apply: true,
      acquireLock: false,
    });
    const p2After = await MatrimonialProfile.findById(profile2._id);
    assert(
      p2After.profileStatus === 'active' && !res2.deactivatedProfileIds.includes(String(profile2._id)),
      'Profile exactly at subscription endDate enters 7-day grace period and is NOT deactivated',
      `Status was: ${p2After.profileStatus}`
    );

    // -------------------------------------------------------------
    // Test 3: Mid-grace period (endDate < now < gracePeriodEndDate) -> NOT deactivated
    // -------------------------------------------------------------
    console.log('\n--- Scenario 3: Mid-Grace Period (Day 3 of 7) ---');
    const user3 = await createTestUser('mid_grace');
    const profile3 = await createTestProfile({ user: user3._id });
    const sub3StartDate = new Date(BASE_TIME.getTime() - 93 * MS_PER_DAY);
    const sub3EndDate = new Date(BASE_TIME.getTime() - 3 * MS_PER_DAY); // 3 days ago
    const sub3GraceEnd = new Date(sub3EndDate.getTime() + 7 * MS_PER_DAY); // 4 days in future
    await createTestSubscription({
      user: user3._id,
      startDate: sub3StartDate,
      endDate: sub3EndDate,
      gracePeriodEndDate: sub3GraceEnd,
    });

    const res3 = await runSubscriptionExpiryDeactivation({
      now: BASE_TIME,
      apply: true,
      acquireLock: false,
    });
    const p3After = await MatrimonialProfile.findById(profile3._id);
    assert(
      p3After.profileStatus === 'active' && !res3.deactivatedProfileIds.includes(String(profile3._id)),
      'Profile within 7-day grace period is NOT deactivated',
      `Status was: ${p3After.profileStatus}`
    );

    // -------------------------------------------------------------
    // Test 4: Exactly at gracePeriodEndDate -> NOT deactivated
    // -------------------------------------------------------------
    console.log('\n--- Scenario 4: Exactly at gracePeriodEndDate Boundary ---');
    const user4 = await createTestUser('at_grace_end');
    const profile4 = await createTestProfile({ user: user4._id });
    const sub4StartDate = new Date(BASE_TIME.getTime() - 97 * MS_PER_DAY);
    const sub4EndDate = new Date(BASE_TIME.getTime() - 7 * MS_PER_DAY);
    const sub4GraceEnd = new Date(BASE_TIME.getTime()); // Exactly now
    await createTestSubscription({
      user: user4._id,
      startDate: sub4StartDate,
      endDate: sub4EndDate,
      gracePeriodEndDate: sub4GraceEnd,
    });

    const res4 = await runSubscriptionExpiryDeactivation({
      now: BASE_TIME,
      apply: true,
      acquireLock: false,
    });
    const p4After = await MatrimonialProfile.findById(profile4._id);
    assert(
      p4After.profileStatus === 'active' && !res4.deactivatedProfileIds.includes(String(profile4._id)),
      'Profile exactly at gracePeriodEndDate is NOT deactivated',
      `Status was: ${p4After.profileStatus}`
    );

    // -------------------------------------------------------------
    // Test 5: Expired beyond grace period (now > gracePeriodEndDate) -> DEACTIVATED
    // -------------------------------------------------------------
    console.log('\n--- Scenario 5: Expired Beyond Grace Period ---');
    const user5 = await createTestUser('expired_beyond_grace');
    const profile5 = await createTestProfile({ user: user5._id });
    const sub5StartDate = new Date(BASE_TIME.getTime() - 100 * MS_PER_DAY);
    const sub5EndDate = new Date(BASE_TIME.getTime() - 10 * MS_PER_DAY);
    const sub5GraceEnd = new Date(BASE_TIME.getTime() - 3 * MS_PER_DAY); // Expired 3 days ago
    const sub5 = await createTestSubscription({
      user: user5._id,
      startDate: sub5StartDate,
      endDate: sub5EndDate,
      gracePeriodEndDate: sub5GraceEnd,
      status: 'active', // Stale status in DB
    });

    const res5 = await runSubscriptionExpiryDeactivation({
      now: BASE_TIME,
      apply: true,
      acquireLock: false,
    });
    const p5After = await MatrimonialProfile.findById(profile5._id);
    const sub5After = await Subscription.findById(sub5._id);

    assert(
      p5After.profileStatus === 'inactive' &&
      p5After.deactivationReason === 'subscription_expired' &&
      p5After.deactivatedAt !== null,
      'Profile expired beyond grace period is atomically deactivated with subscription_expired reason',
      `Status: ${p5After.profileStatus}, Reason: ${p5After.deactivationReason}`
    );

    // Test 6: Stale subscription status is updated to 'expired'
    assert(
      sub5After.status === 'expired',
      'Stale active subscription record is updated to status: expired upon deactivation',
      `Subscription status was: ${sub5After.status}`
    );

    // -------------------------------------------------------------
    // Test 7: Unlinked Broker Profile (user: null) -> NOT deactivated
    // -------------------------------------------------------------
    console.log('\n--- Scenario 6: Unlinked Broker Candidate Exemption ---');
    const profileBrokerUnlinked = await createTestProfile({
      user: null,
      profileStatus: 'active',
    });

    const resBroker = await runSubscriptionExpiryDeactivation({
      now: BASE_TIME,
      apply: true,
      acquireLock: false,
    });
    const pBrokerAfter = await MatrimonialProfile.findById(profileBrokerUnlinked._id);
    assert(
      pBrokerAfter.profileStatus === 'active' &&
      !resBroker.deactivatedProfileIds.includes(String(profileBrokerUnlinked._id)),
      'Unlinked broker candidate profile (user: null) is exempted and remains active',
      `Status was: ${pBrokerAfter.profileStatus}`
    );

    // -------------------------------------------------------------
    // Test 8: Linked Broker Candidate who NEVER subscribed -> NOT deactivated
    // -------------------------------------------------------------
    console.log('\n--- Scenario 7: Linked Broker Candidate Unpaid Exemption ---');
    const brokerUser = await createTestUser('broker_boss', 'user', 'broker');
    const invitedBrokerCandUser = await createTestUser('broker_cand_unpaid', 'user', 'broker', brokerUser._id);
    const profileBrokerCand = await createTestProfile({
      user: invitedBrokerCandUser._id,
      profileStatus: 'active',
    });

    const resBrokerUnpaid = await runSubscriptionExpiryDeactivation({
      now: BASE_TIME,
      apply: true,
      acquireLock: false,
    });
    const pBrokerCandAfter = await MatrimonialProfile.findById(profileBrokerCand._id);
    assert(
      pBrokerCandAfter.profileStatus === 'active' &&
      !resBrokerUnpaid.deactivatedProfileIds.includes(String(profileBrokerCand._id)),
      'Linked broker candidate who never subscribed is preserved and remains active',
      `Status was: ${pBrokerCandAfter.profileStatus}`
    );

    // -------------------------------------------------------------
    // Test 9: Linked Broker Candidate whose subscription expired beyond grace -> DEACTIVATED
    // -------------------------------------------------------------
    console.log('\n--- Scenario 8: Linked Broker Candidate with Expired Subscription ---');
    const invitedSubscribedCand = await createTestUser('broker_cand_sub', 'user', 'broker', brokerUser._id);
    const profileBrokerSubCand = await createTestProfile({
      user: invitedSubscribedCand._id,
      profileStatus: 'active',
    });
    await createTestSubscription({
      user: invitedSubscribedCand._id,
      startDate: new Date(BASE_TIME.getTime() - 100 * MS_PER_DAY),
      endDate: new Date(BASE_TIME.getTime() - 10 * MS_PER_DAY),
      gracePeriodEndDate: new Date(BASE_TIME.getTime() - 3 * MS_PER_DAY),
      status: 'active',
    });

    const resBrokerSubCand = await runSubscriptionExpiryDeactivation({
      now: BASE_TIME,
      apply: true,
      acquireLock: false,
    });
    const pBrokerSubCandAfter = await MatrimonialProfile.findById(profileBrokerSubCand._id);
    assert(
      pBrokerSubCandAfter.profileStatus === 'inactive' &&
      pBrokerSubCandAfter.deactivationReason === 'subscription_expired',
      'Linked broker candidate whose subscription expired beyond grace follows normal expiry and is deactivated',
      `Status: ${pBrokerSubCandAfter.profileStatus}, Reason: ${pBrokerSubCandAfter.deactivationReason}`
    );

    // -------------------------------------------------------------
    // Test 10: Direct Member who NEVER subscribed -> NOT deactivated
    // -------------------------------------------------------------
    console.log('\n--- Scenario 9: Direct Unpaid Member Exemption ---');
    const directUnpaidUser = await createTestUser('direct_unpaid', 'user', 'direct');
    const profileDirectUnpaid = await createTestProfile({
      user: directUnpaidUser._id,
      profileStatus: 'active',
    });

    const resDirectUnpaid = await runSubscriptionExpiryDeactivation({
      now: BASE_TIME,
      apply: true,
      acquireLock: false,
    });
    const pDirectUnpaidAfter = await MatrimonialProfile.findById(profileDirectUnpaid._id);
    assert(
      pDirectUnpaidAfter.profileStatus === 'active' &&
      !resDirectUnpaid.deactivatedProfileIds.includes(String(profileDirectUnpaid._id)),
      'Direct member who never subscribed remains active indefinitely (no unpaid cutoff)',
      `Status was: ${pDirectUnpaidAfter.profileStatus}`
    );

    // -------------------------------------------------------------
    // Test 11: Already Inactive Profile (admin_action) -> NEVER overwritten
    // -------------------------------------------------------------
    console.log('\n--- Scenario 10: Protection for Inactive Profiles ---');
    const adminDeactivatedUser = await createTestUser('admin_deact', 'user');
    const profileAdminDeact = await createTestProfile({
      user: adminDeactivatedUser._id,
      profileStatus: 'inactive',
      deactivationReason: 'admin_action',
    });
    await createTestSubscription({
      user: adminDeactivatedUser._id,
      startDate: new Date(BASE_TIME.getTime() - 100 * MS_PER_DAY),
      endDate: new Date(BASE_TIME.getTime() - 10 * MS_PER_DAY),
      gracePeriodEndDate: new Date(BASE_TIME.getTime() - 3 * MS_PER_DAY),
      status: 'expired',
    });

    await runSubscriptionExpiryDeactivation({
      now: BASE_TIME,
      apply: true,
      acquireLock: false,
    });
    const pAdminDeactAfter = await MatrimonialProfile.findById(profileAdminDeact._id);
    assert(
      pAdminDeactAfter.profileStatus === 'inactive' &&
      pAdminDeactAfter.deactivationReason === 'admin_action',
      'Already inactive profile with reason admin_action is never overwritten by scheduler',
      `Reason was: ${pAdminDeactAfter.deactivationReason}`
    );

    // -------------------------------------------------------------
    // Test 12: Renewal / Reactivation -> Profile Restored to Active
    // -------------------------------------------------------------
    console.log('\n--- Scenario 11: Renewal Reactivation ---');
    // User5's profile was deactivated in Test 5 for 'subscription_expired'
    // Now grant user5 a renewed active subscription
    await createTestSubscription({
      user: user5._id,
      startDate: BASE_TIME,
      endDate: new Date(BASE_TIME.getTime() + 90 * MS_PER_DAY),
      status: 'active',
    });

    const reactivationResult = await reactivateExpiredProfileIfEligible(user5._id, {
      now: BASE_TIME,
      skipSubscriptionCheck: false,
    });
    const p5Reactivated = await MatrimonialProfile.findById(profile5._id);
    assert(
      reactivationResult.reactivated === true &&
      p5Reactivated.profileStatus === 'active' &&
      p5Reactivated.deactivationReason === null &&
      p5Reactivated.deactivatedAt === null,
      'When an expired member renews, reactivateExpiredProfileIfEligible restores profileStatus to active',
      `Reactivated: ${reactivationResult.reactivated}, Status: ${p5Reactivated.profileStatus}`
    );

    // -------------------------------------------------------------
    // Test 13: Idempotent Repeat Run -> Zero Duplicate Deactivations
    // -------------------------------------------------------------
    console.log('\n--- Scenario 12: Idempotent Repeat Run ---');
    const repeatRun = await runSubscriptionExpiryDeactivation({
      now: BASE_TIME,
      apply: true,
      acquireLock: false,
    });
    assert(
      repeatRun.deactivatedCount === 0 && repeatRun.deactivatedProfileIds.length === 0,
      'Subsequent deactivation run is idempotent with 0 new deactivations',
      `Deactivated count: ${repeatRun.deactivatedCount}`
    );

    // -------------------------------------------------------------
    // Test 14: Dry-Run Mode -> Simulates without database writes
    // -------------------------------------------------------------
    console.log('\n--- Scenario 13: Dry-Run Simulation Mode ---');
    const dryRunUser = await createTestUser('dry_run_user');
    const profileDryRun = await createTestProfile({ user: dryRunUser._id });
    await createTestSubscription({
      user: dryRunUser._id,
      startDate: new Date(BASE_TIME.getTime() - 100 * MS_PER_DAY),
      endDate: new Date(BASE_TIME.getTime() - 10 * MS_PER_DAY),
      gracePeriodEndDate: new Date(BASE_TIME.getTime() - 3 * MS_PER_DAY),
      status: 'active',
    });

    const dryRunSummary = await runSubscriptionExpiryDeactivation({
      now: BASE_TIME,
      apply: false, // DRY RUN
      acquireLock: false,
    });
    const pDryRunAfter = await MatrimonialProfile.findById(profileDryRun._id);
    assert(
      dryRunSummary.mode === 'dry-run' &&
      dryRunSummary.eligibleForDeactivationCount >= 1 &&
      dryRunSummary.deactivatedCount === 0 &&
      pDryRunAfter.profileStatus === 'active',
      'Dry-run identifies eligible expired profile without writing to database',
      `Eligible: ${dryRunSummary.eligibleForDeactivationCount}, Deactivated: ${dryRunSummary.deactivatedCount}, Status: ${pDryRunAfter.profileStatus}`
    );

    // -------------------------------------------------------------
    // Test 15: Distributed Lock Lease Concurrency
    // -------------------------------------------------------------
    console.log('\n--- Scenario 14: Distributed Lock Lease Concurrency ---');
    // Clear any previous lock for a clean test
    await JobLock.deleteMany({ jobName: JOB_NAME });

    const lock1 = await acquireJobLock({
      jobName: JOB_NAME,
      lockedBy: 'worker-node-1',
      leaseDurationMs: 60000,
      now: BASE_TIME,
    });
    assert(
      lock1.acquired === true && Boolean(lock1.lockToken),
      'Worker 1 successfully acquires distributed lock lease',
      `Acquired: ${lock1.acquired}`
    );

    const lock2 = await acquireJobLock({
      jobName: JOB_NAME,
      lockedBy: 'worker-node-2',
      leaseDurationMs: 60000,
      now: BASE_TIME,
    });
    assert(
      lock2.acquired === false && lock2.reason === 'lock_held_by_active_worker',
      'Worker 2 is prevented from acquiring lock while lease is active',
      `Acquired: ${lock2.acquired}, Reason: ${lock2.reason}`
    );

    const release1 = await releaseJobLock({
      jobName: JOB_NAME,
      lockToken: lock1.lockToken,
      status: 'success',
      now: BASE_TIME,
    });
    assert(
      release1.released === true,
      'Worker 1 successfully releases distributed lock lease with valid fence token',
      `Released: ${release1.released}`
    );

    const lock3 = await acquireJobLock({
      jobName: JOB_NAME,
      lockedBy: 'worker-node-2',
      leaseDurationMs: 60000,
      now: BASE_TIME,
    });
    assert(
      lock3.acquired === true,
      'Worker 2 successfully acquires lock lease after Worker 1 release',
      `Acquired: ${lock3.acquired}`
    );
    await releaseJobLock({
      jobName: JOB_NAME,
      lockToken: lock3.lockToken,
      status: 'success',
      now: BASE_TIME,
    });

    // -------------------------------------------------------------
    // Test 16: Stale Distributed Lock Lease Recovery
    // -------------------------------------------------------------
    console.log('\n--- Scenario 15: Stale Lock Lease Recovery ---');
    const staleAcquireTime = new Date('2026-10-01T10:00:00.000Z');
    const staleLock = await acquireJobLock({
      jobName: JOB_NAME,
      lockedBy: 'crashed-worker',
      leaseDurationMs: 10 * 60 * 1000, // 10 minutes (expires at 10:10)
      now: staleAcquireTime,
    });
    assert(staleLock.acquired === true, 'Crashed worker acquired lock');

    // Attempt acquire at 11:00 (50 minutes after lease expired)
    const recoveryTime = new Date('2026-10-01T11:00:00.000Z');
    const recoveryLock = await acquireJobLock({
      jobName: JOB_NAME,
      lockedBy: 'recovering-worker',
      leaseDurationMs: 60000,
      now: recoveryTime,
    });
    assert(
      recoveryLock.acquired === true,
      'New worker safely recovers and re-claims expired stale lock lease',
      `Acquired: ${recoveryLock.acquired}`
    );
    await releaseJobLock({
      jobName: JOB_NAME,
      lockToken: recoveryLock.lockToken,
      status: 'success',
      now: recoveryTime,
    });

    // -------------------------------------------------------------
    // Test 17: Structured Logs Privacy Verification (Zero PII)
    // -------------------------------------------------------------
    console.log('\n--- Scenario 16: Structured Logs Privacy Audit ---');
    const capturedLogs = [];
    const origLog = console.log;
    console.log = (...args) => {
      capturedLogs.push(args.join(' '));
      origLog(...args);
    };

    try {
      await runSubscriptionExpiryDeactivation({
        now: BASE_TIME,
        apply: true,
        acquireLock: true,
        workerId: 'audit-worker',
      });
    } finally {
      console.log = origLog;
    }

    // Inspect captured JSON log entries
    let foundJobLog = false;
    let hasPiiExposure = false;
    for (const line of capturedLogs) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.job === JOB_NAME) {
          foundJobLog = true;
          // Check that no personal info is stored
          const str = JSON.stringify(parsed).toLowerCase();
          if (str.includes('@example.com') || str.includes('hashedpassword') || str.includes('kadayampatti')) {
            hasPiiExposure = true;
          }
        }
      } catch (_) {
        // Non-JSON stdout lines (e.g. test headers)
      }
    }

    assert(
      foundJobLog === true && hasPiiExposure === false,
      'Structured logs output valid telemetry with strictly zero candidate PII or secrets',
      `Found job log: ${foundJobLog}, PII exposed: ${hasPiiExposure}`
    );

  } finally {
    // Strict Cleanup of synthetic records
    console.log('\n--- Cleaning up synthetic test fixtures ---');
    try {
      if (cleanupProfileIds.length > 0) {
        await MatrimonialProfile.deleteMany({ _id: { $in: cleanupProfileIds } });
      }
      if (cleanupSubIds.length > 0) {
        await Subscription.deleteMany({ _id: { $in: cleanupSubIds } });
      }
      if (cleanupUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: cleanupUserIds } });
      }
      await JobLock.deleteMany({ jobName: JOB_NAME });
    } catch (cleanupErr) {
      console.error(`[Cleanup Error] ${cleanupErr.message}`);
    }
    await mongoose.disconnect();
  }

  console.log('\n================================================================');
  console.log(` Summary: ${passedTests} passed, ${failedTests} failed (Total: ${totalTests})`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error(`[Fatal Test Suite Error] ${err.message}`);
    process.exit(1);
  });
}
