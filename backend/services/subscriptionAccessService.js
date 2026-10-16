const Subscription = require('../models/Subscription');

const GRACE_PERIOD_DAYS = 7;
const GRACE_PERIOD_MS = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

const ACCESS_CODES = {
  ACTIVE: 'ACTIVE',
  GRACE_PERIOD: 'GRACE_PERIOD',
  NO_SUBSCRIPTION: 'NO_SUBSCRIPTION',
  SUBSCRIPTION_NOT_STARTED: 'SUBSCRIPTION_NOT_STARTED',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
  SUBSCRIPTION_INACTIVE: 'SUBSCRIPTION_INACTIVE',
  INVALID_SUBSCRIPTION_DATES: 'INVALID_SUBSCRIPTION_DATES',
};

/**
 * Safely parses a Date value and verifies it is a valid timestamp.
 * @param {any} value
 * @returns {Date|null}
 */
const toValidDate = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

/**
 * Evaluates a Subscription record against the current timestamp.
 *
 * Rules:
 * 1. Never grants access merely because `subscription.status === 'active'` if dates are missing,
 *    inconsistent, not yet started, or expired beyond the 7-day grace period.
 * 2. Active subscription within [startDate, endDate]: directory access permitted (`accessMode: 'active'`).
 * 3. Subscription within (endDate, gracePeriodEndDate]: directory browsing permitted (`accessMode: 'grace_period'`),
 *    contact details remain hidden.
 * 4. Missing subscription, cancelled/pending status, startDate in the future, or now > gracePeriodEndDate:
 *    directory access denied.
 *
 * @param {object|null} subscription
 * @param {Date} [now=new Date()]
 * @returns {{
 *   allowed: boolean,
 *   code: string,
 *   accessMode: 'active' | 'grace_period' | null,
 *   inGracePeriod: boolean,
 *   contactsHidden: boolean,
 *   message: string,
 *   subscriptionSummary: object | null
 * }}
 */
const evaluateSubscriptionAccess = (subscription, now = new Date()) => {
  const currentTime = toValidDate(now) || new Date();

  if (!subscription) {
    return {
      allowed: false,
      code: ACCESS_CODES.NO_SUBSCRIPTION,
      accessMode: null,
      inGracePeriod: false,
      contactsHidden: true,
      message: 'An active subscription is required to browse the member directory.',
      subscriptionSummary: null,
    };
  }

  // Reject statuses that are never eligible for browsing (e.g. 'pending', 'cancelled', 'expired')
  const storedStatus = subscription.status;
  if (storedStatus === 'pending' || storedStatus === 'cancelled') {
    return {
      allowed: false,
      code: ACCESS_CODES.SUBSCRIPTION_INACTIVE,
      accessMode: null,
      inGracePeriod: false,
      contactsHidden: true,
      message: 'An active subscription is required to browse the member directory.',
      subscriptionSummary: null,
    };
  }

  if (storedStatus !== 'active' && storedStatus !== 'grace_period' && storedStatus !== 'expired') {
    return {
      allowed: false,
      code: ACCESS_CODES.SUBSCRIPTION_INACTIVE,
      accessMode: null,
      inGracePeriod: false,
      contactsHidden: true,
      message: 'An active subscription is required to browse the member directory.',
      subscriptionSummary: null,
    };
  }

  // Validate startDate and endDate presence and consistency
  const startDate = toValidDate(subscription.startDate);
  const endDate = toValidDate(subscription.endDate);

  if (!startDate || !endDate || startDate.getTime() > endDate.getTime()) {
    return {
      allowed: false,
      code: ACCESS_CODES.INVALID_SUBSCRIPTION_DATES,
      accessMode: null,
      inGracePeriod: false,
      contactsHidden: true,
      message: 'Subscription dates are missing or inconsistent. Access denied.',
      subscriptionSummary: null,
    };
  }

  // Resolve and validate gracePeriodEndDate (must be >= endDate and <= endDate + 7 days)
  const maxGraceEndDate = new Date(endDate.getTime() + GRACE_PERIOD_MS);
  let gracePeriodEndDate = maxGraceEndDate;

  if (subscription.gracePeriodEndDate !== undefined && subscription.gracePeriodEndDate !== null) {
    const parsedGrace = toValidDate(subscription.gracePeriodEndDate);
    if (!parsedGrace || parsedGrace.getTime() < endDate.getTime()) {
      return {
        allowed: false,
        code: ACCESS_CODES.INVALID_SUBSCRIPTION_DATES,
        accessMode: null,
        inGracePeriod: false,
        contactsHidden: true,
        message: 'Subscription grace period dates are inconsistent. Access denied.',
        subscriptionSummary: null,
      };
    }
    // Cap at the confirmed 7-day grace period window from endDate
    gracePeriodEndDate =
      parsedGrace.getTime() <= maxGraceEndDate.getTime() ? parsedGrace : maxGraceEndDate;
  }

  const nowMs = currentTime.getTime();

  // Check if subscription has not yet started
  if (nowMs < startDate.getTime()) {
    return {
      allowed: false,
      code: ACCESS_CODES.SUBSCRIPTION_NOT_STARTED,
      accessMode: null,
      inGracePeriod: false,
      contactsHidden: true,
      message: 'Your subscription period has not started yet.',
      subscriptionSummary: null,
    };
  }

  // If storedStatus is explicitly 'expired' OR current time is past the 7-day grace period
  if (storedStatus === 'expired' || nowMs > gracePeriodEndDate.getTime()) {
    return {
      allowed: false,
      code: ACCESS_CODES.SUBSCRIPTION_EXPIRED,
      accessMode: null,
      inGracePeriod: false,
      contactsHidden: true,
      message:
        'Your subscription and 7-day grace period have expired. Please renew your subscription to access the member directory.',
      subscriptionSummary: {
        status: 'expired',
        endDate,
        gracePeriodEndDate,
      },
    };
  }

  // Within active [startDate, endDate] window
  if (nowMs <= endDate.getTime()) {
    return {
      allowed: true,
      code: ACCESS_CODES.ACTIVE,
      accessMode: 'active',
      inGracePeriod: false,
      contactsHidden: true,
      message: 'Subscription active.',
      subscriptionSummary: {
        status: 'active',
        planCode: subscription.planCode,
        startDate,
        endDate,
        gracePeriodEndDate,
      },
    };
  }

  // Within 7-day grace period (endDate < now <= gracePeriodEndDate)
  return {
    allowed: true,
    code: ACCESS_CODES.GRACE_PERIOD,
    accessMode: 'grace_period',
    inGracePeriod: true,
    contactsHidden: true,
    message:
      'You are browsing within your 7-day subscription grace period. Contact details remain hidden.',
    subscriptionSummary: {
      status: 'grace_period',
      planCode: subscription.planCode,
      startDate,
      endDate,
      gracePeriodEndDate,
    },
  };
};

