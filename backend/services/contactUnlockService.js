const mongoose = require('mongoose');
const MatrimonialProfile = require('../models/MatrimonialProfile');
const CreditCycle = require('../models/CreditCycle');
const ContactUnlock = require('../models/ContactUnlock');
const {
  ACCESS_CODES,
  checkUserDirectoryAccess,
  getExpiredBeyondGraceOwnerIds,
} = require('./subscriptionAccessService');
const {
  getOrCreateCurrentCreditCycle,
  formatCreditCycleDTO,
} = require('./creditCycleService');

const PHONE_FORMAT_REGEX = /^[+]?[\d\s()-]{7,25}$/;

const UNLOCK_ERROR_CODES = {
  INVALID_PROFILE_ID: 'INVALID_PROFILE_ID',
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  SELF_PROFILE_UNLOCK_DENIED: 'SELF_PROFILE_UNLOCK_DENIED',
  PROFILE_NOT_ELIGIBLE: 'PROFILE_NOT_ELIGIBLE',
  PHONE_NOT_AVAILABLE: 'PHONE_NOT_AVAILABLE',
  GRACE_PERIOD_CONTACTS_LOCKED: 'GRACE_PERIOD_CONTACTS_LOCKED',
  CREDITS_EXHAUSTED: 'CREDITS_EXHAUSTED',
};

/**
 * Helper to attempt starting a Mongoose client session for ACID transactions.
 * Safely falls back to null if the connection is not active or transactions are unsupported.
 */
const tryStartSession = async () => {
  if (typeof mongoose.startSession !== 'function') {
    return null;
  }
  try {
    const session = await mongoose.startSession();
    return session;
  } catch (err) {
    const msg = err && err.message ? err.message : '';
    const isTxUnsupported =
      msg.includes('Transaction numbers are only allowed on a replica set') ||
      msg.includes('transactions are not supported');

    if (isTxUnsupported) {
      const unsuppErr = new Error(
        'Database transactions are required for contact credit deductions. Please ensure MongoDB is running as a replica set.'
      );
      unsuppErr.statusCode = 503;
      unsuppErr.code = 'TRANSACTIONS_UNSUPPORTED';
      throw unsuppErr;
    }
    throw err;
  }
};

/**
 * Strictly validates and extracts the candidate's own phone number from `MatrimonialProfile.candidatePhone`.
 *
 * Security Rules:
 * - Reads ONLY `profile.candidatePhone`.
 * - NEVER substitutes `user.email`, `candidateEmail`, broker phone, or any other field.
 * - Rejects empty strings, strings exceeding 25 characters, strings containing '@',
 *   or strings without 7 to 15 numeric digits.
 *
 * @param {object} profile
 * @returns {string|null}
 */
const extractValidCandidatePhone = (profile) => {
  if (!profile || typeof profile !== 'object') return null;

  const rawPhone = profile.candidatePhone;
  if (typeof rawPhone !== 'string') return null;

  const trimmed = rawPhone.trim();
  if (trimmed.length === 0 || trimmed.length > 25) return null;
  if (trimmed.includes('@')) return null;
  if (!PHONE_FORMAT_REGEX.test(trimmed)) return null;

  const digitCount = (trimmed.match(/\d/g) || []).length;
  if (digitCount < 7 || digitCount > 15) return null;

  return trimmed;
};

/**
 * Checks whether a target profile is eligible for directory viewing and contact unlocking.
 */
const isTargetProfileEligible = (profile) => {
  if (!profile || typeof profile !== 'object') return false;
  if (profile.profileStatus !== 'active') return false;
  if (profile.source === 'direct') return true;
  if (profile.source === 'broker' && profile.approvalStatus === 'approved') return true;
  return false;
};

/**
 * Helper to identify duplicate-key (E11000) errors across driver versions.
 */
const isDuplicateKeyError = (err) => {
  if (!err) return false;
  if (err.code === 11000) return true;
  if (err.writeErrors && err.writeErrors.some((e) => e.code === 11000)) return true;
  if (err.errorResponse && err.errorResponse.code === 11000) return true;
  const msg = String(err.message || '');
  return msg.includes('E11000') || msg.includes('duplicate key');
};

/**
 * Core internal workflow to unlock a candidate contact within a MongoDB transaction.
 *
 * Atomically deducts 1 credit and creates the ContactUnlock record.
 * If ContactUnlock creation throws a duplicate-key error or write error, it lets the error
 * propagate out of session.withTransaction so MongoDB rolls back the credit deduction cleanly.
 * Does NOT perform compensating writes or reads on an aborted transaction.
 */
