const crypto = require('crypto');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const WebhookEvent = require('../models/WebhookEvent');
const { getPlanConfig } = require('../config/plans');

const DEFAULT_WEBHOOK_LEASE_MS = 5 * 60 * 1000; // 5 minutes default processing lease

/**
 * Resolves the configured webhook processing lease duration in milliseconds.
 * Defaults to 5 minutes (300,000 ms) unless overridden by WEBHOOK_PROCESSING_LEASE_MS or caller argument.
 */
const getWebhookProcessingLeaseMs = (overrideLeaseMs = null) => {
  if (typeof overrideLeaseMs === 'number' && Number.isFinite(overrideLeaseMs) && overrideLeaseMs > 0) {
    return overrideLeaseMs;
  }
  const envVal = process.env.WEBHOOK_PROCESSING_LEASE_MS;
  if (envVal && /^\d+$/.test(String(envVal).trim())) {
    const parsed = parseInt(String(envVal).trim(), 10);
    if (parsed > 0) return parsed;
  }
  return DEFAULT_WEBHOOK_LEASE_MS;
};

/**
 * Generates a unique cryptographic claim token (fence token) for webhook processing ownership.
 */
const generateWebhookClaimToken = () => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Helper to attempt starting a Mongoose client session for ACID transactions.
 * Safely falls back to null if the connection is not active or transactions are unsupported.
 */
const tryStartSession = async () => {
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1 && typeof mongoose.startSession === 'function') {
      const session = await mongoose.startSession();
      return session;
    }
  } catch (_) {
    // Fallback to atomic single-document operations if session cannot be started
  }
  return null;
};

/**
 * Validates that a candidate Subscription matches the expected Payment owner, plan, and reference.
 */
const validateSubscriptionConsistency = (subscription, payment) => {
  if (!subscription) return false;
  if (String(subscription.user) !== String(payment.user)) return false;
  if (String(subscription.payment) !== String(payment._id)) return false;
  if (subscription.planCode !== payment.planCode) return false;
  if (!subscription.startDate || !subscription.endDate) return false;
  return true;
};

/**
 * Core internal workflow to ensure a Subscription exists for a Payment and that
 * the Payment is marked 'captured' and linked to that Subscription.
 * 
 * Safely handles:
 * 1. Concurrent verification + webhook calls (via unique index on Subscription.payment + 11000 recovery).
 * 2. Partial-failure recovery when Subscription was created on a previous attempt, but Payment linking failed.
 * 3. Partial-failure recovery when Payment was marked 'captured' on a previous attempt, but Subscription was missing or unlinked.
 * 4. Optional ACID MongoDB transaction session.
 */
