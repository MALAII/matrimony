const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createRateLimiter } = require('../middleware/rateLimiter');
const {
  createOrder,
  verifyPayment,
  getMySubscription,
} = require('../controllers/subscriptionController');

// Rate limiter for order creation (max 10 requests per 15 minutes per user/IP)
const orderLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many order creation attempts. Please wait before creating another order.',
});

// Rate limiter for payment verification (max 10 requests per 15 minutes per user/IP)
const verifyLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many payment verification attempts. Please try again later.',
});

/**
 * @route   POST /api/subscriptions/create-order
 * @desc    Create Razorpay order for subscription purchase
 * @access  Private (Authenticated users only)
 */
router.post('/create-order', protect, orderLimiter, createOrder);

/**
 * @route   POST /api/subscriptions/verify-payment
 * @desc    Verify checkout signature and activate subscription
 * @access  Private (Authenticated users only)
 */
router.post('/verify-payment', protect, verifyLimiter, verifyPayment);

/**
 * @route   GET /api/subscriptions/me
 * @desc    Get authenticated user's current subscription status
 * @access  Private (Authenticated users only)
 */
router.get('/me', protect, getMySubscription);

module.exports = router;
