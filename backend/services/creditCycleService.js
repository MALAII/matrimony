const CreditCycle = require('../models/CreditCycle');
const { evaluateSubscriptionAccess, ACCESS_CODES } = require('./subscriptionAccessService');

/**
 * Centralized Monthly Contact-View Credit Policy Configuration (Phase 5C).
 *
 * NOTE: Final client terms may still change the cycle reset mode or credit allocation later.
 * Centralizing this policy here ensures controller and unlock logic do not need to be rewritten
 * if the client switches between subscription-anniversary and calendar-month reset policies.
 */
const CREDIT_POLICY = {
  RESET_MODE: 'SUBSCRIPTION_ANNIVERSARY', // Supported: 'SUBSCRIPTION_ANNIVERSARY' | 'CALENDAR_MONTH_UTC'
  CREDITS_PER_CYCLE: 50,
  CARRY_FORWARD_UNUSED: false,
};

/**
 * Safely adds `monthsToAdd` UTC months to `anchorDate` while clamping the day-of-month
 * to the last valid day of the target UTC month (preventing JavaScript Date overflow
 * such as Jan 31 + 1 month overflowing into March 3).
 *
 * Because every cycle boundary is computed from the original `startDate` anchor (`k = 0, 1, 2, ...`),
 * a subscription starting on Jan 31 has boundaries:
 * - k = 0: Jan 31
 * - k = 1: Feb 28 (or Feb 29 in a leap year)
 * - k = 2: Mar 31
 * - k = 3: Apr 30
 *
 * @param {Date|string} anchorDate
 * @param {number} monthsToAdd
 * @returns {Date}
 */
const addUtcMonthsClamped = (anchorDate, monthsToAdd) => {
  const anchor = anchorDate instanceof Date ? anchorDate : new Date(anchorDate);
  if (Number.isNaN(anchor.getTime())) {
    throw new Error('Invalid anchorDate supplied to addUtcMonthsClamped');
  }

  const anchorYear = anchor.getUTCFullYear();
  const anchorMonth = anchor.getUTCMonth();
  const anchorDay = anchor.getUTCDate();
  const anchorHours = anchor.getUTCHours();
  const anchorMinutes = anchor.getUTCMinutes();
  const anchorSeconds = anchor.getUTCSeconds();
  const anchorMs = anchor.getUTCMilliseconds();

  // First day of target month in UTC
  const targetFirstOfMonth = new Date(Date.UTC(anchorYear, anchorMonth + monthsToAdd, 1));
  const targetYear = targetFirstOfMonth.getUTCFullYear();
  const targetMonth = targetFirstOfMonth.getUTCMonth();

  // Number of days in target UTC month (day 0 of targetMonth + 1)
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(anchorDay, daysInTargetMonth);

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      clampedDay,
      anchorHours,
      anchorMinutes,
      anchorSeconds,
      anchorMs
    )
  );
};

/**
 * Resolves the active credit-cycle window for a subscription at timestamp `now`.
 *
 * Rules:
 * 1. Never trusts client-supplied dates or cycle numbers; uses `subscription.startDate` and `subscription.endDate`.
 * 2. Requires the subscription to be strictly in its `'active'` period (`evaluateSubscriptionAccess(subscription, now)`).
 *    Subscriptions that are pending, cancelled, not yet started, in their 7-day grace period, or expired
 *    are NOT eligible for a credit cycle.
 * 3. Uses UTC anniversary boundaries clamped safely for month-ends and leap years.
 *
 * @param {object} subscription
 * @param {Date} [now=new Date()]
 * @param {object} [policyOverride]
 * @returns {{
 *   eligible: boolean,
 *   code: string,
 *   message: string,
 *   cycleNumber: number | null,
 *   cycleStart: Date | null,
 *   cycleEnd: Date | null,
 *   creditsAllocated: number
 * }}
 */