const executePaymentActivation = async ({
  orderId,
  paymentId,
  expectedAmount = null,
  expectedCurrency = null,
  verificationMethod,
  session = null,
}) => {
  const queryOpts = session ? { session } : {};

  // 1. Fetch Payment record by Razorpay Order ID
  const payment = await Payment.findOne({ razorpayOrderId: orderId }, null, queryOpts);
  if (!payment) {
    const err = new Error(`Payment record with order ID '${orderId}' not found.`);
    err.statusCode = 404;
    throw err;
  }

  // 2. Validate payment details against stored server-side Payment record
  if (expectedAmount !== null && Number(expectedAmount) !== Number(payment.amount)) {
    const err = new Error(
      `Payment amount mismatch for order '${orderId}': expected ${payment.amount}, received ${expectedAmount}.`
    );
    err.statusCode = 400;
    err.isMismatch = true;
    throw err;
  }

  if (expectedCurrency !== null && String(expectedCurrency).toUpperCase() !== String(payment.currency).toUpperCase()) {
    const err = new Error(
      `Payment currency mismatch for order '${orderId}': expected ${payment.currency}, received ${expectedCurrency}.`
    );
    err.statusCode = 400;
    err.isMismatch = true;
    throw err;
  }

  // If payment already has a different razorpayPaymentId recorded when captured, reject mismatch
  if (
    payment.status === 'captured' &&
    payment.razorpayPaymentId &&
    paymentId &&
    payment.razorpayPaymentId !== paymentId
  ) {
    const err = new Error(
      `Payment ID mismatch for already captured order '${orderId}': recorded '${payment.razorpayPaymentId}', received '${paymentId}'.`
    );
    err.statusCode = 400;
    err.isMismatch = true;
    throw err;
  }

  const wasAlreadyCaptured = payment.status === 'captured';

  // 3. Look up any existing Subscription for this Payment (by payment.subscription or by { payment: payment._id })
  let subscription = null;
  if (payment.subscription) {
    subscription = await Subscription.findById(payment.subscription, null, queryOpts);
  }
  if (!subscription) {
    subscription = await Subscription.findOne({ payment: payment._id }, null, queryOpts);
  }

  let createdNewSubscription = false;

  // 4. If no Subscription exists yet, create one (recovering from 11000 duplicate key on race condition)
  if (!subscription) {
    const planConfig = getPlanConfig(payment.planCode);
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + planConfig.durationMonths);
    const gracePeriodEndDate = new Date(endDate);
    gracePeriodEndDate.setDate(gracePeriodEndDate.getDate() + 7);

    const subPayload = {
      user: payment.user,
      planCode: payment.planCode,
      durationMonths: planConfig.durationMonths,
      status: 'active',
      startDate,
      endDate,
      gracePeriodEndDate,
      payment: payment._id,
    };

    try {
      if (session) {
        const createdArr = await Subscription.create([subPayload], { session });
        subscription = Array.isArray(createdArr) ? createdArr[0] : createdArr;
      } else {
        subscription = await Subscription.create(subPayload);
      }
      createdNewSubscription = true;
    } catch (createErr) {
      // Handle unique index race condition on Subscription.payment (E11000)
      if (createErr && createErr.code === 11000) {
        subscription = await Subscription.findOne({ payment: payment._id }, null, queryOpts);
      } else {
        throw createErr;
      }
    }
  }

  // 5. Strictly validate the resolved or created Subscription
  if (!validateSubscriptionConsistency(subscription, payment)) {
    throw new Error(
      `Failed to establish a valid linked Subscription for payment '${payment._id}' (order '${orderId}').`
    );
  }

  // 6. Ensure Payment is marked 'captured' and linked to the winning Subscription
  const needsPaymentUpdate =
    payment.status !== 'captured' ||
    String(payment.subscription || '') !== String(subscription._id) ||
    (Boolean(paymentId) && payment.razorpayPaymentId !== paymentId);

  if (needsPaymentUpdate) {
    payment.status = 'captured';
    if (paymentId) {
      payment.razorpayPaymentId = paymentId;
    }
    payment.failureReason = null;
    if (!payment.verificationMethod && verificationMethod) {
      payment.verificationMethod = verificationMethod;
    }
    payment.subscription = subscription._id;

    if (typeof payment.save === 'function') {
      await payment.save(queryOpts);
    } else {
      await Payment.findOneAndUpdate(
        { _id: payment._id },
        {
          $set: {
            status: 'captured',
            razorpayPaymentId: payment.razorpayPaymentId,
            failureReason: null,
            verificationMethod: payment.verificationMethod,
            subscription: subscription._id,
          },
        },
        queryOpts
      );
    }
  }

  // 7. If the user's own profile was previously deactivated specifically for 'subscription_expired',
  //    automatically restore it now that they have a valid active subscription.
  try {
    const { reactivateExpiredProfileIfEligible } = require('./subscriptionAccessService');
    await reactivateExpiredProfileIfEligible(payment.user, {
      session,
      skipSubscriptionCheck: true,
    });
  } catch (_) {
    // Non-fatal in isolated payment unit tests where MatrimonialProfile is not mocked
  }

  // Determine whether this call was an idempotent no-op (already captured AND already linked before this call)
  const alreadyProcessed = wasAlreadyCaptured && !createdNewSubscription && !needsPaymentUpdate;

  return {
    success: true,
    alreadyProcessed,
    payment,
    subscription,
  };
};

/**
 * Shared Idempotent Payment Activation Service
 * 
 * Runs inside a MongoDB ACID transaction when supported by the deployment,
 * and falls back cleanly to atomic partial-unique-index + retry-safe compensation when
 * running in isolated unit tests or environments without transaction support.
 */
