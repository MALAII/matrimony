/**
 * Phase 5C Scheduled Subscription-Expiry Profile Deactivation Script
 *
 * Purpose:
 * Marks the own MatrimonialProfile of a non-renewing, account-linked member `inactive`
 * ONLY after their subscription's 7-day grace period has ended and they have no newer
 * active or grace-period subscription.
 *
 * Safety & Business Invariants:
 * 1. Dry-run by default (`node scripts/deactivateExpiredProfilesPhase5C.js`).
 *    Requires explicit `--apply` CLI flag to perform database writes.
 * 2. Uses trusted subscription dates and the confirmed 7-day grace window (`evaluateOwnerSubscriptionExpiry`).
 * 3. Never deactivates profiles during the 7-day grace period.
 * 4. Never deactivates profiles of unpaid users who have never had an activated subscription.
 * 5. Never deactivates unlinked broker profiles (`user: null`).
 * 6. Never overwrites already inactive profiles (`profileStatus: 'inactive'`) or admin decisions.
 * 7. Sets auditable fields on deactivation:
 *    - `profileStatus = 'inactive'`
 *    - `deactivationReason = 'subscription_expired'`
 *    - `deactivatedAt = <timestamp>`
 * 8. Concurrency-safe: Supports atomic distributed lease locking via JobLock to prevent duplicate
 *    simultaneous runs across multi-instance production deployments.
 * 9. Structured JSON logging without any PII (names, phone numbers, emails, passwords).
 * 10. Fully idempotent and fails safely with non-zero exit code if any database error occurs.
 *
 * Production Scheduler Options:
 *   Option A (Cloud / System Cron):
 *     Schedule: `0 2 * * *` (daily at 02:00 UTC)
 *     Working Directory: `backend`
 *     Command: `node scripts/deactivateExpiredProfilesPhase5C.js --apply`
 *   Option B (In-Process Scheduler):
 *     Set `ENABLE_IN_PROCESS_SCHEDULER=true` in backend environment.
 */

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MatrimonialProfile = require('../models/MatrimonialProfile');
const Subscription = require('../models/Subscription');
const {
  ACCESS_CODES,
  evaluateSubscriptionAccess,
  evaluateOwnerSubscriptionExpiry,
} = require('../services/subscriptionAccessService');
const {
  acquireJobLock,
  releaseJobLock,
} = require('../services/jobLockService');

const JOB_NAME = 'subscription_expiry_profile_deactivation';

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
 * Core repeatable job logic to inspect and optionally deactivate account-linked profiles
 * whose owners' subscriptions have expired beyond the 7-day grace period without renewal.
 *
 * Exported so automated tests can verify dry-run, apply, idempotency, grace-period protection,
 * unpaid-user preservation, unlinked-broker preservation, and lock lease concurrency in complete isolation.
 *
 * @param {object} [options]
 * @param {Date} [options.now=new Date()]
 * @param {boolean} [options.apply=false]
 * @param {boolean} [options.acquireLock=false]
 * @param {string} [options.workerId]
 * @returns {Promise<object>}
 */
