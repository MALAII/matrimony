/**
 * CORS Configuration and Allowed Origins Resolver
 *
 * Rules:
 * 1. In production (NODE_ENV === 'production'):
 *    - Strictly permit ONLY explicitly configured trusted frontend origins (CLIENT_URL / ALLOWED_ORIGINS).
 *    - Reject all localhost / 127.0.0.1 origins to prevent localhost hijacking in production.
 * 2. In non-production (development, test):
 *    - Permit configured origins plus standard local development origins (http://localhost:3000, http://127.0.0.1:3000, etc.).
 * 3. Server-to-server or tools with no Origin header (e.g. curl, mobile apps, Razorpay webhooks):
 *    - Permitted through without CORS restriction.
 */

const parseConfiguredOrigins = (rawString) => {
  if (!rawString || typeof rawString !== 'string') return [];
  return rawString
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
};

const isLocalhostOrigin = (origin) => {
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]'
    );
  } catch {
    return false;
  }
};

const resolveEnv = (envArg, customEnvVars = {}) => {
  if (typeof envArg === 'string') {
    return { ...process.env, NODE_ENV: envArg, ...customEnvVars };
  }
  return { ...process.env, ...(envArg || {}) };
};

const getAllowedOrigins = (envArg = process.env, customEnvVars = {}) => {
  const env = resolveEnv(envArg, customEnvVars);
  const isProduction = env.NODE_ENV === 'production';
  const configured = [
    ...parseConfiguredOrigins(env.CLIENT_URL),
    ...parseConfiguredOrigins(env.ALLOWED_ORIGINS),
  ];

  // Remove duplicates
  const uniqueConfigured = Array.from(new Set(configured));

  if (isProduction) {
    // In production, strictly filter out any localhost / loopback origins
    const prodAllowed = uniqueConfigured.filter((origin) => !isLocalhostOrigin(origin));
    if (prodAllowed.length === 0) {
      console.warn('[CORS Warning] No valid non-localhost production origins configured in CLIENT_URL / ALLOWED_ORIGINS.');
    }
    return prodAllowed;
  }

  // Non-production (development, test): allow configured + default local frontend ports
  const devDefaultOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ];

  return Array.from(new Set([...devDefaultOrigins, ...uniqueConfigured]));
};

const createCorsOptions = (envArg = process.env, customEnvVars = {}) => {
  const env = resolveEnv(envArg, customEnvVars);
  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server Razorpay webhooks)
      if (!origin) {
        return callback(null, true);
      }

      const allowed = getAllowedOrigins(env);
      if (allowed.includes(origin)) {
        return callback(null, true);
      }

      const error = new Error(`CORS policy: Access denied for origin '${origin}'.`);
      error.status = 403;
      error.statusCode = 403;
      return callback(error);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  };
};

module.exports = {
  getAllowedOrigins,
  isLocalhostOrigin,
  createCorsOptions,
};
