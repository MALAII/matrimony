const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const { createCorsOptions } = require('./config/cors');
const { createRateLimiter } = require('./middleware/rateLimiter');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const adminRoutes = require('./routes/adminRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const memberRoutes = require('./routes/memberRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Initialize Express application
const app = express();

// Configure Express trust proxy setting based on deployment environment
if (process.env.TRUST_PROXY) {
  const trustVal = process.env.TRUST_PROXY.trim().toLowerCase();
  if (trustVal === 'true') {
    app.set('trust proxy', true);
  } else if (!isNaN(Number(trustVal))) {
    app.set('trust proxy', Number(trustVal));
  } else {
    app.set('trust proxy', process.env.TRUST_PROXY.trim());
  }
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Mount Helmet with production-appropriate security headers (disabling HTML-oriented CSP on API responses to avoid breaking client integrations)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Mount CORS middleware with environment-aware origin rules
app.use(cors(createCorsOptions()));

// Capture raw request body bytes for webhook signature verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate Limiters for sensitive authentication endpoints (configurable via environment variables)
const registerLimitMax = parseInt(process.env.RATE_LIMIT_REGISTER_MAX, 10) || 10;
const registerLimitWindowMs = parseInt(process.env.RATE_LIMIT_REGISTER_WINDOW_MS, 10) || 15 * 60 * 1000;
const registerLimiter = createRateLimiter({
  windowMs: registerLimitWindowMs,
  max: registerLimitMax,
  message: 'Too many registration attempts from this IP address. Please try again after 15 minutes.',
});

const loginLimitMax = parseInt(process.env.RATE_LIMIT_LOGIN_MAX, 10) || 15;
const loginLimitWindowMs = parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS, 10) || 15 * 60 * 1000;
const loginLimiter = createRateLimiter({
  windowMs: loginLimitWindowMs,
  max: loginLimitMax,
  message: 'Too many login attempts from this IP address. Please try again after 15 minutes.',
});

// Expose rate limiters on app instance for programmatic testing and inspection
app.registerLimiter = registerLimiter;
app.loginLimiter = loginLimiter;

// Mount Route-level Rate Limiters before auth routes
app.post('/api/auth/register', registerLimiter);
app.post('/api/auth/login', loginLimiter);

// Mount Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/notifications', notificationRoutes);

// Root Fallback Route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Matrimony Backend API',
    healthCheck: '/api/health',
  });
});

// Centralized Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

module.exports = app;