const runSubscriptionExpiryDeactivation = async ({
  now = new Date(),
  apply = false,
  acquireLock = false,
  workerId = `worker-${process.pid}`,
} = {}) => {
  const startTime = Date.now();
  const currentTime = now instanceof Date ? now : new Date(now);

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
        lockAcquired: false,
        skippedDueToLock: true,
        reason: lockResult.reason,
        activeLinkedProfilesChecked: 0,
        eligibleForDeactivationCount: 0,
        deactivatedCount: 0,
        skippedUnpaidCount: 0,
        skippedActiveOrGraceCount: 0,
        staleSubscriptionsExpiredCount: 0,
        deactivatedProfileIds: [],
        durationMs: Date.now() - startTime,
      };
    }

    lockToken = lockResult.lockToken;
    logStructured('info', 'job_lock_acquired', {
      workerId,
      expiresAt: lockResult.expiresAt,
    });
  }

  let summary = {
    mode: apply ? 'apply' : 'dry-run',
    evaluatedAt: currentTime,
    lockAcquired: Boolean(lockToken),
    activeLinkedProfilesChecked: 0,
    eligibleForDeactivationCount: 0,
    deactivatedCount: 0,
    skippedUnpaidCount: 0,
    skippedActiveOrGraceCount: 0,
    staleSubscriptionsExpiredCount: 0,
    deactivatedProfileIds: [],
    durationMs: 0,
  };

  try {
    // 1. Fetch only active, account-linked profiles (`user` is non-null, `profileStatus: 'active'`).
    //    Unlinked broker profiles (`user: null`) and already inactive profiles are excluded.
    const activeLinkedProfiles = await MatrimonialProfile.find({
      profileStatus: 'active',
      user: { $ne: null },
    });

    const validLinkedProfiles = (activeLinkedProfiles || []).filter(
      (p) => p && p.user && p.profileStatus === 'active'
    );

    summary.activeLinkedProfilesChecked = validLinkedProfiles.length;

    if (validLinkedProfiles.length === 0) {
      summary.durationMs = Date.now() - startTime;
      logStructured('info', 'deactivation_job_completed', summary);

      if (lockToken) {
        await releaseJobLock({
          jobName: JOB_NAME,
          lockToken,
          status: 'success',
          summary,
          now: new Date(),
        });
        logStructured('info', 'job_lock_released', { status: 'success' });
      }

      return summary;
    }

    // 2. Fetch all subscriptions for the candidate profile owners in a single batch query
    const ownerIds = validLinkedProfiles.map((p) => p.user._id || p.user);
    const allSubscriptions = await Subscription.find({
      user: { $in: ownerIds },
    });

    const subsByUserId = new Map();
    for (const sub of allSubscriptions || []) {
      if (!sub || !sub.user) continue;
      const uid = String(sub.user._id || sub.user);
      if (!subsByUserId.has(uid)) {
        subsByUserId.set(uid, []);
      }
      subsByUserId.get(uid).push(sub);
    }

    let eligibleForDeactivationCount = 0;
    let deactivatedCount = 0;
    let skippedUnpaidCount = 0;
    let skippedActiveOrGraceCount = 0;
    let staleSubscriptionsExpiredCount = 0;
    const deactivatedProfileIds = [];

    // 3. Evaluate each linked active profile owner's subscription history
    for (const profile of validLinkedProfiles) {
      const uid = String(profile.user._id || profile.user);
      const userSubs = subsByUserId.get(uid) || [];

      const expiryStatus = evaluateOwnerSubscriptionExpiry(userSubs, currentTime);

      if (!expiryStatus.hasEverSubscribed) {
        // Unpaid user who has never had an activated subscription: do NOT deactivate
        skippedUnpaidCount += 1;
        continue;
      }

      if (expiryStatus.hasEligibleSubscription || !expiryStatus.isExpiredBeyondGrace) {
        // Currently active or within the 7-day grace period: do NOT deactivate
        skippedActiveOrGraceCount += 1;
        continue;
      }

      eligibleForDeactivationCount += 1;

      if (apply) {
        // Atomically deactivate ONLY if profile is still 'active' (never overwrite manual/admin inactive status)
        const updatedProfile = await MatrimonialProfile.findOneAndUpdate(
          {
            _id: profile._id,
            user: profile.user._id || profile.user,
            profileStatus: 'active',
          },
          {
            $set: {
              profileStatus: 'inactive',
              deactivationReason: 'subscription_expired',
              deactivatedAt: currentTime,
            },
          },
          { new: true }
        );

        if (updatedProfile) {
          deactivatedCount += 1;
          deactivatedProfileIds.push(String(updatedProfile._id));
        }

        // Also mark any stale 'active' or 'grace_period' subscriptions for this user as 'expired'
        for (const sub of userSubs) {
          const subEval = evaluateSubscriptionAccess(sub, currentTime);
          if (
            subEval.code === ACCESS_CODES.SUBSCRIPTION_EXPIRED &&
            (sub.status === 'active' || sub.status === 'grace_period')
          ) {
            if (typeof sub.save === 'function') {
              sub.status = 'expired';
              await sub.save();
              staleSubscriptionsExpiredCount += 1;
            } else if (typeof Subscription.findOneAndUpdate === 'function') {
              await Subscription.findOneAndUpdate(
                { _id: sub._id },
                { $set: { status: 'expired' } }
              );
              staleSubscriptionsExpiredCount += 1;
            }
          }
        }
      } else {
        deactivatedProfileIds.push(String(profile._id));
      }
    }

    summary.eligibleForDeactivationCount = eligibleForDeactivationCount;
    summary.deactivatedCount = deactivatedCount;
    summary.skippedUnpaidCount = skippedUnpaidCount;
    summary.skippedActiveOrGraceCount = skippedActiveOrGraceCount;
    summary.staleSubscriptionsExpiredCount = staleSubscriptionsExpiredCount;
    summary.deactivatedProfileIds = deactivatedProfileIds;
    summary.durationMs = Date.now() - startTime;

    logStructured('info', 'deactivation_job_completed', {
      mode: summary.mode,
      evaluatedAt: summary.evaluatedAt,
      checked: summary.activeLinkedProfilesChecked,
      eligible: summary.eligibleForDeactivationCount,
      deactivated: summary.deactivatedCount,
      skippedUnpaid: summary.skippedUnpaidCount,
      skippedActiveOrGrace: summary.skippedActiveOrGraceCount,
      staleSubsExpired: summary.staleSubscriptionsExpiredCount,
      durationMs: summary.durationMs,
    });

    if (lockToken) {
      await releaseJobLock({
        jobName: JOB_NAME,
        lockToken,
        status: 'success',
        summary,
        now: new Date(),
      });
      logStructured('info', 'job_lock_released', { status: 'success' });
    }

    return summary;
  } catch (jobErr) {
    summary.durationMs = Date.now() - startTime;
    logStructured('error', 'deactivation_job_failed', {
      error: jobErr.message,
      durationMs: summary.durationMs,
    });

    if (lockToken) {
      try {
        await releaseJobLock({
          jobName: JOB_NAME,
          lockToken,
          status: 'failed',
          summary: { error: jobErr.message },
          now: new Date(),
        });
        logStructured('info', 'job_lock_released', { status: 'failed' });
      } catch (_) {}
    }

    throw jobErr;
  }
};

async function runCli() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const noLock = args.includes('--no-lock');

  console.log('=== Phase 5C Subscription-Expiry Profile Deactivation Job ===');
  console.log(`Mode: ${isApply ? 'APPLY (Live Writes Enabled)' : 'DRY-RUN (Default Read-Only)'}`);
  console.log(`Lock: ${noLock ? 'Disabled (--no-lock)' : 'Enabled'}\n`);

  if (!process.env.MONGODB_URI) {
    logStructured('error', 'missing_mongodb_uri');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
    const summary = await runSubscriptionExpiryDeactivation({
      now: new Date(),
      apply: isApply,
      acquireLock: !noLock,
    });

    logStructured('info', 'cli_execution_finished', {
      deactivatedCount: summary.deactivatedCount,
      skippedUnpaidCount: summary.skippedUnpaidCount,
      skippedActiveOrGraceCount: summary.skippedActiveOrGraceCount,
    });

    await mongoose.disconnect();
    process.exit(summary.skippedDueToLock ? 2 : 0);
  } catch (err) {
    logStructured('error', 'cli_fatal_error', { message: err.message });
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  JOB_NAME,
  logStructured,
  runSubscriptionExpiryDeactivation,
};
