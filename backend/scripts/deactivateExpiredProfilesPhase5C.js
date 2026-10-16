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
 * 8. Fully idempotent and fails safely with non-zero exit code if any database error occurs.
 *
 * Hosting Scheduler Configuration (e.g. Render Cron Job / GitHub Actions / Linux cron):
 *   Schedule: `0 * * * *` (hourly) or `0 2 * * *` (daily at 02:00 UTC)
 *   Working Directory: `backend`
 *   Command: `node scripts/deactivateExpiredProfilesPhase5C.js --apply`
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

/**
 * Core repeatable job logic to inspect and optionally deactivate account-linked profiles
 * whose owners' subscriptions have expired beyond the 7-day grace period without renewal.
 *
 * Exported so automated tests can verify dry-run, apply, idempotency, grace-period protection,
 * unpaid-user preservation, and unlinked-broker preservation in complete isolation.
 *
 * @param {{ now?: Date, apply?: boolean }} [options]
 */
const runSubscriptionExpiryDeactivation = async ({
  now = new Date(),
  apply = false,
} = {}) => {
  const currentTime = now instanceof Date ? now : new Date(now);

  // 1. Fetch only active, account-linked profiles (`user` is non-null, `profileStatus: 'active'`).
  //    Unlinked broker profiles (`user: null`) and already inactive profiles are excluded.
  const activeLinkedProfiles = await MatrimonialProfile.find({
    profileStatus: 'active',
    user: { $ne: null },
  });

  const validLinkedProfiles = (activeLinkedProfiles || []).filter(
    (p) => p && p.user && p.profileStatus === 'active'
  );

  if (validLinkedProfiles.length === 0) {
    return {
      mode: apply ? 'apply' : 'dry-run',
      evaluatedAt: currentTime,
      activeLinkedProfilesChecked: 0,
      eligibleForDeactivationCount: 0,
      deactivatedCount: 0,
      skippedUnpaidCount: 0,
      skippedActiveOrGraceCount: 0,
      deactivatedProfileIds: [],
    };
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
          } else if (typeof Subscription.findOneAndUpdate === 'function') {
            await Subscription.findOneAndUpdate(
              { _id: sub._id },
              { $set: { status: 'expired' } }
            );
          }
        }
      }
    } else {
      deactivatedProfileIds.push(String(profile._id));
    }
  }

  return {
    mode: apply ? 'apply' : 'dry-run',
    evaluatedAt: currentTime,
    activeLinkedProfilesChecked: validLinkedProfiles.length,
    eligibleForDeactivationCount,
    deactivatedCount,
    skippedUnpaidCount,
    skippedActiveOrGraceCount,
    deactivatedProfileIds,
  };
};

async function runCli() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');

  console.log('=== Phase 5C Subscription-Expiry Profile Deactivation Job ===');
  console.log(`Mode: ${isApply ? 'APPLY (Live Writes Enabled)' : 'DRY-RUN (Default Read-Only)'}\n`);

  if (!process.env.MONGODB_URI) {
    console.error('[Error] MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
    const summary = await runSubscriptionExpiryDeactivation({
      now: new Date(),
      apply: isApply,
    });

    console.log('Job Summary:', JSON.stringify(summary, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(`[Deactivation Job Error] ${err.message}`);
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
  runSubscriptionExpiryDeactivation,
};
