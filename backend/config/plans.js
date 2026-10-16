/**
 * Server-side Subscription Plan Configuration
 * 
 * Rules:
 * 1. Plan codes are strictly immutable: 'THREE_MONTHS' and 'SIX_MONTHS'.
 * 2. Prices are NEVER hardcoded; resolved at runtime from environment variables.
 * 3. Prices are integer amounts in INR paise (e.g., ₹1000 = 100000 paise).
 * 4. Client-supplied amounts, durations, or credits are NEVER authoritative.
 */

const PLAN_CODES = {
  THREE_MONTHS: 'THREE_MONTHS',
  SIX_MONTHS: 'SIX_MONTHS',
};

const PLAN_DEFINITIONS = {
  [PLAN_CODES.THREE_MONTHS]: {
    code: PLAN_CODES.THREE_MONTHS,
    name: '3 Months Subscription',
    durationMonths: 3,
    currency: 'INR',
    priceEnvKey: 'PLAN_PRICE_3M',
  },
  [PLAN_CODES.SIX_MONTHS]: {
    code: PLAN_CODES.SIX_MONTHS,
    name: '6 Months Subscription',
    durationMonths: 6,
    currency: 'INR',
    priceEnvKey: 'PLAN_PRICE_6M',
  },
};

/**
 * Validates whether a given plan code is supported
 * @param {string} planCode 
 * @returns {boolean}
 */
const isValidPlanCode = (planCode) => {
  return Boolean(planCode && PLAN_DEFINITIONS[planCode]);
};

/**
 * Resolves the plan configuration including its current server-side price in paise.
 * Throws a descriptive error if the price is unconfigured, non-numeric, or non-positive.
 * 
 * @param {string} planCode 
 * @returns {{ code: string, name: string, durationMonths: number, currency: string, amount: number }}
 */
const getPlanConfig = (planCode) => {
  if (!isValidPlanCode(planCode)) {
    throw new Error(`Invalid plan code: '${planCode}'. Allowed plans are ${Object.keys(PLAN_DEFINITIONS).join(', ')}.`);
  }

  const def = PLAN_DEFINITIONS[planCode];
  const rawPrice = process.env[def.priceEnvKey];

  if (!rawPrice || !rawPrice.trim()) {
    throw new Error(`Subscription price for plan '${planCode}' (${def.priceEnvKey}) is not configured on the server.`);
  }

  // Validate that price is a positive integer
  if (!/^\d+$/.test(rawPrice.trim())) {
    throw new Error(`Configured price for plan '${planCode}' (${def.priceEnvKey}) must be a positive integer in INR paise.`);
  }

  const amount = parseInt(rawPrice.trim(), 10);
  if (amount <= 0) {
    throw new Error(`Configured price for plan '${planCode}' (${def.priceEnvKey}) must be greater than zero.`);
  }

  return {
    code: def.code,
    name: def.name,
    durationMonths: def.durationMonths,
    currency: def.currency,
    amount, // in paise
  };
};

/**
 * Checks if Razorpay online checkout is globally enabled and fully configured.
 * @returns {{ enabled: boolean, reason?: string }}
 */
const isCheckoutEnabled = () => {
  const checkoutEnabled = process.env.RAZORPAY_CHECKOUT_ENABLED === 'true';
  if (!checkoutEnabled) {
    return {
      enabled: false,
      reason: 'Online subscription checkout is currently disabled. Please contact administration.',
    };
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keyId.trim() || !keySecret || !keySecret.trim()) {
    return {
      enabled: false,
      reason: 'Payment gateway credentials are not configured on this server.',
    };
  }

  return { enabled: true };
};

module.exports = {
  PLAN_CODES,
  PLAN_DEFINITIONS,
  isValidPlanCode,
  getPlanConfig,
  isCheckoutEnabled,
};