const executeContactUnlockCore = async ({
  viewerUserId,
  targetProfile,
  candidatePhone,
  subscription,
  now,
  session,
}) => {
  const queryOpts = { session };

  // 1. Resolve or create the viewer's current monthly CreditCycle within transaction
  const cycleResult = await getOrCreateCurrentCreditCycle(subscription, now, session);
  if (!cycleResult.eligible || !cycleResult.cycle) {
    const err = new Error(cycleResult.message || 'No active credit cycle available.');
    err.statusCode = 403;
    err.code = cycleResult.code || ACCESS_CODES.NO_SUBSCRIPTION;
    throw err;
  }

  const currentCycle = cycleResult.cycle;

  // 2. Check for an existing lifetime unlock for { viewerUser, targetProfile }
  const unlockFilter = {
    viewerUser: viewerUserId,
    targetProfile: targetProfile._id,
  };

  const existingUnlock = await ContactUnlock.findOne(unlockFilter, null, queryOpts);
  if (existingUnlock) {
    return {
      profileId: String(targetProfile._id),
      candidatePhone,
      alreadyUnlocked: true,
      creditsCharged: 0,
      unlockedAt: existingUnlock.unlockedAt,
      credits: formatCreditCycleDTO(currentCycle),
    };
  }

  // 3. Atomically deduct 1 credit from the current CreditCycle ONLY if creditsRemaining >= 1
  const updatedCycle = await CreditCycle.findOneAndUpdate(
    {
      _id: currentCycle._id,
      creditsRemaining: { $gte: 1 },
      creditsUsed: { $lt: currentCycle.creditsAllocated },
    },
    {
      $inc: {
        creditsUsed: 1,
        creditsRemaining: -1,
      },
    },
    { new: true, session }
  );

  if (!updatedCycle) {
    const err = new Error(
      'You have used all 50 contact-view credits for your current monthly cycle.'
    );
    err.statusCode = 403;
    err.code = UNLOCK_ERROR_CODES.CREDITS_EXHAUSTED;
    throw err;
  }

  // 4. Create the lifetime ContactUnlock record (enforced by unique compound index on { viewerUser, targetProfile })
  const unlockPayload = {
    viewerUser: viewerUserId,
    targetProfile: targetProfile._id,
    subscription: subscription._id,
    creditCycle: updatedCycle._id,
    cycleNumber: updatedCycle.cycleNumber,
    creditsCharged: 1,
    unlockedAt: now instanceof Date ? now : new Date(now),
  };

  // If creation fails (e.g. duplicate key collision), let error propagate so transaction aborts
  // and rolls back the updatedCycle deduction automatically.
  const createdArr = await ContactUnlock.create([unlockPayload], { session });
  const createdUnlock = Array.isArray(createdArr) ? createdArr[0] : createdArr;

  return {
    profileId: String(targetProfile._id),
    candidatePhone,
    alreadyUnlocked: false,
    creditsCharged: 1,
    unlockedAt: createdUnlock.unlockedAt,
    credits: formatCreditCycleDTO(updatedCycle),
  };
};

/**
 * Unlocks a target profile's candidate phone number for an authenticated active subscriber.
 *
 * Enforces:
 * 1. Valid profile ObjectId.
 * 2. Active, date-valid subscription (denies grace-period, expired, pending, or missing subscriptions).
 * 3. Target profile exists, is not viewer's own profile, is active & eligible, and its owner
 *    has not expired beyond the 7-day grace period (evaluated scoping strictly to target owner).
 * 4. Target profile has a valid `candidatePhone` (never charges a credit if missing/invalid).
 * 5. Atomic transaction-based 1-credit deduction on first unlock; 0 credits on repeat view.
 * 6. Safe external recovery if a concurrent request created the unlock in a raced transaction.
 *
 * @param {{ viewerUserId: any, targetProfileId: string, now?: Date }} params
 */