const resolveCurrentCycleWindow = (
  subscription,
  now = new Date(),
  policyOverride = CREDIT_POLICY
) => {
  const currentTime = now instanceof Date ? now : new Date(now);
  const access = evaluateSubscriptionAccess(subscription, currentTime);

  if (!access.allowed) {
    return {
      eligible: false,
      code: access.code,
      message: access.message,
      cycleNumber: null,
      cycleStart: null,
      cycleEnd: null,
      creditsAllocated: 0,
    };
  }

  // During the 7-day grace period, profile browsing is permitted but contact unlocking and credit cycles are disabled
  if (access.inGracePeriod || access.accessMode !== 'active') {
    return {
      eligible: false,
      code: ACCESS_CODES.GRACE_PERIOD,
      message:
        'Contact-view credits are not available during the 7-day subscription grace period. Please renew your subscription to unlock contacts.',
      cycleNumber: null,
      cycleStart: null,
      cycleEnd: null,
      creditsAllocated: 0,
    };
  }

  const startDate =
    subscription.startDate instanceof Date
      ? subscription.startDate
      : new Date(subscription.startDate);
  const endDate =
    subscription.endDate instanceof Date
      ? subscription.endDate
      : new Date(subscription.endDate);

  const policy = { ...CREDIT_POLICY, ...(policyOverride || {}) };
  const creditsAllocated = policy.CREDITS_PER_CYCLE;
  const nowMs = currentTime.getTime();

  if (policy.RESET_MODE === 'CALENDAR_MONTH_UTC') {
    const monthStart = new Date(
      Date.UTC(currentTime.getUTCFullYear(), currentTime.getUTCMonth(), 1, 0, 0, 0, 0)
    );
    const nextMonthStart = new Date(
      Date.UTC(currentTime.getUTCFullYear(), currentTime.getUTCMonth() + 1, 1, 0, 0, 0, 0)
    );
    const cycleStart = monthStart.getTime() < startDate.getTime() ? startDate : monthStart;
    const cycleEnd = nextMonthStart.getTime() > endDate.getTime() ? endDate : nextMonthStart;
    const monthsDiff =
      (currentTime.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
      (currentTime.getUTCMonth() - startDate.getUTCMonth());

    return {
      eligible: true,
      code: ACCESS_CODES.ACTIVE,
      message: 'Active credit cycle resolved.',
      cycleNumber: Math.max(1, monthsDiff + 1),
      cycleStart,
      cycleEnd,
      creditsAllocated,
    };
  }

  // Default & Preferred Policy: SUBSCRIPTION_ANNIVERSARY
  // Determine maximum possible monthly cycles from durationMonths (or up to 24 months safety cap)
  const maxCycles =
    typeof subscription.durationMonths === 'number' && subscription.durationMonths > 0
      ? subscription.durationMonths + 1
      : 24;

  for (let k = 1; k <= maxCycles; k += 1) {
    const rawStart = addUtcMonthsClamped(startDate, k - 1);
    const rawEnd = addUtcMonthsClamped(startDate, k);

    const cycleStart = rawStart;
    const cycleEnd = rawEnd.getTime() > endDate.getTime() ? endDate : rawEnd;

    const isLastPossibleBoundary = cycleEnd.getTime() >= endDate.getTime();

    if (
      nowMs >= cycleStart.getTime() &&
      (nowMs < cycleEnd.getTime() || (isLastPossibleBoundary && nowMs <= endDate.getTime()))
    ) {
      return {
        eligible: true,
        code: ACCESS_CODES.ACTIVE,
        message: 'Active credit cycle resolved.',
        cycleNumber: k,
        cycleStart,
        cycleEnd,
        creditsAllocated,
      };
    }

    if (isLastPossibleBoundary) {
      break;
    }
  }

  return {
    eligible: false,
    code: ACCESS_CODES.SUBSCRIPTION_EXPIRED,
    message: 'Unable to resolve an active credit cycle for the given subscription dates.',
    cycleNumber: null,
    cycleStart: null,
    cycleEnd: null,
    creditsAllocated: 0,
  };
};

/**
 * Retrieves or atomically creates the CreditCycle document for the subscription's current cycle.
 *
 * Ensures:
 * - Exactly 1 CreditCycle per `{ subscription, cycleNumber }` (enforced via unique compound index + E11000 recovery).
 * - 50 credits allocated on creation (`creditsUsed: 0, creditsRemaining: 50`).
 * - Previous cycle's unused credits are never carried forward.
 *
 * @param {object} subscription
 * @param {Date} [now=new Date()]
 * @param {object|null} [session=null]
 */
const getOrCreateCurrentCreditCycle = async (
  subscription,
  now = new Date(),
  session = null
) => {
  const windowInfo = resolveCurrentCycleWindow(subscription, now);
  if (!windowInfo.eligible) {
    return {
      eligible: false,
      code: windowInfo.code,
      message: windowInfo.message,
      cycle: null,
    };
  }

  const queryOpts = session ? { session } : {};
  const filter = {
    subscription: subscription._id,
    cycleNumber: windowInfo.cycleNumber,
  };

  let cycle = await CreditCycle.findOne(filter, null, queryOpts);

  if (!cycle) {
    const payload = {
      user: subscription.user,
      subscription: subscription._id,
      cycleNumber: windowInfo.cycleNumber,
      cycleStart: windowInfo.cycleStart,
      cycleEnd: windowInfo.cycleEnd,
      creditsAllocated: windowInfo.creditsAllocated,
      creditsUsed: 0,
      creditsRemaining: windowInfo.creditsAllocated,
    };

    try {
      if (session) {
        const createdArr = await CreditCycle.create([payload], { session });
        cycle = Array.isArray(createdArr) ? createdArr[0] : createdArr;
      } else {
        cycle = await CreditCycle.create(payload);
      }
    } catch (err) {
      if (err && err.code === 11000) {
        cycle = await CreditCycle.findOne(filter, null, queryOpts);
      } else {
        throw err;
      }
    }
  }

  if (!cycle) {
    throw new Error(
      `Failed to resolve or create CreditCycle for subscription '${subscription._id}' cycle ${windowInfo.cycleNumber}.`
    );
  }

  return {
    eligible: true,
    code: ACCESS_CODES.ACTIVE,
    message: windowInfo.message,
    cycle,
  };
};

/**
 * Formats a CreditCycle document into a safe public DTO for the signed-in member.
 */
const formatCreditCycleDTO = (cycle) => {
  if (!cycle) return null;
  return {
    cycleNumber: cycle.cycleNumber,
    cycleStart: cycle.cycleStart,
    cycleEnd: cycle.cycleEnd,
    creditsAllocated: cycle.creditsAllocated,
    creditsUsed: cycle.creditsUsed,
    creditsRemaining: cycle.creditsRemaining,
  };
};

module.exports = {
  CREDIT_POLICY,
  addUtcMonthsClamped,
  resolveCurrentCycleWindow,
  getOrCreateCurrentCreditCycle,
  formatCreditCycleDTO,
};
