/**
 * Token-bucket / sliding-window rate limiter middleware.
 * Zero external dependencies: Uses Node.js native Map and setInterval.
 */

/**
 * Resolves client IP according to Express trust proxy configuration.
 * When trust proxy is disabled, Express sets req.ip to the direct remote socket IP,
 * preventing attackers from forging X-Forwarded-For to bypass limits.
 * When trust proxy is enabled, Express securely extracts client IP from trusted proxies.
 */
const getClientIp = (req) => {
  if (req.ip) return req.ip;
  if (req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
  return 'unknown';
};

const createRateLimiter = ({
  windowMs = 15 * 60 * 1000,
  max = 5,
  message = 'Too many requests, please try again later.',
  keyGenerator = null,
} = {}) => {
  const hits = new Map();

  // Periodic cleanup every minute to prevent memory leakage
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  }, 60 * 1000);

  // Unref interval so it does not block Node process termination in tests or scripts
  if (interval.unref) {
    interval.unref();
  }

  const limiterMiddleware = (req, res, next) => {
    // Generate key based on custom key generator, authenticated user ID, or resolved client IP
    const identifier = typeof keyGenerator === 'function'
      ? keyGenerator(req)
      : (req.user && req.user._id)
        ? `user:${req.user._id}`
        : `ip:${getClientIp(req)}`;

    const now = Date.now();
    let record = hits.get(identifier);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      hits.set(identifier, record);
    } else {
      record.count += 1;
    }

    // Set standard rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((record.resetTime - now) / 1000)));
      return res.status(429).json({
        success: false,
        message,
      });
    }

    next();
  };

  // Helper method to reset hit count in tests
  limiterMiddleware.reset = () => {
    hits.clear();
  };

  limiterMiddleware.destroy = () => {
    clearInterval(interval);
    hits.clear();
  };

  return limiterMiddleware;
};

module.exports = {
  createRateLimiter,
  getClientIp,
};