const unlockCandidateContact = async ({
  viewerUserId,
  targetProfileId,
  now = new Date(),
}) => {
  const currentTime = now instanceof Date ? now : new Date(now);

  // 1. Validate targetProfileId format
  if (!targetProfileId || !mongoose.Types.ObjectId.isValid(String(targetProfileId))) {
    const err = new Error('Invalid profile ID format.');
    err.statusCode = 400;
    err.code = UNLOCK_ERROR_CODES.INVALID_PROFILE_ID;
    throw err;
  }

  // 2. Verify viewer's subscription access (must be active and date-valid, NOT in grace period)
  const access = await checkUserDirectoryAccess(viewerUserId, currentTime);

  if (!access.allowed) {
    const err = new Error(access.message);
    err.statusCode = 403;
    err.code = access.code;
    throw err;
  }

  if (access.inGracePeriod || access.accessMode !== 'active' || !access.subscription) {
    const err = new Error(
      'Contact numbers cannot be unlocked during the 7-day subscription grace period. Please renew your subscription to view contact details.'
    );
    err.statusCode = 403;
    err.code = UNLOCK_ERROR_CODES.GRACE_PERIOD_CONTACTS_LOCKED;
    throw err;
  }

  // 3. Fetch target profile and verify eligibility
  const targetProfile = await MatrimonialProfile.findById(targetProfileId);
  if (!targetProfile) {
    const err = new Error('Matrimonial profile not found.');
    err.statusCode = 404;
    err.code = UNLOCK_ERROR_CODES.PROFILE_NOT_FOUND;
    throw err;
  }

  // Prevent unlocking own profile
  if (
    targetProfile.user &&
    String(targetProfile.user._id || targetProfile.user) === String(viewerUserId)
  ) {
    const err = new Error('You cannot unlock contact details for your own profile.');
    err.statusCode = 400;
    err.code = UNLOCK_ERROR_CODES.SELF_PROFILE_UNLOCK_DENIED;
    throw err;
  }

  // Enforce active + source/approval eligibility
  if (!isTargetProfileEligible(targetProfile)) {
    const err = new Error('This profile is not active or eligible for contact viewing.');
    err.statusCode = 403;
    err.code = UNLOCK_ERROR_CODES.PROFILE_NOT_ELIGIBLE;
    throw err;
  }

  // API-side expiry check scoping strictly to the target profile owner (zero collection scan)
  if (targetProfile.user) {
    const targetOwnerId = targetProfile.user._id || targetProfile.user;
    const { expiredOwnerIdSet } = await getExpiredBeyondGraceOwnerIds(
      [targetOwnerId],
      currentTime
    );
    const ownerIdStr = String(targetOwnerId);
    if (expiredOwnerIdSet.has(ownerIdStr)) {
      const err = new Error('This profile is no longer active in the member directory.');
      err.statusCode = 403;
      err.code = UNLOCK_ERROR_CODES.PROFILE_NOT_ELIGIBLE;
      throw err;
    }
  }

  // 4. Verify candidatePhone before touching credits (missing/invalid phone NEVER consumes a credit)
  const candidatePhone = extractValidCandidatePhone(targetProfile);
  if (!candidatePhone) {
    const err = new Error(
      'Candidate phone number is not available for this profile. No credit was deducted.'
    );
    err.statusCode = 422;
    err.code = UNLOCK_ERROR_CODES.PHONE_NOT_AVAILABLE;
    throw err;
  }

  // Fast-path: Check if already unlocked before starting a transaction
  const fastPathUnlock = await ContactUnlock.findOne({
    viewerUser: viewerUserId,
    targetProfile: targetProfile._id,
  });
  if (fastPathUnlock) {
    const balance = await getViewerCreditBalance(viewerUserId, currentTime);
    return {
      profileId: String(targetProfile._id),
      candidatePhone,
      alreadyUnlocked: true,
      creditsCharged: 0,
      unlockedAt: fastPathUnlock.unlockedAt,
      credits: balance.credits,
    };
  }

  // 5. Execute atomic unlock inside a MongoDB transaction
  const session = await tryStartSession();
  if (!session) {
    const err = new Error(
      'Database transaction support is required for atomic contact credit deductions.'
    );
    err.statusCode = 503;
    err.code = 'TRANSACTIONS_UNSUPPORTED';
    throw err;
  }

  let txResult = null;
  let duplicateKeyError = null;

  try {
    await session.withTransaction(async () => {
      txResult = await executeContactUnlockCore({
        viewerUserId,
        targetProfile,
        candidatePhone,
        subscription: access.subscription,
        now: currentTime,
        session,
      });
    });
  } catch (txErr) {
    if (isDuplicateKeyError(txErr)) {
      duplicateKeyError = txErr;
    } else {
      const msg = txErr && txErr.message ? txErr.message : '';
      const isTxUnsupported =
        msg.includes('Transaction numbers are only allowed on a replica set') ||
        msg.includes('transactions are not supported');

      if (isTxUnsupported) {
        const unsuppErr = new Error(
          'Database transactions are required for contact credit deductions. Please ensure MongoDB is running as a replica set.'
        );
        unsuppErr.statusCode = 503;
        unsuppErr.code = 'TRANSACTIONS_UNSUPPORTED';
        throw unsuppErr;
      }

      // Re-throw arbitrary transaction errors (do not silently switch to non-transactional fallback)
      throw txErr;
    }
  } finally {
    try {
      await session.endSession();
    } catch (_) {}
  }

  if (txResult) {
    return txResult;
  }

  // 6. If the transaction aborted due to a duplicate-key error, recover outside the aborted transaction
  if (duplicateKeyError) {
    // Confirm an existing ContactUnlock record actually exists for the SAME viewer and target profile
    const racedUnlock = await ContactUnlock.findOne({
      viewerUser: viewerUserId,
      targetProfile: targetProfile._id,
    });

    if (racedUnlock) {
      // Revalidate viewer current subscription eligibility
      const recheckAccess = await checkUserDirectoryAccess(viewerUserId, currentTime);
      if (
        !recheckAccess.allowed ||
        recheckAccess.inGracePeriod ||
        recheckAccess.accessMode !== 'active'
      ) {
        const err = new Error('Active subscription required to view contact details.');
        err.statusCode = 403;
        err.code = recheckAccess.code || UNLOCK_ERROR_CODES.GRACE_PERIOD_CONTACTS_LOCKED;
        throw err;
      }

      // Revalidate target profile eligibility
      const recheckProfile = await MatrimonialProfile.findById(targetProfile._id);
      if (!recheckProfile || !isTargetProfileEligible(recheckProfile)) {
        const err = new Error('This profile is not active or eligible for contact viewing.');
        err.statusCode = 403;
        err.code = UNLOCK_ERROR_CODES.PROFILE_NOT_ELIGIBLE;
        throw err;
      }

      if (recheckProfile.user) {
        const targetOwnerId = recheckProfile.user._id || recheckProfile.user;
        const { expiredOwnerIdSet } = await getExpiredBeyondGraceOwnerIds(
          [targetOwnerId],
          currentTime
        );
        if (expiredOwnerIdSet.has(String(targetOwnerId))) {
          const err = new Error('This profile is no longer active in the member directory.');
          err.statusCode = 403;
          err.code = UNLOCK_ERROR_CODES.PROFILE_NOT_ELIGIBLE;
          throw err;
        }
      }

      const freshBalance = await getViewerCreditBalance(viewerUserId, currentTime);

      return {
        profileId: String(targetProfile._id),
        candidatePhone,
        alreadyUnlocked: true,
        creditsCharged: 0,
        unlockedAt: racedUnlock.unlockedAt,
        credits: freshBalance.credits,
      };
    }

    // If no matching unlock exists, or the duplicate error relates to a different constraint,
    // handle the error safely rather than incorrectly granting access.
    const safeErr = new Error(
      'Unlock request encountered a duplicate constraint conflict without a matching unlock record. Access denied.'
    );
    safeErr.statusCode = 409;
    safeErr.code = 'DUPLICATE_KEY_CONFLICT';
    throw safeErr;
  }
};

