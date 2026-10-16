/**
 * Phase 4 — Razorpay Test Mode Automated Integration & Security Suite
 * 
 * Target: Isolated backend at http://localhost:5001 connected to 'matrimony_phase5c_test'
 * Tests all order creation, signature validation, idempotent activation, credit allocation,
 * and webhook security invariants without touching production configuration.
 */

const path = require('path');
const http = require('http');
const crypto = require('crypto');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const envTestPath = path.resolve(__dirname, '../.env.test');
dotenv.config({ path: envTestPath });

const { getPlanConfig, isCheckoutEnabled } = require('../config/plans');
const { getRazorpayClient, verifyCheckoutSignature, verifyWebhookSignature } = require('../services/razorpayService');
const { processSuccessfulPayment, processFailedPayment, claimWebhookEvent, finalizeWebhookEvent } = require('../services/paymentService');

const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const CreditCycle = require('../models/CreditCycle');
const WebhookEvent = require('../models/WebhookEvent');

const EXPECTED_TEST_DB = 'matrimony_phase5c_test';

let testCount = 0;
let passedCount = 0;

function report(id, title, passed, detail = '') {
  testCount++;
  if (passed) {
    passedCount++;
    console.log(`  [PASS] ${id}: ${title} ${detail ? `(${detail})` : ''}`);
  } else {
    console.error(`  [FAIL] ${id}: ${title} FAILED: ${detail}`);
  }
}

