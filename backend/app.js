const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const adminRoutes = require('./routes/adminRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const memberRoutes = require('./routes/memberRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Initialize Express application
const app = express();

// Core Middleware
const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
app.use(
  cors({
    origin: [clientUrl, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  })
);

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

// Mount Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/members', memberRoutes);

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