/**
 * Returns the signed-in member's current credit-cycle summary if they have an active subscription.
 */
const getViewerCreditBalance = async (viewerUserId, now = new Date()) => {
  const currentTime = now instanceof Date ? now : new Date(now);
  const access = await checkUserDirectoryAccess(viewerUserId, currentTime);

  if (!access.allowed) {
    return {
      allowed: false,
      code: access.code,
      accessMode: null,
      inGracePeriod: false,
      canUnlockContacts: false,
      message: access.message,
      credits: null,
    };
  }

  if (access.inGracePeriod || access.accessMode !== 'active' || !access.subscription) {
    return {
      allowed: true,
      code: ACCESS_CODES.GRACE_PERIOD,
      accessMode: 'grace_period',
      inGracePeriod: true,
      canUnlockContacts: false,
      message:
        'You are in your 7-day subscription grace period. Profile browsing is permitted, but contact unlocking is disabled until renewal.',
      credits: null,
    };
  }

  const cycleResult = await getOrCreateCurrentCreditCycle(access.subscription, currentTime);
  if (!cycleResult.eligible || !cycleResult.cycle) {
    return {
      allowed: true,
      code: access.code,
      accessMode: 'active',
      inGracePeriod: false,
      canUnlockContacts: false,
      message: cycleResult.message,
      credits: null,
    };
  }

  return {
    allowed: true,
    code: ACCESS_CODES.ACTIVE,
    accessMode: 'active',
    inGracePeriod: false,
    canUnlockContacts: cycleResult.cycle.creditsRemaining > 0,
    message: 'Active subscription credit balance.',
    credits: formatCreditCycleDTO(cycleResult.cycle),
  };
};

module.exports = {
  UNLOCK_ERROR_CODES,
  extractValidCandidatePhone,
  isTargetProfileEligible,
  unlockCandidateContact,
  getViewerCreditBalance,
};
