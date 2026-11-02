const mongoose = require('mongoose');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const JobLock = require('../models/JobLock');
const {
  sendSubscriptionExpiryReminderEmail,
  sendAdminSubscriptionExpiryDigestEmail,
} = require('./emailService');
const {
  acquireJobLock,
  releaseJobLock,
} = require('./jobLockService');
const {
  createNotification,
  notifyActiveAdmins,
} = require('./notificationService');

const JOB_NAME = 'subscription_expiry_reminders';
const DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * DAY_MS;

// User reminder timing window around the 7-day mark: 6.0 to 8.0 days before endDate
// This 48-hour window guarantees that a daily scheduler (interval ~24h) hits every expiring
// subscription in exactly one daily run, while preventing premature reminders (>8d) or late reminders (<6d).
const USER_REMINDER_MIN_DAYS = 6.0;
const USER_REMINDER_MAX_DAYS = 8.0;

/**
 * Formats and writes structured, privacy-safe JSON log events to stdout.
 * @param {string} level - 'info' | 'warn' | 'error'
 * @param {string} event - Event descriptor
 * @param {object} [data={}] - Context data (PII strictly prohibited)
 */
const logStructured = (level, event, data = {}) => {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    job: JOB_NAME,
    ...data,
  };
  if (level === 'error') {
    console.error(JSON.stringify(payload));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
};

/**
 * Formats a Date object to YYYY-MM-DD for reporting period tracking.
 * @param {Date} date
 * @returns {string}
 */
const toReportDateKey = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
};

/**
 * Resolves active administrator email recipients dynamically from User collection
 * and optional ADMIN_NOTIFICATION_EMAIL environment variable. Never hardcodes addresses.
 *
 * @returns {Promise<Array<{ email: string, name: string }>>}
 */
const resolveAdminRecipients = async () => {
  const recipients = [];
  const seenEmails = new Set();

  try {
    const adminUsers = await User.find({
      role: 'admin',
      accountStatus: 'active',
    }).select('name email');

    for (const admin of adminUsers || []) {
      if (admin && admin.email) {
        const norm = admin.email.trim().toLowerCase();
        if (!seenEmails.has(norm)) {
          seenEmails.add(norm);
          recipients.push({ email: norm, name: admin.name || 'Administrator' });
        }
      }
    }
  } catch (err) {
    logStructured('error', 'resolve_admins_failed', { error: err.message });
  }

  // Support optional environment override / supplementary inbox
  const envAdminEmail = (process.env.ADMIN_NOTIFICATION_EMAIL || '').trim().toLowerCase();
  if (envAdminEmail && !seenEmails.has(envAdminEmail)) {
    seenEmails.add(envAdminEmail);
    recipients.push({ email: envAdminEmail, name: 'Administrator' });
  }

  return recipients;
};

/**
 * Checks whether a user reminder for the given target endDate was already successfully sent.
 *
 * @param {object} reminderTracking - sub.expiryReminder7d
 * @param {Date} currentEndDate - sub.endDate
 * @returns {boolean}
 */
const isUserReminderAlreadySent = (reminderTracking, currentEndDate) => {
  if (!reminderTracking || reminderTracking.deliveryStatus !== 'sent') {
    return false;
  }
  if (!reminderTracking.targetEndDate || !currentEndDate) {
    return false;
  }
  return new Date(reminderTracking.targetEndDate).getTime() === new Date(currentEndDate).getTime();
};

/**
 * Checks whether this user has a newer active subscription (e.g. renewal or extension)
 * that makes the candidate subscription's expiry obsolete.
 *
 * Follows dashboard & subscription access invariants:
 * If user holds another active subscription with endDate > candidateSub.endDate, candidate is obsolete.
 *
 * @param {object} candidateSub
 * @param {Array<object>} allUserSubscriptions
 * @returns {boolean}
 */
const hasNewerActiveRenewal = (candidateSub, allUserSubscriptions = []) => {
  if (!candidateSub || !candidateSub.endDate) return false;
  const candidateEndMs = new Date(candidateSub.endDate).getTime();

  return allUserSubscriptions.some((other) => {
    if (!other || String(other._id) === String(candidateSub._id)) return false;
    if (other.status !== 'active' || !other.endDate) return false;
    return new Date(other.endDate).getTime() > candidateEndMs;
  });
};