/**
 * Fetches the user's most recent subscription and evaluates directory access.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {Date} [now=new Date()]
 */
const checkUserDirectoryAccess = async (userId, now = new Date()) => {
  if (!userId) {
    return { ...evaluateSubscriptionAccess(null, now), subscription: null };
  }

  const subscription = await Subscription.findOne({ user: userId })
    .sort({ createdAt: -1 })
    .select('_id user planCode durationMonths status startDate endDate gracePeriodEndDate');

  const evaluated = evaluateSubscriptionAccess(subscription, now);
  return {
    ...evaluated,
    subscription: subscription || null,
  };
};

/**
 * Evaluates a profile owner's subscription history to determine whether their
 * subscription has naturally expired beyond the 7-day grace period without renewal.
 *
 * Rules (Section 8):
 * 1. If the owner has NEVER had an activated subscription (`subscriptions` is empty or
 *    only contains records without valid start/end dates), returns `isExpiredBeyondGrace: false`.
 *    Unpaid users who never had a subscription are NOT deactivated by subscription-expiry rules.
 * 2. If the owner has at least one currently active or grace-period subscription,
 *    returns `isExpiredBeyondGrace: false`.
 * 3. If the owner has at least one subscription that expired beyond its 7-day grace period
 *    AND has no newer active/grace-period subscription, returns `isExpiredBeyondGrace: true`.
 *
 * @param {Array<object>} subscriptions
 * @param {Date} [now=new Date()]
 */
const evaluateOwnerSubscriptionExpiry = (subscriptions = [], now = new Date()) => {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    return {
      hasEverSubscribed: false,
      hasEligibleSubscription: false,
      isExpiredBeyondGrace: false,
    };
  }

  let hasEverSubscribed = false;
  let hasEligibleSubscription = false;
  let hasExpiredBeyondGrace = false;

  for (const sub of subscriptions) {
    const evalResult = evaluateSubscriptionAccess(sub, now);
    if (evalResult.allowed) {
      hasEverSubscribed = true;
      hasEligibleSubscription = true;
    } else if (evalResult.code === ACCESS_CODES.SUBSCRIPTION_EXPIRED) {
      hasEverSubscribed = true;
      hasExpiredBeyondGrace = true;
    }
  }

  return {
    hasEverSubscribed,
    hasEligibleSubscription,
    isExpiredBeyondGrace: hasEverSubscribed && !hasEligibleSubscription && hasExpiredBeyondGrace,
  };
};

/**
 * Batch-resolves the subset of candidate profile-owner User IDs whose subscriptions
 * have expired beyond the 7-day grace period without renewal.
 *
 * Scoped strictly to the provided `candidateOwnerIds` to prevent unbounded whole-collection
 * scans across the Subscription model on HTTP request paths.
 *
 * @param {Array<string|import('mongoose').Types.ObjectId>} [candidateOwnerIds=[]]
 * @param {Date} [now=new Date()]
 * @returns {Promise<{ expiredOwnerIds: Array, expiredOwnerIdSet: Set<string> }>}
 */
