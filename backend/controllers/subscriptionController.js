const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const {
  isValidPlanCode,
  getPlanConfig,
  isCheckoutEnabled,
} = require('../config/plans');
const razorpayService = require('../services/razorpayService');
const {
  processSuccessfulPayment,
  processFailedPayment,
  claimWebhookEvent,
  finalizeWebhookEvent,
} = require('../services/paymentService');

/**
 * @route   POST /api/subscriptions/create-order
 * @desc    Create a Razorpay order and persist initial Payment record
 * @access  Private (Authenticated users only)
 */
const createOrder = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { planCode } = req.body || {};

    // 1. Confirm checkout is globally enabled
    const checkoutCheck = isCheckoutEnabled();
    if (!checkoutCheck.enabled) {
      return res.status(403).json({
        success: false,
        message: checkoutCheck.reason,
      });
    }

    // 2. Validate plan code
    if (!isValidPlanCode(planCode)) {
      return res.status(400).json({
        success: false,
        message: `Invalid or missing planCode: '${planCode}'. Allowed plans are 'THREE_MONTHS' and 'SIX_MONTHS'.`,
      });
    }

    // 3. Resolve plan configuration & authoritative server-side price (paise)
    let planConfig;
    try {
      planConfig = getPlanConfig(planCode);
    } catch (configErr) {
      return res.status(500).json({
        success: false,
        message: configErr.message,
      });
    }

    // 4. Renewal safeguard: Check for existing active subscription
    // Because renewal rules have not been finalized by the client, reject attempts to purchase over an active subscription
    const existingActiveSubscription = await Subscription.findOne({
      user: userId,
      status: 'active',
      endDate: { $gt: new Date() },
    });

    if (existingActiveSubscription) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active subscription. Subscription renewal behavior has not yet been finalized.',
      });
    }

    // 5. Initialize Razorpay Client & create order
    const razorpay = razorpayService.getRazorpayClient();
    const orderOptions = {
      amount: planConfig.amount, // in paise
      currency: planConfig.currency, // 'INR'
      receipt: `rcpt_${userId.toString().slice(-8)}_${Date.now().toString().slice(-6)}`,
      notes: {
        userId: userId.toString(),
        planCode: planConfig.code,
      },
    };

    let rzpOrder;
    try {
      rzpOrder = await razorpay.orders.create(orderOptions);
    } catch (orderErr) {
      console.error(`[Razorpay Order Error] ${orderErr.message}`);
      return res.status(502).json({
        success: false,
        message: 'Failed to create payment order with the payment provider. Please try again later.',
      });
    }

    // 6. Persist Payment record with status 'created'
    const payment = await Payment.create({
      user: userId,
      planCode: planConfig.code,
      amount: planConfig.amount,
      currency: planConfig.currency,
      razorpayOrderId: rzpOrder.id,
      status: 'created',
    });

    // 7. Return only necessary order details to frontend (never internal secrets)
    return res.status(201).json({
      success: true,
      data: {
        orderId: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        planCode: planConfig.code,
        planName: planConfig.name,
        durationMonths: planConfig.durationMonths,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/subscriptions/verify-payment
 * @desc    Verify checkout signature and activate subscription server-side
 * @access  Private (Authenticated users only)
 */
const verifyPayment = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment verification parameters (razorpay_order_id, razorpay_payment_id, razorpay_signature).',
      });
    }

    // 1. Fetch Payment record to verify ownership and matching order
    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment order record not found.',
      });
    }

    // Verify ownership: order must belong to the authenticated user
    if (payment.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: This payment order does not belong to your account.',
      });
    }

    // 2. Perform constant-time HMAC-SHA256 signature verification
    const isValidSignature = razorpayService.verifyCheckoutSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValidSignature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: Invalid checkout signature.',
      });
    }

    // 3. Confirm with Razorpay API that payment is captured and parameters match
    const razorpay = razorpayService.getRazorpayClient();
    let rzpPayment;
    try {
      rzpPayment = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (fetchErr) {
      console.error(`[Razorpay Payment Fetch Error] ${fetchErr.message}`);
      return res.status(502).json({
        success: false,
        message: 'Unable to verify payment status with payment provider.',
      });
    }

    // Verify that payment matches expected order ID, amount, and currency
    if (!rzpPayment || rzpPayment.id !== razorpay_payment_id) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: Payment ID mismatch from provider.',
      });
    }

    if (rzpPayment.order_id !== razorpay_order_id) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: Payment order ID mismatch.',
      });
    }

    if (Number(rzpPayment.amount) !== Number(payment.amount) || String(rzpPayment.currency).toUpperCase() !== String(payment.currency).toUpperCase()) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: Amount or currency tampering detected.',
      });
    }

    // Payment must be 'captured'
    if (rzpPayment.status !== 'captured') {
      return res.status(400).json({
        success: false,
        message: `Payment is not in captured status (current status: '${rzpPayment.status}'). Subscription cannot be activated.`,
      });
    }

    // 4. Idempotently activate subscription and guarantee valid linked Subscription
    const result = await processSuccessfulPayment({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      expectedAmount: rzpPayment.amount,
      expectedCurrency: rzpPayment.currency,
      verificationMethod: 'client_callback',
    });

    if (!result || !result.subscription || !result.subscription._id) {
      return res.status(500).json({
        success: false,
        message: 'Subscription activation could not be completed. Please retry verification.',
      });
    }

    return res.status(200).json({
      success: true,
      message: result.alreadyProcessed
        ? 'Payment previously verified and subscription already active.'
        : 'Payment verified and subscription activated successfully.',
      data: {
        subscriptionId: result.subscription._id,
        status: result.subscription.status,
        planCode: payment.planCode,
        startDate: result.subscription.startDate,
        endDate: result.subscription.endDate,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * @route   GET /api/subscriptions/me
 * @desc    Get the current authenticated user's active subscription status
 * @access  Private (Authenticated users only)
 */
const getMySubscription = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Fetch the most recent subscription for the user
    const subscription = await Subscription.findOne({ user: userId })
      .sort({ createdAt: -1 })
      .select('-__v');

    if (!subscription) {
      return res.status(200).json({
        success: true,
        data: {
          hasSubscription: false,
          subscription: null,
        },
      });
    }

    // Check if subscription has expired based on current time
    const now = new Date();
    let computedStatus = subscription.status;
    if (subscription.status === 'active' && subscription.endDate && now > subscription.endDate) {
      if (subscription.gracePeriodEndDate && now <= subscription.gracePeriodEndDate) {
        computedStatus = 'grace_period';
      } else {
        computedStatus = 'expired';
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        hasSubscription: true,
        subscription: {
          id: subscription._id,
          planCode: subscription.planCode,
          durationMonths: subscription.durationMonths,
          status: computedStatus,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          gracePeriodEndDate: subscription.gracePeriodEndDate,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/webhooks/razorpay
 * @desc    Process incoming Razorpay webhook events with database-enforced event deduplication
 *          and strict order/payment/amount/currency validation.
 * @access  Public (Signature authenticated via RAZORPAY_WEBHOOK_SECRET)
 */
const handleWebhook = async (req, res, next) => {
  let claimedEventRecord = null;
  let claimedToken = null;

  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody;

    if (!signature || !rawBody) {
      return res.status(400).json({
        success: false,
        message: 'Missing webhook signature or raw payload body.',
      });
    }

    // 1. Verify webhook signature using rawBody and RAZORPAY_WEBHOOK_SECRET
    let isValid;
    try {
      isValid = razorpayService.verifyWebhookSignature({ rawBody, signature });
    } catch (secErr) {
      console.error(`[Webhook Security Error] ${secErr.message}`);
      return res.status(500).json({
        success: false,
        message: 'Server webhook configuration error.',
      });
    }

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature.',
      });
    }

    // 2. Parse payload safely
    const event = req.body;
    if (!event || !event.event) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook payload structure.',
      });
    }

    const eventName = event.event;
    const eventId = (event.event_id || req.headers['x-razorpay-event-id'] || '').trim();

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required webhook event identifier (x-razorpay-event-id or event_id).',
      });
    }

    const paymentEntity = event.payload?.payment?.entity || null;
    const orderEntity = event.payload?.order?.entity || null;
    const orderId = paymentEntity?.order_id || orderEntity?.id || null;
    const paymentId = paymentEntity?.id || null;

    // 3. Database-backed atomic deduplication via WebhookEvent unique index on eventId
    const claimResult = await claimWebhookEvent({
      eventId,
      eventType: eventName,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
    });

    if (!claimResult.claimed) {
      if (claimResult.concurrentInProgress) {
        return res.status(200).json({
          success: true,
          message: 'Webhook event is already being processed concurrently.',
        });
      }
      return res.status(200).json({
        success: true,
        message: 'Webhook event already processed (idempotent ignore).',
      });
    }

    claimedEventRecord = claimResult.eventRecord;
    claimedToken = claimResult.claimToken;

    // 4. Handle relevant payment success events ('payment.captured' or 'order.paid')
    if (eventName === 'payment.captured' || eventName === 'order.paid') {
      if (!paymentEntity) {
        await finalizeWebhookEvent(claimedEventRecord, {
          status: 'quarantined',
          failureReason: 'Missing payment entity in webhook payload',
          claimToken: claimedToken,
        });
        return res.status(400).json({
          success: false,
          message: 'Missing payment entity in webhook payload.',
        });
      }

      // Validate required fields on the payment entity
      if (!orderId || !paymentId || paymentEntity.amount === undefined || !paymentEntity.currency) {
        await finalizeWebhookEvent(claimedEventRecord, {
          status: 'quarantined',
          failureReason: 'Incomplete payment entity details (missing order_id, id, amount, or currency)',
          claimToken: claimedToken,
        });
        return res.status(400).json({
          success: false,
          message: 'Incomplete payment entity details in webhook payload.',
        });
      }

      // Ensure the payment entity status is actually 'captured'
      if (paymentEntity.status && paymentEntity.status !== 'captured') {
        await finalizeWebhookEvent(claimedEventRecord, {
          status: 'quarantined',
          failureReason: `Unexpected payment entity status '${paymentEntity.status}' on ${eventName}`,
          claimToken: claimedToken,
        });
        return res.status(400).json({
          success: false,
          message: `Payment entity status '${paymentEntity.status}' is not captured.`,
        });
      }

      // Cross-check with orderEntity if present in 'order.paid'
      if (orderEntity) {
        if (orderEntity.id && orderEntity.id !== orderId) {
          await finalizeWebhookEvent(claimedEventRecord, {
            status: 'quarantined',
            failureReason: 'Mismatch between payment.entity.order_id and order.entity.id',
            claimToken: claimedToken,
          });
          return res.status(400).json({
            success: false,
            message: 'Order ID mismatch inside webhook payload.',
          });
        }
      }

      try {
        const result = await processSuccessfulPayment({
          orderId,
          paymentId,
          expectedAmount: paymentEntity.amount,
          expectedCurrency: paymentEntity.currency,
          verificationMethod: 'webhook',
        });

        if (!result || !result.subscription || !result.subscription._id) {
          throw new Error('Subscription activation did not return a valid linked Subscription.');
        }

        await finalizeWebhookEvent(claimedEventRecord, {
          status: 'processed',
          claimToken: claimedToken,
        });

        return res.status(200).json({
          success: true,
          message: 'Payment captured event processed successfully.',
        });
      } catch (procErr) {
        if (procErr.isMismatch || procErr.statusCode === 400 || procErr.statusCode === 404) {
          await finalizeWebhookEvent(claimedEventRecord, {
            status: 'quarantined',
            failureReason: procErr.message,
            claimToken: claimedToken,
          });
          return res.status(procErr.statusCode || 400).json({
            success: false,
            message: procErr.message,
          });
        }

        // Transient or database error: mark event 'failed' so a subsequent retry can safely reclaim it
        await finalizeWebhookEvent(claimedEventRecord, {
          status: 'failed',
          failureReason: procErr.message || 'Transient processing error',
          claimToken: claimedToken,
        });
        throw procErr;
      }
    }

    // 5. Handle payment failure event ('payment.failed')
    if (eventName === 'payment.failed') {
      if (paymentEntity && paymentEntity.order_id) {
        await processFailedPayment({
          orderId: paymentEntity.order_id,
          paymentId: paymentEntity.id,
          reason: paymentEntity.error_description || 'Payment failed',
        });
      }

      await finalizeWebhookEvent(claimedEventRecord, {
        status: 'processed',
        claimToken: claimedToken,
      });

      return res.status(200).json({
        success: true,
        message: 'Payment failed event recorded.',
      });
    }

    // 6. Unhandled events (e.g., refund): record as 'ignored' without making policy assumptions
    await finalizeWebhookEvent(claimedEventRecord, {
      status: 'ignored',
      claimToken: claimedToken,
    });

    return res.status(200).json({
      success: true,
      message: `Webhook event '${eventName}' received and acknowledged (unhandled event type).`,
    });
  } catch (error) {
    if (claimedEventRecord && claimedEventRecord.status === 'processing') {
      try {
        await finalizeWebhookEvent(claimedEventRecord, {
          status: 'failed',
          failureReason: error.message || 'Unhandled webhook error',
          claimToken: claimedToken,
        });
      } catch (_) {}
    }
    next(error);
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getMySubscription,
  handleWebhook,
};