/**
 * Evaluates whether an active subscription is currently approaching the 7-day mark for User Reminder,
 * and whether it qualifies for inclusion in the Admin Approaching-Expiry Digest.
 *
 * Invariants:
 * 1. User Reminder timing: Fired only when subscription is approximately seven days before endDate
 *    (6.0 <= daysRemainingExact <= 8.0). Not fired for subscriptions with 1, 2, or 3 days remaining.
 * 2. Admin Digest inclusion: Shows all active members expiring in the upcoming 7 days (0 < daysRemainingExact <= 7.0).
 * 3. Renewal check: If user holds a newer active subscription with farther endDate, candidate is obsolete.
 * 4. Duplicate prevention: Checked against targetEndDate.
 *
 * @param {object} subscription
 * @param {Array<object>} allUserSubscriptions
 * @param {Date} now
 * @returns {{
 *   eligibleForUserReminder: boolean,
 *   eligibleForAdminDigest: boolean,
 *   reason?: string,
 *   daysRemaining?: number,
 *   daysRemainingExact?: number
 * }}
 */
const evaluateReminderEligibility = (subscription, allUserSubscriptions = [], now = new Date()) => {
  if (!subscription || subscription.status !== 'active') {
    return { eligibleForUserReminder: false, eligibleForAdminDigest: false, reason: 'not_active_status' };
  }

  if (!subscription.endDate || !(subscription.endDate instanceof Date) || Number.isNaN(subscription.endDate.getTime())) {
    return { eligibleForUserReminder: false, eligibleForAdminDigest: false, reason: 'invalid_end_date' };
  }

  const nowMs = now.getTime();
  const endMs = subscription.endDate.getTime();

  // If already expired, past the approaching-expiry window
  if (endMs <= nowMs) {
    return { eligibleForUserReminder: false, eligibleForAdminDigest: false, reason: 'already_expired' };
  }

  const msRemaining = endMs - nowMs;
  const daysRemainingExact = msRemaining / DAY_MS;
  const daysRemaining = Math.max(1, Math.ceil(daysRemainingExact));

  // Check for newer renewal (obsolete subscription check)
  if (hasNewerActiveRenewal(subscription, allUserSubscriptions)) {
    return { eligibleForUserReminder: false, eligibleForAdminDigest: false, reason: 'newer_renewal_exists' };
  }

  // 1. User Reminder: Strictly around the 7-day mark (6.0 to 8.0 days away)
  let eligibleForUserReminder = false;
  if (daysRemainingExact >= USER_REMINDER_MIN_DAYS && daysRemainingExact <= USER_REMINDER_MAX_DAYS) {
    const alreadySent = isUserReminderAlreadySent(subscription.expiryReminder7d, subscription.endDate);
    eligibleForUserReminder = !alreadySent;
  }

  // 2. Admin Digest: All members approaching expiry within the next 7 days (0 < days <= 7.0)
  let eligibleForAdminDigest = false;
  if (daysRemainingExact > 0 && daysRemainingExact <= 7.0) {
    eligibleForAdminDigest = true;
  }

  return {
    eligibleForUserReminder,
    eligibleForAdminDigest,
    daysRemaining,
    daysRemainingExact,
  };
};

/**
 * Checks whether an admin digest for the specified reportDateKey was already successfully dispatched.
 * Inspects JobLock's lastRunSummary.
 *
 * @param {string} reportDateKey - e.g. '2026-10-24'
 * @returns {Promise<boolean>}
 */
const isAdminDigestAlreadyDispatchedForDate = async (reportDateKey) => {
  try {
    const lock = await JobLock.findOne({ jobName: JOB_NAME });
    if (!lock || !lock.lastRunSummary) return false;
    const s = lock.lastRunSummary;
    return s.adminDigestReportDate === reportDateKey && s.adminDigestStatus === 'sent';
  } catch {
    return false;
  }
};

/**
 * Runs the subscription expiry reminder job.
 * Dispatches 7-day reminder emails to eligible users and a consolidated daily digest to admins.
 *
 * @param {object} [options]
 * @param {Date} [options.now=new Date()]
 * @param {boolean} [options.apply=false] - Dry run if false; performs database updates & email sends if true.
 * @param {boolean} [options.acquireLock=false] - Whether to acquire distributed lease lock via JobLock.
 * @param {string} [options.workerId]
 * @returns {Promise<object>} Execution summary
 */