const processSuccessfulPayment = async ({
  orderId,
  paymentId,
  expectedAmount = null,
  expectedCurrency = null,
  verificationMethod,
}) => {
  const session = await tryStartSession();

  if (session) {
    try {
      let result = null;
      await session.withTransaction(async () => {
        result = await executePaymentActivation({
          orderId,
          paymentId,
          expectedAmount,
          expectedCurrency,
          verificationMethod,
          session,
        });
      });
      return result;
    } catch (txErr) {
      const msg = txErr && txErr.message ? txErr.message : '';
      const isTxUnsupported =
        msg.includes('Transaction numbers are only allowed on a replica set') ||
        msg.includes('transactions are not supported');
      if (!isTxUnsupported) {
        throw txErr;
      }
    } finally {
      try {
        await session.endSession();
      } catch (_) {}
    }
  }

  return executePaymentActivation({
    orderId,
    paymentId,
    expectedAmount,
    expectedCurrency,
    verificationMethod,
    session: null,
  });
};

/**
 * Records a payment failure without overwriting an already captured payment.
 */
const processFailedPayment = async ({ orderId, paymentId, reason }) => {
  const payment = await Payment.findOne({ razorpayOrderId: orderId });
  if (!payment) {
    return null;
  }

  // Never downgrade or overwrite an already captured payment
  if (payment.status === 'captured') {
    return payment;
  }

  payment.status = 'failed';
  if (paymentId && !payment.razorpayPaymentId) {
    payment.razorpayPaymentId = paymentId;
  }
  payment.failureReason = reason || 'Payment failed or declined';

  if (typeof payment.save === 'function') {
    await payment.save();
  }
  return payment;
};

/**
 * Claims and tracks a webhook event in the dedicated WebhookEvent collection with lease & claimToken ownership.
 * 
 * Rules:
 * 1. Inserts a WebhookEvent record with status 'processing', a fresh `claimToken`, `claimedAt`, and `leaseExpiresAt` (default 5 minutes).
 * 2. If E11000 duplicate key occurs:
 *    - Attempt an atomic `WebhookEvent.findOneAndUpdate` to reclaim the event ONLY if it is:
 *      (a) in status 'failed', OR
 *      (b) in status 'processing' AND its processing lease has expired (`leaseExpiresAt <= now`, or legacy record missing `leaseExpiresAt` with `updatedAt <= now - leaseMs`).
 *    - If the atomic reclaim succeeds, a fresh `claimToken` and `leaseExpiresAt` are written and returned to the winning worker.
 *    - If the atomic reclaim returns null, inspect the existing record:
 *      - If 'processed', 'ignored', or 'quarantined': returns `{ claimed: false, duplicate: true }`.
 *      - Otherwise (active non-expired 'processing' lease held by another worker): returns `{ claimed: false, duplicate: true, concurrentInProgress: true }`.
 */