async function runPhase4IntegrationTests() {
  console.log('========================================================================');
  console.log(' Phase 4: Razorpay Test Mode Integration & Security Verification Suite');
  console.log(' Target DB: matrimony_phase5c_test | Checkout Enabled: Isolated Test');
  console.log('========================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. Preflight Invariants & Secret Safeguards
  // ---------------------------------------------------------------------------
  console.log('1. Checking Preflight Invariants & Production Isolation...');

  const mongoUri = process.env.MONGODB_URI || '';
  let dbName = '';
  try {
    const u = new URL(mongoUri);
    dbName = u.pathname.replace(/^\//, '');
  } catch (_) {
    const parts = mongoUri.split('/');
    dbName = parts[parts.length - 1].split('?')[0];
  }

  report(
    'SEC-01',
    'Test environment strictly connects to matrimony_phase5c_test',
    dbName === EXPECTED_TEST_DB,
    `Connected DB: '${dbName}'`
  );

  const keyId = process.env.RAZORPAY_KEY_ID || '';
  report(
    'SEC-02',
    'Razorpay Key ID is verified Test Mode key starting with rzp_test_',
    keyId.startsWith('rzp_test_'),
    `Prefix: ${keyId.slice(0, 9)}... (length: ${keyId.length})`
  );

  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  report(
    'SEC-03',
    'Razorpay Key Secret is present in test environment and not exposed',
    Boolean(keySecret && keySecret.length >= 10),
    `Length: ${keySecret.length} chars (value redacted)`
  );

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  report(
    'SEC-04',
    'Razorpay Webhook Secret is distinct from Key Secret and strong',
    Boolean(webhookSecret && webhookSecret.length >= 32 && webhookSecret !== keySecret),
    `Length: ${webhookSecret.length} chars (distinct: ${webhookSecret !== keySecret})`
  );

  // Check production .env
  const fs = require('fs');
  const prodEnvPath = path.resolve(__dirname, '../.env');
  const prodEnvContent = fs.readFileSync(prodEnvPath, 'utf8');
  const prodMatch = prodEnvContent.match(/^RAZORPAY_CHECKOUT_ENABLED=(.+)$/m);
  const prodCheckoutSetting = prodMatch ? prodMatch[1].trim() : '';

  report(
    'SEC-05',
    'Production backend/.env strictly retains RAZORPAY_CHECKOUT_ENABLED=false',
    prodCheckoutSetting === 'false',
    `Prod setting: '${prodCheckoutSetting}'`
  );

  // Check test prices
  const plan3M = getPlanConfig('THREE_MONTHS');
  const plan6M = getPlanConfig('SIX_MONTHS');

  report(
    'SEC-06',
    'Temporary sandbox plan amounts are configured to 100 paise and 200 paise',
    plan3M.amount === 100 && plan6M.amount === 200,
    `3M: ${plan3M.amount} paise, 6M: ${plan6M.amount} paise`
  );

  // ---------------------------------------------------------------------------
  // 2. Connect to Test Database & Setup Synthetic Fixtures
  // ---------------------------------------------------------------------------
  console.log('\n2. Connecting to Isolated Test Database...');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  const actualConnDb = mongoose.connection.name;
  if (actualConnDb !== EXPECTED_TEST_DB) {
    throw new Error(`CRITICAL: Connected to '${actualConnDb}' instead of '${EXPECTED_TEST_DB}'`);
  }

  // Find or create synthetic test user for checkout
  let testBuyer = await User.findOne({ email: 'test.phase4.buyer@example.com' });
  if (!testBuyer) {
    testBuyer = await User.create({
      name: 'Phase 4 Test Buyer',
      email: 'test.phase4.buyer@example.com',
      passwordHash: 'dummy_hash_for_test_purposes_only',
      role: 'user',
      accountStatus: 'active',
      registrationSource: 'direct',
    });
  }

  // Clean any previous test artifacts for this buyer
  await Subscription.deleteMany({ user: testBuyer._id });
  await Payment.deleteMany({ user: testBuyer._id });
  await CreditCycle.deleteMany({ user: testBuyer._id });

  // ---------------------------------------------------------------------------
  // 3. Razorpay Order Creation via Sandbox API
  // ---------------------------------------------------------------------------
  console.log('\n3. Testing Razorpay Order Creation via Sandbox API...');

  const rzpClient = getRazorpayClient();
  let createdRzpOrder = null;

  try {
    createdRzpOrder = await rzpClient.orders.create({
      amount: plan3M.amount,
      currency: plan3M.currency,
      receipt: `test_rcpt_${testBuyer._id.toString().slice(-6)}_${Date.now().toString().slice(-4)}`,
      notes: {
        userId: testBuyer._id.toString(),
        planCode: plan3M.code,
      },
    });
  } catch (err) {
    console.error('Order creation error:', err);
  }

  report(
    'ORD-01',
    'Razorpay Sandbox API successfully creates order with status created and matching amount',
    Boolean(createdRzpOrder && createdRzpOrder.id && createdRzpOrder.amount === 100),
    `Order ID: ${createdRzpOrder?.id}, Amount: ${createdRzpOrder?.amount}`
  );

  // Persist corresponding Payment record
  const paymentRecord = await Payment.create({
    user: testBuyer._id,
    planCode: plan3M.code,
    amount: plan3M.amount,
    currency: plan3M.currency,
    razorpayOrderId: createdRzpOrder.id,
    status: 'created',
  });

  report(
    'ORD-02',
    'Backend Payment model persists initial payment order with status created',
    Boolean(paymentRecord && paymentRecord._id && paymentRecord.status === 'created'),
    `Payment ID: ${paymentRecord._id}`
  );

  // ---------------------------------------------------------------------------
  // 4. Checkout Signature Verification & Security
  // ---------------------------------------------------------------------------
  console.log('\n4. Testing Checkout HMAC-SHA256 Signature Verification...');

  const dummyPaymentId = `pay_test_${crypto.randomBytes(6).toString('hex')}`;
  const validPayload = `${createdRzpOrder.id}|${dummyPaymentId}`;
  const validSignature = crypto
    .createHmac('sha256', keySecret.trim())
    .update(validPayload)
    .digest('hex');

  const isValidValid = verifyCheckoutSignature({
    orderId: createdRzpOrder.id,
    paymentId: dummyPaymentId,
    signature: validSignature,
  });

  report(
    'SIG-01',
    'verifyCheckoutSignature validates authentic HMAC-SHA256 signature',
    isValidValid === true,
    'Returned true for authentic signature'
  );

  const tamperedSignature = validSignature.slice(0, -4) + 'abcd';
  const isValidTampered = verifyCheckoutSignature({
    orderId: createdRzpOrder.id,
    paymentId: dummyPaymentId,
    signature: tamperedSignature,
  });

  report(
    'SIG-02',
    'verifyCheckoutSignature rejects tampered signature using timingSafeEqual',
    isValidTampered === false,
    'Returned false for tampered signature'
  );

  const isValidEmpty = verifyCheckoutSignature({
    orderId: createdRzpOrder.id,
    paymentId: dummyPaymentId,
    signature: '',
  });

  report(
    'SIG-03',
    'verifyCheckoutSignature rejects empty or missing signature safely',
    isValidEmpty === false,
    'Returned false for empty signature'
  );

  // ---------------------------------------------------------------------------
  // 5. Subscription Activation & Credit Allocation
  // ---------------------------------------------------------------------------
  console.log('\n5. Testing Subscription Activation & Credit Cycle Allocation...');

  const activationResult = await processSuccessfulPayment({
    orderId: createdRzpOrder.id,
    paymentId: dummyPaymentId,
    expectedAmount: 100,
    expectedCurrency: 'INR',
    verificationMethod: 'client_callback',
  });

  report(
    'ACT-01',
    'processSuccessfulPayment creates active Subscription linked to buyer',
    Boolean(activationResult && activationResult.subscription && activationResult.subscription.status === 'active'),
    `Sub ID: ${activationResult?.subscription?._id}, Status: ${activationResult?.subscription?.status}`
  );

  const sub = activationResult.subscription;
  const expectedEndDays = 90; // ~3 months
  const actualDiffDays = Math.round((new Date(sub.endDate) - new Date(sub.startDate)) / (1000 * 60 * 60 * 24));
  const graceDiffDays = Math.round((new Date(sub.gracePeriodEndDate) - new Date(sub.endDate)) / (1000 * 60 * 60 * 24));

  report(
    'ACT-02',
    'Subscription sets ~3 months duration and exact 7-day grace period',
    actualDiffDays >= 89 && actualDiffDays <= 93 && graceDiffDays === 7,
    `Duration days: ${actualDiffDays}, Grace period days: ${graceDiffDays}`
  );

  // Check Credit Cycle resolution via creditCycleService
  const { getOrCreateCurrentCreditCycle } = require('../services/creditCycleService');
  const cycleResult = await getOrCreateCurrentCreditCycle(sub);
  const creditCycle = cycleResult?.cycle;

  report(
    'ACT-03',
    'Initial credit cycle #1 created with exactly 50 allocated and remaining credits',
    Boolean(creditCycle && creditCycle.cycleNumber === 1 && creditCycle.creditsRemaining === 50 && creditCycle.creditsAllocated === 50),
    `Cycle: ${creditCycle?.cycleNumber}, Credits: ${creditCycle?.creditsRemaining}/${creditCycle?.creditsAllocated}`
  );

  // Check Payment record updated
  const updatedPayment = await Payment.findOne({ razorpayOrderId: createdRzpOrder.id });

  report(
    'ACT-04',
    'Payment record transitioned to captured status with razorpayPaymentId and linked subscription',
    Boolean(updatedPayment && updatedPayment.status === 'captured' && updatedPayment.razorpayPaymentId === dummyPaymentId && updatedPayment.subscription.equals(sub._id)),
    `Status: ${updatedPayment?.status}, PaymentId: ${updatedPayment?.razorpayPaymentId}`
  );

  // Idempotency check: process again with same payment details
  const repeatResult = await processSuccessfulPayment({
    orderId: createdRzpOrder.id,
    paymentId: dummyPaymentId,
    expectedAmount: 100,
    expectedCurrency: 'INR',
    verificationMethod: 'client_callback',
  });

  report(
    'ACT-05',
    'Repeat payment processing is idempotent (alreadyProcessed: true, no duplicate credits)',
    Boolean(repeatResult && repeatResult.alreadyProcessed === true),
    `Already processed flag: ${repeatResult?.alreadyProcessed}`
  );

  const creditCycleCount = await CreditCycle.countDocuments({ user: testBuyer._id, subscription: sub._id });
  report(
    'ACT-06',
    'No duplicate credit cycles allocated upon repeated verification',
    creditCycleCount === 1,
    `Total cycles: ${creditCycleCount}`
  );

  // ---------------------------------------------------------------------------
  // 6. Active Subscription Safeguard (Renewal Policy Pending)
  // ---------------------------------------------------------------------------
  console.log('\n6. Testing Active Subscription Safeguard...');

  const activeSubExists = await Subscription.findOne({
    user: testBuyer._id,
    status: 'active',
    endDate: { $gt: new Date() },
  });

  report(
    'REN-01',
    'User now has an active subscription in database',
    Boolean(activeSubExists),
    `Active sub: ${activeSubExists?._id}`
  );

  // ---------------------------------------------------------------------------
  // 7. Payment Failure Handling
  // ---------------------------------------------------------------------------
  console.log('\n7. Testing Payment Failure Handling...');

  const failedOrder = await rzpClient.orders.create({
    amount: plan6M.amount,
    currency: plan6M.currency,
    receipt: `test_fail_${Date.now().toString().slice(-4)}`,
  });

  const failedPaymentRecord = await Payment.create({
    user: testBuyer._id,
    planCode: plan6M.code,
    amount: plan6M.amount,
    currency: plan6M.currency,
    razorpayOrderId: failedOrder.id,
    status: 'created',
  });

  await processFailedPayment({
    orderId: failedOrder.id,
    paymentId: `pay_fail_${Date.now()}`,
    reason: 'Payment cancelled by user or card declined',
  });

  const updatedFailedRecord = await Payment.findOne({ razorpayOrderId: failedOrder.id });

  report(
    'FAIL-01',
    'processFailedPayment transitions payment status to failed with failureReason recorded',
    Boolean(updatedFailedRecord && updatedFailedRecord.status === 'failed' && updatedFailedRecord.failureReason),
    `Status: ${updatedFailedRecord?.status}, Reason: ${updatedFailedRecord?.failureReason}`
  );

  // ---------------------------------------------------------------------------
  // 8. Webhook Signature & Idempotency Testing
  // ---------------------------------------------------------------------------
  console.log('\n8. Testing Webhook Signature & Deduplication Invariants...');

  const sampleEventId = `evt_test_${crypto.randomBytes(8).toString('hex')}`;
  const rawWebhookBody = JSON.stringify({
    entity: 'event',
    account_id: 'acc_test',
    event: 'payment.captured',
    event_id: sampleEventId,
    payload: {
      payment: {
        entity: {
          id: `pay_wh_${Date.now()}`,
          order_id: createdRzpOrder.id,
          amount: 100,
          currency: 'INR',
          status: 'captured',
        },
      },
    },
  });

  const validWebhookSig = crypto
    .createHmac('sha256', webhookSecret.trim())
    .update(rawWebhookBody)
    .digest('hex');

  const isWebhookSigValid = verifyWebhookSignature({
    rawBody: rawWebhookBody,
    signature: validWebhookSig,
  });

  report(
    'WH-01',
    'verifyWebhookSignature validates genuine webhook HMAC-SHA256 signature',
    isWebhookSigValid === true,
    'Returned true for valid webhook signature'
  );

  const tamperedWebhookSig = validWebhookSig.slice(0, -6) + '123456';
  const isWebhookSigTampered = verifyWebhookSignature({
    rawBody: rawWebhookBody,
    signature: tamperedWebhookSig,
  });

  report(
    'WH-02',
    'verifyWebhookSignature rejects tampered or wrong webhook signature',
    isWebhookSigTampered === false,
    'Returned false for tampered signature'
  );

  // Deduplication check
  const claim1 = await claimWebhookEvent({
    eventId: sampleEventId,
    eventType: 'payment.captured',
    razorpayOrderId: createdRzpOrder.id,
  });

  report(
    'WH-03',
    'claimWebhookEvent successfully claims first occurrence of event ID',
    claim1.claimed === true,
    `Claimed: ${claim1.claimed}`
  );

  await finalizeWebhookEvent(claim1.eventRecord, {
    status: 'processed',
    claimToken: claim1.claimToken,
  });

  const claim2 = await claimWebhookEvent({
    eventId: sampleEventId,
    eventType: 'payment.captured',
    razorpayOrderId: createdRzpOrder.id,
  });

  report(
    'WH-04',
    'claimWebhookEvent idempotently detects duplicate event ID and rejects re-claim',
    claim2.claimed === false,
    `Duplicate claimed: ${claim2.claimed}`
  );

  // ---------------------------------------------------------------------------
  // 9. Cleanup & Summary
  // ---------------------------------------------------------------------------
  console.log('\n9. Cleaning up temporary test fixtures...');
  await Subscription.deleteMany({ user: testBuyer._id });
  await Payment.deleteMany({ user: testBuyer._id });
  await CreditCycle.deleteMany({ user: testBuyer._id });
  await WebhookEvent.deleteOne({ eventId: sampleEventId });
  await User.deleteOne({ _id: testBuyer._id });

  console.log('\n========================================================================');
  console.log(` Phase 4 Razorpay Integration Test Summary: ${passedCount} / ${testCount} Passed (${Math.round((passedCount / testCount) * 100)}%)`);
  console.log('========================================================================\n');

  await mongoose.disconnect();
  process.exit(passedCount === testCount ? 0 : 1);
}

runPhase4IntegrationTests().catch(async (err) => {
  console.error('\n[FATAL ERROR IN TEST SUITE]', err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