const runSubscriptionExpiryReminders = async ({
  now = new Date(),
  apply = false,
  acquireLock = false,
  workerId = `worker-${process.pid}`,
} = {}) => {
  const startTime = Date.now();
  const currentTime = now instanceof Date ? now : new Date(now);
  const reportDateKey = toReportDateKey(currentTime);
  let lockToken = null;

  if (acquireLock) {
    const lockResult = await acquireJobLock({
      jobName: JOB_NAME,
      lockedBy: workerId,
      now: currentTime,
    });

    if (!lockResult.acquired) {
      logStructured('warn', 'job_lock_skipped', {
        reason: lockResult.reason || 'lock_held',
        mode: apply ? 'apply' : 'dry-run',
      });
      return {
        mode: apply ? 'apply' : 'dry-run',
        evaluatedAt: currentTime,
        reportDateKey,
        lockAcquired: false,
        skippedDueToLock: true,
        reason: lockResult.reason,
        activeSubscriptionsChecked: 0,
        userRemindersSent: 0,
        userRemindersFailed: 0,
        adminDigestsSent: 0,
        adminDigestsFailed: 0,
        durationMs: Date.now() - startTime,
      };
    }

    lockToken = lockResult.lockToken;
    logStructured('info', 'job_lock_acquired', {
      workerId,
      expiresAt: lockResult.expiresAt,
    });
  }

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    evaluatedAt: currentTime,
    reportDateKey,
    lockAcquired: Boolean(lockToken),
    activeSubscriptionsChecked: 0,
    eligibleForUserReminderCount: 0,
    userRemindersSent: 0,
    userRemindersFailed: 0,
    userRemindersSkippedAlreadySent: 0,
    adminDigestItemsCount: 0,
    adminDigestsSent: 0,
    adminDigestsFailed: 0,
    adminDigestSkippedAlreadySent: false,
    skippedNewerRenewalCount: 0,
    adminDigestReportDate: reportDateKey,
    adminDigestStatus: 'idle',
    durationMs: 0,
  };

  try {
    // 1. Fetch all active subscriptions expiring within the next 8 days
    // Upper bound is currentTime + 8 days to comfortably capture the 7-day user window (6-8 days)
    // and the admin digest window (0-7 days).
    const windowMaxEnd = new Date(currentTime.getTime() + USER_REMINDER_MAX_DAYS * DAY_MS);

    const candidateSubscriptions = await Subscription.find({
      status: 'active',
      endDate: { $gt: currentTime, $lte: windowMaxEnd },
    }).populate('user', 'name email role accountStatus');

    summary.activeSubscriptionsChecked = candidateSubscriptions.length;

    // 2. Fetch all subscriptions for the candidate user IDs in batch to evaluate renewals
    const userIds = candidateSubscriptions
      .map((sub) => sub.user && (sub.user._id || sub.user))
      .filter(Boolean);

    const allUserSubscriptions = await Subscription.find({
      user: { $in: userIds },
    });

    const subsByUserId = new Map();
    for (const sub of allUserSubscriptions) {
      if (!sub || !sub.user) continue;
      const uid = String(sub.user._id || sub.user);
      if (!subsByUserId.has(uid)) subsByUserId.set(uid, []);
      subsByUserId.get(uid).push(sub);
    }

    // 3. Evaluate eligibility for user reminder and admin digest
    const userReminderQueue = [];
    const adminDigestItems = [];
    const subscriptionsForAdminDigest = [];

    for (const sub of candidateSubscriptions) {
      const user = sub.user;
      if (!user || user.accountStatus !== 'active' || !user.email) {
        continue;
      }

      const uid = String(user._id || user);
      const userSubs = subsByUserId.get(uid) || [];
      const eligibility = evaluateReminderEligibility(sub, userSubs, currentTime);

      if (eligibility.reason === 'newer_renewal_exists') {
        summary.skippedNewerRenewalCount += 1;
        continue;
      }

      // Check user reminder eligibility (approx 7 days before endDate)
      if (eligibility.eligibleForUserReminder) {
        summary.eligibleForUserReminderCount += 1;
        userReminderQueue.push({
          subscription: sub,
          user,
          daysRemaining: eligibility.daysRemaining,
        });
      } else if (
        sub.endDate &&
        eligibility.daysRemainingExact >= USER_REMINDER_MIN_DAYS &&
        eligibility.daysRemainingExact <= USER_REMINDER_MAX_DAYS &&
        isUserReminderAlreadySent(sub.expiryReminder7d, sub.endDate)
      ) {
        summary.userRemindersSkippedAlreadySent += 1;
      }

      // Check admin digest eligibility (approaching expiry within 7 days)
      if (eligibility.eligibleForAdminDigest) {
        subscriptionsForAdminDigest.push(sub);
        adminDigestItems.push({
          userName: user.name,
          userEmail: user.email,
          planCode: sub.planCode,
          endDate: sub.endDate,
          daysRemaining: eligibility.daysRemaining,
          subscriptionId: String(sub._id),
        });
      }
    }

    summary.adminDigestItemsCount = adminDigestItems.length;

    // 4. Dispatch User Reminders (7-day reminder)
    for (const item of userReminderQueue) {
      const { subscription, user, daysRemaining } = item;

      if (!apply) {
        summary.userRemindersSent += 1;
        continue;
      }

      // Recheck fresh subscription status, renewal, and endDate immediately before dispatching
      const freshSub = await Subscription.findById(subscription._id);
      if (!freshSub || freshSub.status !== 'active' || !freshSub.endDate) {
        logStructured('warn', 'user_reminder_skipped_status_recheck_failed', {
          subscriptionId: String(subscription._id),
        });
        continue;
      }

      const freshDiffDays = (freshSub.endDate.getTime() - currentTime.getTime()) / DAY_MS;
      if (freshDiffDays < USER_REMINDER_MIN_DAYS || freshDiffDays > USER_REMINDER_MAX_DAYS) {
        logStructured('warn', 'user_reminder_skipped_timing_recheck_failed', {
          subscriptionId: String(subscription._id),
          freshDiffDays,
        });
        continue;
      }

      if (isUserReminderAlreadySent(freshSub.expiryReminder7d, freshSub.endDate)) {
        continue;
      }

      // Recheck user accounts for newer active renewal right before sending
      const freshUserSubs = await Subscription.find({ user: freshSub.user, status: 'active' });
      if (hasNewerActiveRenewal(freshSub, freshUserSubs)) {
        logStructured('info', 'user_reminder_skipped_renewal_recheck', {
          subscriptionId: String(subscription._id),
        });
        continue;
      }

      // In-app user notification creation (decoupled from email delivery success)
      try {
        const targetDateStr = freshSub.endDate.toISOString().slice(0, 10);
        await createNotification({
          recipient: freshSub.user,
          recipientRole: 'user',
          type: 'subscription_expiry_reminder',
          title: 'Subscription Expiring Soon',
          message: `Your ${freshSub.planCode === 'SIX_MONTHS' ? '6-Month' : '3-Month'} subscription expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} (${targetDateStr}). Renew now to maintain uninterrupted member access.`,
          link: '/membership',
          metadata: {
            subscriptionId: String(freshSub._id),
            planCode: freshSub.planCode,
            endDate: freshSub.endDate,
            daysRemaining,
          },
          dedupKey: `sub_exp_${freshSub._id}_${targetDateStr}`,
        });
      } catch (inAppErr) {
        logStructured('warn', 'user_in_app_reminder_failed', {
          subscriptionId: String(subscription._id),
          error: inAppErr.message,
        });
      }

      const sendResult = await sendSubscriptionExpiryReminderEmail({
        to: user.email,
        name: user.name,
        planCode: freshSub.planCode,
        endDate: freshSub.endDate,
        daysRemaining,
      });

      const attemptCount = (freshSub.expiryReminder7d?.attemptCount || 0) + 1;

      if (sendResult.success) {
        await Subscription.findByIdAndUpdate(freshSub._id, {
          $set: {
            'expiryReminder7d.sentAt': currentTime,
            'expiryReminder7d.deliveryStatus': 'sent',
            'expiryReminder7d.failureReason': null,
            'expiryReminder7d.targetEndDate': freshSub.endDate,
            'expiryReminder7d.attemptCount': attemptCount,
            'expiryReminder7d.lastAttemptAt': currentTime,
          },
        });
        summary.userRemindersSent += 1;
      } else {
        await Subscription.findByIdAndUpdate(freshSub._id, {
          $set: {
            'expiryReminder7d.deliveryStatus': 'failed',
            'expiryReminder7d.failureReason': sendResult.error || 'Delivery failed',
            'expiryReminder7d.targetEndDate': freshSub.endDate,
            'expiryReminder7d.attemptCount': attemptCount,
            'expiryReminder7d.lastAttemptAt': currentTime,
          },
        });
        summary.userRemindersFailed += 1;
        logStructured('error', 'user_reminder_dispatch_failed', {
          subscriptionId: String(freshSub._id),
          error: sendResult.error,
        });
      }
    }

    // 5. Dispatch Consolidated Admin Digest
    // Check if an admin digest for this daily reporting period has already been successfully sent
    const digestAlreadySentForToday = await isAdminDigestAlreadyDispatchedForDate(reportDateKey);

    if (digestAlreadySentForToday) {
      summary.adminDigestSkippedAlreadySent = true;
      summary.adminDigestStatus = 'already_sent_for_period';
      logStructured('info', 'admin_digest_skipped_already_sent_for_period', {
        reportDateKey,
      });
    } else if (adminDigestItems.length === 0) {
      // Do not send empty digest
      summary.adminDigestStatus = 'skipped_empty';
      logStructured('info', 'admin_digest_skipped_no_expiring_members', {
        reportDateKey,
      });
    } else {
      const adminRecipients = await resolveAdminRecipients();

      if (adminRecipients.length === 0) {
        summary.adminDigestStatus = 'failed_no_admins';
        logStructured('warn', 'admin_digest_no_recipients_found', {
          expiringCount: adminDigestItems.length,
        });
      } else {
        let allAdminDispatchesSucceeded = true;
        let lastAdminError = null;

        for (const admin of adminRecipients) {
          if (!apply) {
            summary.adminDigestsSent += 1;
            summary.adminDigestStatus = 'dry_run';
            continue;
          }

          const adminSendResult = await sendAdminSubscriptionExpiryDigestEmail({
            to: admin.email,
            adminName: admin.name,
            expiringSubscriptions: adminDigestItems,
            reportDate: currentTime,
          });

          if (adminSendResult.success) {
            summary.adminDigestsSent += 1;
          } else {
            allAdminDispatchesSucceeded = false;
            lastAdminError = adminSendResult.error;
            summary.adminDigestsFailed += 1;
            logStructured('error', 'admin_digest_dispatch_failed', {
              error: adminSendResult.error,
            });
          }
        }

        if (apply) {
          // In-app admin digest notification dispatch (independent of email status)
          try {
            await notifyActiveAdmins({
              type: 'admin_subscription_expiry_digest',
              title: 'Subscriptions Approaching Expiry',
              message: `${adminDigestItems.length} member subscription${adminDigestItems.length === 1 ? ' is' : 's are'} expiring within the next 7 days.`,
              link: '/admin/subscriptions',
              metadata: {
                reportDateKey,
                expiringCount: adminDigestItems.length,
              },
              dedupKeyPrefix: `admin_sub_exp_digest_${reportDateKey}`,
            });
          } catch (adminNotifErr) {
            logStructured('warn', 'admin_in_app_digest_failed', {
              reportDateKey,
              error: adminNotifErr.message,
            });
          }

          summary.adminDigestStatus = allAdminDispatchesSucceeded ? 'sent' : 'failed';
          const subIds = subscriptionsForAdminDigest.map((s) => s._id);

          await Subscription.updateMany(
            { _id: { $in: subIds } },
            [
              {
                $set: {
                  'adminExpiryReminder7d.sentAt': currentTime,
                  'adminExpiryReminder7d.deliveryStatus': allAdminDispatchesSucceeded ? 'sent' : 'failed',
                  'adminExpiryReminder7d.failureReason': allAdminDispatchesSucceeded ? null : (lastAdminError || 'Dispatch failed'),
                  'adminExpiryReminder7d.targetEndDate': '$endDate',
                  'adminExpiryReminder7d.lastAttemptAt': currentTime,
                  'adminExpiryReminder7d.lastDigestReportDate': reportDateKey,
                  'adminExpiryReminder7d.attemptCount': {
                    $add: [{ $ifNull: ['$adminExpiryReminder7d.attemptCount', 0] }, 1],
                  },
                },
              },
            ]
          );
        }
      }
    }

    summary.durationMs = Date.now() - startTime;
    logStructured('info', 'reminder_job_completed', summary);

    if (lockToken) {
      const finalStatus =
        summary.userRemindersFailed > 0 || summary.adminDigestsFailed > 0 ? 'failed' : 'success';
      await releaseJobLock({
        jobName: JOB_NAME,
        lockToken,
        status: finalStatus,
        summary,
        now: new Date(),
      });
      logStructured('info', 'job_lock_released', { status: finalStatus });
    }

    return summary;
  } catch (err) {
    summary.durationMs = Date.now() - startTime;
    logStructured('error', 'reminder_job_failed', { error: err.message });

    if (lockToken) {
      await releaseJobLock({
        jobName: JOB_NAME,
        lockToken,
        status: 'failed',
        summary: { ...summary, fatalError: err.message },
        now: new Date(),
      });
    }

    throw err;
  }
};

module.exports = {
  JOB_NAME,
  DAY_MS,
  SEVEN_DAYS_MS,
  USER_REMINDER_MIN_DAYS,
  USER_REMINDER_MAX_DAYS,
  toReportDateKey,
  resolveAdminRecipients,
  isUserReminderAlreadySent,
  hasNewerActiveRenewal,
  evaluateReminderEligibility,
  isAdminDigestAlreadyDispatchedForDate,
  runSubscriptionExpiryReminders,
};
