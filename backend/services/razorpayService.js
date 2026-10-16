const Razorpay = require('razorpay');
const crypto = require('crypto');

/**
 * Service managing Razorpay Client initialization and signature validation
 */

/**
 * Creates and returns an initialized Razorpay instance
 * Throws an error if required API credentials are missing
 * @returns {Razorpay}
 */
const getRazorpayClient = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_id.trim() || !key_secret || !key_secret.trim()) {
    throw new Error('Razorpay API credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured.');
  }

  return new Razorpay({
    key_id: key_id.trim(),
    key_secret: key_secret.trim(),
  });
};

/**
 * Verifies Razorpay checkout signature using HMAC-SHA256 and timingSafeEqual
 * 
 * Formula: HMAC-SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET)
 * 
 * @param {object} params
 * @param {string} params.orderId - Razorpay order ID
 * @param {string} params.paymentId - Razorpay payment ID
 * @param {string} params.signature - Client-provided hex signature
 * @returns {boolean}
 */
const verifyCheckoutSignature = ({ orderId, paymentId, signature }) => {
  if (!orderId || !paymentId || !signature) {
    return false;
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret || !keySecret.trim()) {
    throw new Error('RAZORPAY_KEY_SECRET is not configured on the server.');
  }

  const payload = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', keySecret.trim())
    .update(payload)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const actualBuffer = Buffer.from(signature, 'utf8');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
};

/**
 * Verifies Razorpay webhook signature using HMAC-SHA256 and timingSafeEqual
 * 
 * Formula: HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)
 * 
 * @param {object} params
 * @param {Buffer|string} params.rawBody - Raw byte buffer or raw string of the webhook request body
 * @param {string} params.signature - Value of 'x-razorpay-signature' header
 * @returns {boolean}
 */
const verifyWebhookSignature = ({ rawBody, signature }) => {
  if (!rawBody || !signature) {
    return false;
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret || !webhookSecret.trim()) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured on the server.');
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret.trim())
    .update(rawBody)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const actualBuffer = Buffer.from(signature, 'utf8');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
};

module.exports = {
  getRazorpayClient,
  verifyCheckoutSignature,
  verifyWebhookSignature,
};