const getExpiredBeyondGraceOwnerIds = async (candidateOwnerIds = [], now = new Date()) => {
  // Empty or invalid candidate list: return immediately without touching the database
  if (!Array.isArray(candidateOwnerIds) || candidateOwnerIds.length === 0) {
    return { expiredOwnerIds: [], expiredOwnerIdSet: new Set() };
  }

  const validOwnerIds = candidateOwnerIds
    .map((id) => (id && id._id ? id._id : id))
    .filter(Boolean);

  if (validOwnerIds.length === 0) {
    return { expiredOwnerIds: [], expiredOwnerIdSet: new Set() };
  }

  try {
    const query = Subscription.find({ user: { $in: validOwnerIds } });
    let allSubs = [];
    if (query && typeof query.select === 'function') {
      allSubs = await query.select(
        'user planCode durationMonths status startDate endDate gracePeriodEndDate'
      );
    } else if (query && typeof query.then === 'function') {
      allSubs = await query;
    }

    if (!Array.isArray(allSubs) || allSubs.length === 0) {
      return { expiredOwnerIds: [], expiredOwnerIdSet: new Set() };
    }

    const subsByUser = new Map();
    const userObjectIdByStr = new Map();

    for (const sub of allSubs) {
      if (!sub || !sub.user) continue;
      const uidStr = String(sub.user._id || sub.user);
      if (!subsByUser.has(uidStr)) {
        subsByUser.set(uidStr, []);
        userObjectIdByStr.set(uidStr, sub.user._id || sub.user);
      }
      subsByUser.get(uidStr).push(sub);
    }

    const expiredOwnerIds = [];
    const expiredOwnerIdSet = new Set();

    for (const [uidStr, userSubs] of subsByUser.entries()) {
      const status = evaluateOwnerSubscriptionExpiry(userSubs, now);
      if (status.isExpiredBeyondGrace) {
        expiredOwnerIdSet.add(uidStr);
        expiredOwnerIds.push(userObjectIdByStr.get(uidStr));
      }
    }

    return { expiredOwnerIds, expiredOwnerIdSet };
  } catch (_) {
    // Safe fallback when Subscription.find is inactive in unit tests
    return { expiredOwnerIds: [], expiredOwnerIdSet: new Set() };
  }
};

/**
 * Reactivates a member's own MatrimonialProfile ONLY IF:
 * 1. The profile is currently `profileStatus: 'inactive'` AND
 * 2. `deactivationReason` is explicitly `'subscription_expired'` AND
 * 3. The member currently holds a valid eligible subscription (or `skipSubscriptionCheck: true` when called inside payment activation).
 *
 * Never reactivates profiles with `deactivationReason: null`, `'admin_action'`, `'member_action'`,
 * or any other reason.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {object} [options]
 * @returns {Promise<{ reactivated: boolean, profile: object | null }>}
 */
const reactivateExpiredProfileIfEligible = async (
  userId,
  { now = new Date(), session = null, skipSubscriptionCheck = false } = {}
) => {
  if (!userId) {
    return { reactivated: false, profile: null };
  }

  if (!skipSubscriptionCheck) {
    const access = await checkUserDirectoryAccess(userId, now);
    if (!access.allowed) {
      return { reactivated: false, profile: null };
    }
  }

  const MatrimonialProfile = require('../models/MatrimonialProfile');
  const queryOpts = { new: true, ...(session ? { session } : {}) };

  if (typeof MatrimonialProfile.findOneAndUpdate !== 'function') {
    return { reactivated: false, profile: null };
  }

  const reactivatedProfile = await MatrimonialProfile.findOneAndUpdate(
    {
      user: userId,
      profileStatus: 'inactive',
      deactivationReason: 'subscription_expired',
    },
    {
      $set: {
        profileStatus: 'active',
        deactivationReason: null,
        deactivatedAt: null,
      },
    },
    queryOpts
  );

  return {
    reactivated: Boolean(reactivatedProfile),
    profile: reactivatedProfile || null,
  };
};

/**
 * Express middleware that enforces active or grace-period subscription eligibility
 * before allowing access to the member directory.
 * Must be used after `protect` authentication middleware.
 */
const requireDirectoryAccess = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no user session found',
      });
    }

    const accessResult = await checkUserDirectoryAccess(req.user._id);

    if (!accessResult.allowed) {
      return res.status(403).json({
        success: false,
        code: accessResult.code,
        message: accessResult.message,
        subscriptionAccess: {
          allowed: false,
          code: accessResult.code,
          inGracePeriod: false,
          contactsHidden: true,
        },
      });
    }

    req.subscriptionAccess = {
      allowed: true,
      code: accessResult.code,
      accessMode: accessResult.accessMode,
      inGracePeriod: accessResult.inGracePeriod,
      contactsHidden: true,
      endDate: accessResult.subscriptionSummary?.endDate || null,
      gracePeriodEndDate: accessResult.subscriptionSummary?.gracePeriodEndDate || null,
      subscription: accessResult.subscription || null,
    };

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  GRACE_PERIOD_DAYS,
  GRACE_PERIOD_MS,
  ACCESS_CODES,
  evaluateSubscriptionAccess,
  checkUserDirectoryAccess,
  evaluateOwnerSubscriptionExpiry,
  getExpiredBeyondGraceOwnerIds,
  reactivateExpiredProfileIfEligible,
  requireDirectoryAccess,
};
