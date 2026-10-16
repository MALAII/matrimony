const express = require('express');
const router = express.Router();
const { handleWebhook } = require('../controllers/subscriptionController');
const { createRateLimiter } = require('../middleware/rateLimiter');

// Rate limiter for webhook ingestion (max 60 events per minute per IP)
const webhookLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Webhook rate limit exceeded.',
});

/**
 * @route   POST /api/webhooks/razorpay
 * @desc    Receive and process Razorpay webhooks
 * @access  Public (Signature authenticated via HMAC-SHA256)
 */
router.post('/razorpay', webhookLimiter, handleWebhook);

module.exports = router;
