/**
 * Simple in-memory token-bucket / sliding-window rate limiter middleware.
 * Zero external dependencies: Uses Node.js native Map and setInterval.
 */

const createRateLimiter = ({ windowMs = 15 * 60 * 1000, max = 5, message = 'Too many requests, please try again later.' } = {}) => {
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

  return (req, res, next) => {
    // Generate key based on IP or authenticated user ID if present
    const identifier = (req.user && req.user._id)
      ? String(req.user._id)
      : (req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');

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
      return res.status(429).json({
        success: false,
        message,
      });
    }

    next();
  };
};

module.exports = {
  createRateLimiter,
};