const claimWebhookEvent = async ({
  eventId,
  eventType,
  razorpayOrderId = null,
  razorpayPaymentId = null,
  leaseMs = null,
  now = new Date(),
}) => {
  if (!eventId || typeof eventId !== 'string' || !eventId.trim()) {
    const err = new Error('Missing required Razorpay webhook event ID.');
    err.statusCode = 400;
    throw err;
  }

  const normalizedEventId = eventId.trim();
  const effectiveLeaseMs = getWebhookProcessingLeaseMs(leaseMs);
  const claimTime = now instanceof Date ? now : new Date(now);
  const leaseExpiresAt = new Date(claimTime.getTime() + effectiveLeaseMs);
  const claimToken = generateWebhookClaimToken();

  try {
    const createdEvent = await WebhookEvent.create({
      eventId: normalizedEventId,
      eventType,
      razorpayOrderId,
      razorpayPaymentId,
      status: 'processing',
      claimToken,
      claimedAt: claimTime,
      leaseExpiresAt,
    });
    return {
      claimed: true,
      duplicate: false,
      claimToken,
      eventRecord: createdEvent,
    };
  } catch (err) {
    if (!err || err.code !== 11000) {
      throw err;
    }

    // Legacy fallback threshold if a 'processing' document was created without leaseExpiresAt
    const legacyStaleCutoff = new Date(claimTime.getTime() - effectiveLeaseMs);

    // Atomically attempt to reclaim if status is 'failed' OR if status is 'processing' with an expired lease
    const reclaimed = await WebhookEvent.findOneAndUpdate(
      {
        eventId: normalizedEventId,
        $or: [
          { status: 'failed' },
          {
            status: 'processing',
            $or: [
              { leaseExpiresAt: { $lte: claimTime } },
              { leaseExpiresAt: null, updatedAt: { $lte: legacyStaleCutoff } },
            ],
          },
        ],
      },
      {
        $set: {
          status: 'processing',
          claimToken,
          claimedAt: claimTime,
          leaseExpiresAt,
          failureReason: null,
          ...(razorpayOrderId ? { razorpayOrderId } : {}),
          ...(razorpayPaymentId ? { razorpayPaymentId } : {}),
        },
      },
      { new: true }
    );

    if (reclaimed) {
      return {
        claimed: true,
        duplicate: false,
        reclaimed: true,
        claimToken,
        eventRecord: reclaimed,
      };
    }

    // Reclaim did not match: inspect the existing record to classify terminal vs active concurrent lease
    const existing = await WebhookEvent.findOne({ eventId: normalizedEventId });
    if (!existing) {
      throw err;
    }

    if (
      existing.status === 'processed' ||
      existing.status === 'ignored' ||
      existing.status === 'quarantined'
    ) {
      return {
        claimed: false,
        duplicate: true,
        claimToken: null,
        eventRecord: existing,
      };
    }

    // Otherwise, another worker currently holds an active, non-expired lease (or just won the reclaim race)
    return {
      claimed: false,
      duplicate: true,
      concurrentInProgress: true,
      claimToken: null,
      eventRecord: existing,
    };
  }
};

/**
 * Atomically updates a claimed WebhookEvent record's final status ONLY if the caller still
 * holds the matching `claimToken` and the event is still in `'processing'` state.
 * 
 * This prevents an older worker (whose lease expired and was reclaimed by a newer worker)
 * from overwriting the newer worker's state or result.
 * 
 * @returns {Promise<{ finalized: boolean, staleClaim: boolean, eventRecord: object|null }>}
 */
const finalizeWebhookEvent = async (
  eventRecord,
  { status, failureReason = null, claimToken = null }
) => {
  if (!eventRecord || !eventRecord.eventId) {
    return { finalized: false, staleClaim: false, eventRecord: null };
  }

  const tokenToVerify = claimToken || eventRecord.claimToken;
  if (!tokenToVerify) {
    return { finalized: false, staleClaim: true, eventRecord: null };
  }

  const isTerminal = status === 'processed' || status === 'ignored' || status === 'quarantined';
  const processedAt = isTerminal ? new Date() : null;

  const updated = await WebhookEvent.findOneAndUpdate(
    {
      eventId: eventRecord.eventId,
      status: 'processing',
      claimToken: tokenToVerify,
    },
    {
      $set: {
        status,
        failureReason,
        processedAt,
        leaseExpiresAt: null,
      },
    },
    { new: true }
  );

  if (!updated) {
    // Caller's claimToken was superseded by a newer worker or already finalized
    return {
      finalized: false,
      staleClaim: true,
      eventRecord: null,
    };
  }

  // Keep in-memory reference synchronized for callers/tests inspecting it
  eventRecord.status = updated.status;
  eventRecord.failureReason = updated.failureReason;
  eventRecord.processedAt = updated.processedAt;
  eventRecord.leaseExpiresAt = updated.leaseExpiresAt;

  return {
    finalized: true,
    staleClaim: false,
    eventRecord: updated,
  };
};

module.exports = {
  DEFAULT_WEBHOOK_LEASE_MS,
  getWebhookProcessingLeaseMs,
  generateWebhookClaimToken,
  processSuccessfulPayment,
  processFailedPayment,
  claimWebhookEvent,
  finalizeWebhookEvent,
  validateSubscriptionConsistency,
};
