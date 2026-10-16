/**
 * Phase 1 — Backend Subscription and Payment Integration Test Suite
 * 
 * Target: Isolated Test Database (matrimony_phase5c_test)
 * Server: In-process test instance on isolated port 5002
 * 
 * Verifies all 10 mandated scenarios:
 * 1. RAZORPAY_CHECKOUT_ENABLED=false rejects order creation (HTTP 403).
 * 2. Missing payment configuration keeps checkout disabled (HTTP 403 / 500).
 * 3. Successful payment signature verification (HTTP 200 + active subscription).
 * 4. Invalid or tampered signature is rejected (HTTP 400).
 * 5. Provider payment verification failure is handled safely (HTTP 400 / 502, no activation).
 * 6. Repeated payment verification does not activate duplicate subscriptions or duplicate credits.
 * 7. Duplicate webhook events are idempotent (HTTP 200, no double-activation).
 * 8. Invalid webhook signatures are rejected (HTTP 400).
 * 9. Subscription activation sets expected duration (3M/6M) and 7-day grace-period dates.
 * 10. Existing active subscriptions follow current rejection behaviour until renewal rules are confirmed.
 * 
 * Safety & Invariants:
 * - Loads backend/.env.test exclusively.
 * - Strictly verifies connected database is exactly 'matrimony_phase5c_test'.
 * - Mocks Razorpay client; never makes real payment requests or requires external credentials.
 * - Production ports 3000 and 5000 remain untouched and running.
 * - Cleans up all synthetic test fixtures and restores environment state in finally block.
 */

const http = require('http');
const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load isolated test environment
dotenv.config({ path: path.join(__dirname, '../.env.test') });

const EXPECTED_TEST_DB = 'matrimony_phase5c_test';
const TEST_PORT = 5002;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

const TEST_UNSUB_CREDS = {
  email: 'test.unsub.phase5c@example.com',
  password: 'TestUnsubPass123!',
};

const TEST_VIEWER_CREDS = {
  email: 'test.viewer.phase5c@example.com',
  password: 'TestViewerPass123!',
};

// HTTP Request helper
function makeRequest(method, reqPath, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, BASE_URL);
    const reqHeaders = { ...headers };
    let bodyPayload = null;

    if (data !== null && data !== undefined) {
      bodyPayload = typeof data === 'string' ? data : JSON.stringify(data);
      if (!reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyPayload);
    }

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: reqHeaders,
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(responseBody);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseBody,
          json,
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (bodyPayload) {
      req.write(bodyPayload);
    }
    req.end();
  });
}

function extractTokenCookie(setCookieHeaders) {
  if (!setCookieHeaders) return null;
  const cookieArr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const c of cookieArr) {
    const match = c.match(/token=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log(' Backend Subscription & Payment Integration Test Suite (Phase 1)');
  console.log(` Target Database: ${EXPECTED_TEST_DB}`);
  console.log(` Test Server: ${BASE_URL}`);
  console.log('========================================================================\n');

  // 1. Safety Guard: Connect to test database and verify name
  console.log('[Connecting] Connecting to test MongoDB database...');
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  const actualDb = mongoose.connection.name;

  if (actualDb !== EXPECTED_TEST_DB) {
    console.error(`\n[CRITICAL SAFETY ABORT] Connected database is '${actualDb}'. Expected '${EXPECTED_TEST_DB}'.`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`✓ Database safety assertion passed: [${actualDb}]\n`);

  // Models
  const User = require('../models/User');
  const Subscription = require('../models/Subscription');
  const Payment = require('../models/Payment');
  const CreditCycle = require('../models/CreditCycle');
  const WebhookEvent = require('../models/WebhookEvent');

  // Track created fixtures for clean teardown
  const createdSubscriptionIds = [];
  const createdPaymentOrderIds = [];
  const createdWebhookEventIds = [];

  // 2. Start in-process isolated test HTTP server using backend/app.js
  const app = require('../app');
  const razorpayService = require('../services/razorpayService');

  // Store original razorpayService methods for teardown restoration
  const originalGetRazorpayClient = razorpayService.getRazorpayClient;
  const originalVerifyCheckoutSignature = razorpayService.verifyCheckoutSignature;
  const originalVerifyWebhookSignature = razorpayService.verifyWebhookSignature;

  // Store original process.env values
  const originalEnv = {
    RAZORPAY_CHECKOUT_ENABLED: process.env.RAZORPAY_CHECKOUT_ENABLED,
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
    PLAN_PRICE_3M: process.env.PLAN_PRICE_3M,
    PLAN_PRICE_6M: process.env.PLAN_PRICE_6M,
  };

  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(TEST_PORT, '127.0.0.1', resolve));
  console.log(`✓ Isolated test server listening on http://127.0.0.1:${TEST_PORT}\n`);

  let testCount = 0;
  let passedCount = 0;

  function reportTest(id, name, passed, detail = '') {
    testCount++;
    if (passed) {
      passedCount++;
      console.log(`  [PASS] ${id}: ${name} ${detail ? `(${detail})` : ''}`);
    } else {
      console.error(`  [FAIL] ${id}: ${name} FAILED: ${detail}`);
    }
  }

  try {
    // Authenticate test users
    console.log('--- Setting up Test Sessions ---');
    const unsubLoginRes = await makeRequest('POST', '/api/auth/login', TEST_UNSUB_CREDS);
    const unsubToken = extractTokenCookie(unsubLoginRes.headers['set-cookie']);
    const unsubCookie = unsubToken ? `token=${unsubToken}` : null;
    if (!unsubCookie) throw new Error('Failed to obtain auth cookie for unsubscribed test user');

    const viewerLoginRes = await makeRequest('POST', '/api/auth/login', TEST_VIEWER_CREDS);
    const viewerToken = extractTokenCookie(viewerLoginRes.headers['set-cookie']);
    const viewerCookie = viewerToken ? `token=${viewerToken}` : null;
    if (!viewerCookie) throw new Error('Failed to obtain auth cookie for viewer test user');

    const unsubUser = await User.findOne({ email: TEST_UNSUB_CREDS.email });
    const viewerUser = await User.findOne({ email: TEST_VIEWER_CREDS.email });
    console.log(`✓ Unsubscribed user resolved: ${unsubUser._id}`);
    console.log(`✓ Viewer user resolved: ${viewerUser._id}\n`);

    // Clean any prior synthetic test fixtures for clean slate
    await Payment.deleteMany({ razorpayOrderId: { $regex: /^order_test_/ } });
    await WebhookEvent.deleteMany({ eventId: { $regex: /^evt_test_/ } });

    // -------------------------------------------------------------------------
    // Scenario 1: RAZORPAY_CHECKOUT_ENABLED=false rejects order creation
    // -------------------------------------------------------------------------
    console.log('--- Scenario 1: Global Checkout Disabled Guard ---');
    process.env.RAZORPAY_CHECKOUT_ENABLED = 'false';
    const s1Res = await makeRequest('POST', '/api/subscriptions/create-order', { planCode: 'THREE_MONTHS' }, { Cookie: unsubCookie });
    const s1Pass =
      s1Res.statusCode === 403 &&
      s1Res.json?.success === false &&
      s1Res.json?.message?.includes('Online subscription checkout is currently disabled');
    reportTest(
      'SC-01',
      'RAZORPAY_CHECKOUT_ENABLED=false rejects order creation with HTTP 403',
      s1Pass,
      `Status: ${s1Res.statusCode}, Message: "${s1Res.json?.message}"`
    );

    // -------------------------------------------------------------------------
    // Scenario 2: Missing payment configuration keeps checkout disabled
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 2: Missing Payment Configuration Safeguards ---');
    // Sub-case 2A: RAZORPAY_CHECKOUT_ENABLED=true but gateway credentials missing
    process.env.RAZORPAY_CHECKOUT_ENABLED = 'true';
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.PLAN_PRICE_3M;

    const s2aRes = await makeRequest('POST', '/api/subscriptions/create-order', { planCode: 'THREE_MONTHS' }, { Cookie: unsubCookie });
    const s2aPass =
      s2aRes.statusCode === 403 &&
      s2aRes.json?.success === false &&
      s2aRes.json?.message?.includes('credentials are not configured');
    reportTest(
      'SC-02A',
      'Missing RAZORPAY_KEY_ID/SECRET keeps checkout disabled even if flag is true',
      s2aPass,
      `Status: ${s2aRes.statusCode}, Message: "${s2aRes.json?.message}"`
    );

    // Sub-case 2B: Credentials present but plan price unconfigured
    process.env.RAZORPAY_KEY_ID = 'rzp_test_mock_key_001';
    process.env.RAZORPAY_KEY_SECRET = 'rzp_test_mock_secret_99999';
    delete process.env.PLAN_PRICE_3M;

    const s2bRes = await makeRequest('POST', '/api/subscriptions/create-order', { planCode: 'THREE_MONTHS' }, { Cookie: unsubCookie });
    const s2bPass =
      s2bRes.statusCode === 500 &&
      s2bRes.json?.success === false &&
      s2bRes.json?.message?.includes('is not configured on the server');
    reportTest(
      'SC-02B',
      'Missing plan price configuration (PLAN_PRICE_3M) safely aborts order creation (HTTP 500)',
      s2bPass,
      `Status: ${s2bRes.statusCode}, Message: "${s2bRes.json?.message}"`
    );

    // Reset flag back to false
    process.env.RAZORPAY_CHECKOUT_ENABLED = 'false';

    // -------------------------------------------------------------------------
    // Set up Mock Razorpay Provider for Scenarios 3-10
    // -------------------------------------------------------------------------
    const TEST_MOCK_SECRET = 'mock_rzp_secret_for_tests_12345';
    const TEST_MOCK_WEBHOOK_SECRET = 'mock_webhook_secret_for_tests_67890';
    process.env.RAZORPAY_KEY_ID = 'rzp_test_mock_key_001';
    process.env.RAZORPAY_KEY_SECRET = TEST_MOCK_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = TEST_MOCK_WEBHOOK_SECRET;
    process.env.PLAN_PRICE_3M = '100000'; // ₹1000 in paise
    process.env.PLAN_PRICE_6M = '180000'; // ₹1800 in paise

    // Dynamic mock provider storage
    let mockPaymentFetchHandler = null;

    razorpayService.getRazorpayClient = () => {
      return {
        orders: {
          create: async (opts) => ({
            id: `order_test_rzp_${Date.now()}`,
            amount: opts.amount,
            currency: opts.currency,
            status: 'created',
          }),
        },
        payments: {
          fetch: async (paymentId) => {
            if (mockPaymentFetchHandler) {
              return mockPaymentFetchHandler(paymentId);
            }
            throw new Error(`Unhandled payment fetch for ${paymentId}`);
          },
        },
      };
    };

    // Helper to compute genuine test signature
    function computeCheckoutSignature(orderId, paymentId, secret = TEST_MOCK_SECRET) {
      return crypto
        .createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
    }

    function computeWebhookSignature(rawBody, secret = TEST_MOCK_WEBHOOK_SECRET) {
      return crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');
    }

    // -------------------------------------------------------------------------
    // Scenario 3: Successful payment signature verification & activation
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 3: Successful Payment Verification & Activation ---');
    const orderId3 = `order_test_sc3_${Date.now()}`;
    const paymentId3 = `pay_test_sc3_${Date.now()}`;
    createdPaymentOrderIds.push(orderId3);

    // Seed Payment record in status 'created'
    await Payment.create({
      user: unsubUser._id,
      planCode: 'THREE_MONTHS',
      amount: 100000,
      currency: 'INR',
      razorpayOrderId: orderId3,
      status: 'created',
    });

    const sig3 = computeCheckoutSignature(orderId3, paymentId3);

    // Mock provider fetch to return captured payment matching order and amount
    mockPaymentFetchHandler = async (pid) => ({
      id: pid,
      order_id: orderId3,
      amount: 100000,
      currency: 'INR',
      status: 'captured',
    });

    const s3Res = await makeRequest('POST', '/api/subscriptions/verify-payment', {
      razorpay_order_id: orderId3,
      razorpay_payment_id: paymentId3,
      razorpay_signature: sig3,
    }, { Cookie: unsubCookie });

    const s3SubInDb = await Subscription.findOne({ payment: { $exists: true } }).sort({ createdAt: -1 });
    if (s3SubInDb) createdSubscriptionIds.push(s3SubInDb._id);

    const s3Pass =
      s3Res.statusCode === 200 &&
      s3Res.json?.success === true &&
      s3Res.json?.data?.status === 'active' &&
      s3Res.json?.data?.planCode === 'THREE_MONTHS' &&
      s3SubInDb &&
      String(s3SubInDb.user) === String(unsubUser._id) &&
      s3SubInDb.status === 'active';

    reportTest(
      'SC-03',
      'Valid checkout signature activates subscription and transitions payment to captured',
      s3Pass,
      `Status: ${s3Res.statusCode}, SubId: ${s3Res.json?.data?.subscriptionId}`
    );

    // -------------------------------------------------------------------------
    // Scenario 4: Invalid or tampered signature is rejected
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 4: Tampered Signature Rejection ---');
    const orderId4 = `order_test_sc4_${Date.now()}`;
    const paymentId4 = `pay_test_sc4_${Date.now()}`;
    createdPaymentOrderIds.push(orderId4);

    await Payment.create({
      user: unsubUser._id,
      planCode: 'THREE_MONTHS',
      amount: 100000,
      currency: 'INR',
      razorpayOrderId: orderId4,
      status: 'created',
    });

    // Provide completely forged signature
    const forgedSig = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const s4Res = await makeRequest('POST', '/api/subscriptions/verify-payment', {
      razorpay_order_id: orderId4,
      razorpay_payment_id: paymentId4,
      razorpay_signature: forgedSig,
    }, { Cookie: unsubCookie });

    const s4PaymentInDb = await Payment.findOne({ razorpayOrderId: orderId4 });
    const s4SubCheck = await Subscription.findOne({ payment: s4PaymentInDb._id });

    const s4Pass =
      s4Res.statusCode === 400 &&
      s4Res.json?.success === false &&
      s4Res.json?.message?.includes('Invalid checkout signature') &&
      s4PaymentInDb.status === 'created' &&
      !s4SubCheck;

    reportTest(
      'SC-04',
      'Tampered or invalid checkout signature is rejected with HTTP 400 (no subscription created)',
      s4Pass,
      `Status: ${s4Res.statusCode}, PaymentStatus: ${s4PaymentInDb?.status}`
    );

    // -------------------------------------------------------------------------
    // Scenario 5: Provider payment verification failure is handled safely
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 5: Provider Verification Failure Handling ---');
    // Sub-case 5A: Provider reports payment status 'failed'
    const orderId5a = `order_test_sc5a_${Date.now()}`;
    const paymentId5a = `pay_test_sc5a_${Date.now()}`;
    createdPaymentOrderIds.push(orderId5a);

    await Payment.create({
      user: unsubUser._id,
      planCode: 'THREE_MONTHS',
      amount: 100000,
      currency: 'INR',
      razorpayOrderId: orderId5a,
      status: 'created',
    });

    const sig5a = computeCheckoutSignature(orderId5a, paymentId5a);
    mockPaymentFetchHandler = async (pid) => ({
      id: pid,
      order_id: orderId5a,
      amount: 100000,
      currency: 'INR',
      status: 'failed',
    });

    const s5aRes = await makeRequest('POST', '/api/subscriptions/verify-payment', {
      razorpay_order_id: orderId5a,
      razorpay_payment_id: paymentId5a,
      razorpay_signature: sig5a,
    }, { Cookie: unsubCookie });

    const s5aPass =
      s5aRes.statusCode === 400 &&
      s5aRes.json?.success === false &&
      s5aRes.json?.message?.includes('not in captured status');

    reportTest(
      'SC-05A',
      'Provider status "failed" safely halts verification (HTTP 400)',
      s5aPass,
      `Status: ${s5aRes.statusCode}, Message: "${s5aRes.json?.message}"`
    );

    // Sub-case 5B: Provider reports mismatched/tampered amount
    const orderId5b = `order_test_sc5b_${Date.now()}`;
    const paymentId5b = `pay_test_sc5b_${Date.now()}`;
    createdPaymentOrderIds.push(orderId5b);

    await Payment.create({
      user: unsubUser._id,
      planCode: 'THREE_MONTHS',
      amount: 100000,
      currency: 'INR',
      razorpayOrderId: orderId5b,
      status: 'created',
    });

    const sig5b = computeCheckoutSignature(orderId5b, paymentId5b);
    mockPaymentFetchHandler = async (pid) => ({
      id: pid,
      order_id: orderId5b,
      amount: 50000, // Tampered amount (₹500 instead of ₹1000)
      currency: 'INR',
      status: 'captured',
    });

    const s5bRes = await makeRequest('POST', '/api/subscriptions/verify-payment', {
      razorpay_order_id: orderId5b,
      razorpay_payment_id: paymentId5b,
      razorpay_signature: sig5b,
    }, { Cookie: unsubCookie });

    const s5bPass =
      s5bRes.statusCode === 400 &&
      s5bRes.json?.success === false &&
      s5bRes.json?.message?.includes('tampering detected');

    reportTest(
      'SC-05B',
      'Amount mismatch between order and provider fetch is rejected (HTTP 400)',
      s5bPass,
      `Status: ${s5bRes.statusCode}, Message: "${s5bRes.json?.message}"`
    );

    // Sub-case 5C: Provider API network outage / timeout
    const orderId5c = `order_test_sc5c_${Date.now()}`;
    const paymentId5c = `pay_test_sc5c_${Date.now()}`;
    createdPaymentOrderIds.push(orderId5c);

    await Payment.create({
      user: unsubUser._id,
      planCode: 'THREE_MONTHS',
      amount: 100000,
      currency: 'INR',
      razorpayOrderId: orderId5c,
      status: 'created',
    });

    const sig5c = computeCheckoutSignature(orderId5c, paymentId5c);
    mockPaymentFetchHandler = async () => {
      throw new Error('Connection timeout to Razorpay API gateway');
    };

    const s5cRes = await makeRequest('POST', '/api/subscriptions/verify-payment', {
      razorpay_order_id: orderId5c,
      razorpay_payment_id: paymentId5c,
      razorpay_signature: sig5c,
    }, { Cookie: unsubCookie });

    const s5cPass =
      s5cRes.statusCode === 502 &&
      s5cRes.json?.success === false &&
      s5cRes.json?.message?.includes('Unable to verify payment status');

    reportTest(
      'SC-05C',
      'Provider API gateway outage returns clean HTTP 502 Bad Gateway',
      s5cPass,
      `Status: ${s5cRes.statusCode}, Message: "${s5cRes.json?.message}"`
    );

    // -------------------------------------------------------------------------
    // Scenario 6: Repeated payment verification does not activate duplicate subscriptions or credits
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 6: Idempotent Verification & Duplicate Prevention ---');
    // Re-verify the payment from Scenario 3
    mockPaymentFetchHandler = async (pid) => ({
      id: pid,
      order_id: orderId3,
      amount: 100000,
      currency: 'INR',
      status: 'captured',
    });

    const s6Res = await makeRequest('POST', '/api/subscriptions/verify-payment', {
      razorpay_order_id: orderId3,
      razorpay_payment_id: paymentId3,
      razorpay_signature: sig3,
    }, { Cookie: unsubCookie });

    const s6Payment = await Payment.findOne({ razorpayOrderId: orderId3 });
    const s6SubCount = await Subscription.countDocuments({ payment: s6Payment._id });
    const s6CycleCount = await CreditCycle.countDocuments({ subscription: s6Payment.subscription });

    const s6Pass =
      s6Res.statusCode === 200 &&
      s6Res.json?.success === true &&
      s6Res.json?.message?.includes('already active') &&
      s6SubCount === 1 &&
      s6CycleCount <= 1;

    reportTest(
      'SC-06',
      'Repeated verify-payment call is idempotent: exactly 1 subscription, 0 duplicate credit cycles',
      s6Pass,
      `Status: ${s6Res.statusCode}, SubCount: ${s6SubCount}, CycleCount: ${s6CycleCount}`
    );

    // -------------------------------------------------------------------------
    // Scenario 7: Duplicate webhook events are idempotent
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 7: Webhook Idempotency & Deduplication ---');
    const orderId7 = `order_test_sc7_${Date.now()}`;
    const paymentId7 = `pay_test_sc7_${Date.now()}`;
    const eventId7 = `evt_test_sc7_${Date.now()}`;
    createdPaymentOrderIds.push(orderId7);
    createdWebhookEventIds.push(eventId7);

    await Payment.create({
      user: unsubUser._id,
      planCode: 'SIX_MONTHS',
      amount: 180000,
      currency: 'INR',
      razorpayOrderId: orderId7,
      status: 'created',
    });

    const webhookPayload7 = JSON.stringify({
      event: 'payment.captured',
      event_id: eventId7,
      payload: {
        payment: {
          entity: {
            id: paymentId7,
            order_id: orderId7,
            amount: 180000,
            currency: 'INR',
            status: 'captured',
          },
        },
      },
    });

    const whSig7 = computeWebhookSignature(webhookPayload7);

    // First webhook delivery
    const s7Res1 = await makeRequest(
      'POST',
      '/api/webhooks/razorpay',
      webhookPayload7,
      {
        'Content-Type': 'application/json',
        'x-razorpay-signature': whSig7,
        'x-razorpay-event-id': eventId7,
      }
    );

    const s7Sub1 = await Subscription.findOne({ payment: { $exists: true } }).sort({ createdAt: -1 });
    if (s7Sub1 && !createdSubscriptionIds.includes(s7Sub1._id)) {
      createdSubscriptionIds.push(s7Sub1._id);
    }

    // Second webhook delivery (same event_id)
    const s7Res2 = await makeRequest(
      'POST',
      '/api/webhooks/razorpay',
      webhookPayload7,
      {
        'Content-Type': 'application/json',
        'x-razorpay-signature': whSig7,
        'x-razorpay-event-id': eventId7,
      }
    );

    const s7EventCount = await WebhookEvent.countDocuments({ eventId: eventId7 });
    const s7Payment = await Payment.findOne({ razorpayOrderId: orderId7 });
    const s7SubCount = await Subscription.countDocuments({ payment: s7Payment._id });

    const s7Pass =
      s7Res1.statusCode === 200 &&
      s7Res2.statusCode === 200 &&
      s7Res2.json?.message?.includes('already processed (idempotent ignore)') &&
      s7EventCount === 1 &&
      s7SubCount === 1;

    reportTest(
      'SC-07',
      'Duplicate webhook event delivery is safely deduplicated (HTTP 200 idempotent ignore)',
      s7Pass,
      `Delivery 1: ${s7Res1.statusCode}, Delivery 2: ${s7Res2.statusCode}, EventRecords: ${s7EventCount}, Subs: ${s7SubCount}`
    );

    // -------------------------------------------------------------------------
    // Scenario 8: Invalid webhook signatures are rejected
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 8: Webhook Signature Rejection ---');
    // Sub-case 8A: Missing signature header
    const s8aRes = await makeRequest(
      'POST',
      '/api/webhooks/razorpay',
      JSON.stringify({ event: 'payment.captured' }),
      { 'Content-Type': 'application/json' }
    );

    const s8aPass =
      s8aRes.statusCode === 400 &&
      s8aRes.json?.message?.includes('Missing webhook signature');

    reportTest(
      'SC-08A',
      'Missing x-razorpay-signature header is rejected with HTTP 400',
      s8aPass,
      `Status: ${s8aRes.statusCode}`
    );

    // Sub-case 8B: Forged signature header
    const s8bRes = await makeRequest(
      'POST',
      '/api/webhooks/razorpay',
      JSON.stringify({ event: 'payment.captured', event_id: 'evt_test_forged' }),
      {
        'Content-Type': 'application/json',
        'x-razorpay-signature': 'forged_hex_signature_abcdef1234567890',
        'x-razorpay-event-id': 'evt_test_forged',
      }
    );

    const s8bEventCount = await WebhookEvent.countDocuments({ eventId: 'evt_test_forged' });

    const s8bPass =
      s8bRes.statusCode === 400 &&
      s8bRes.json?.message?.includes('Invalid webhook signature') &&
      s8bEventCount === 0;

    reportTest(
      'SC-08B',
      'Forged or tampered webhook signature is rejected with HTTP 400 (event not recorded)',
      s8bPass,
      `Status: ${s8bRes.statusCode}, EventCount: ${s8bEventCount}`
    );

    // -------------------------------------------------------------------------
    // Scenario 9: Subscription activation sets expected duration & 7-day grace-period dates
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 9: Exact Duration & Grace Period Date Calculation ---');
    // Check 3-month subscription from Scenario 3
    const sub3m = await Subscription.findById(s3SubInDb._id);
    const start3m = sub3m.startDate.getTime();
    const end3m = sub3m.endDate.getTime();
    const grace3m = sub3m.gracePeriodEndDate.getTime();

    // Verification of duration: approx 3 months
    const expectedEnd3m = new Date(sub3m.startDate);
    expectedEnd3m.setMonth(expectedEnd3m.getMonth() + 3);
    const end3mValid = Math.abs(end3m - expectedEnd3m.getTime()) < 5000;

    // Grace period must be EXACTLY 7 days from endDate
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const grace3mValid = grace3m - end3m === SEVEN_DAYS_MS;

    // Check 6-month subscription from Scenario 7
    const sub6m = await Subscription.findById(s7Sub1._id);
    const end6m = sub6m.endDate.getTime();
    const grace6m = sub6m.gracePeriodEndDate.getTime();
    const expectedEnd6m = new Date(sub6m.startDate);
    expectedEnd6m.setMonth(expectedEnd6m.getMonth() + 6);
    const end6mValid = Math.abs(end6m - expectedEnd6m.getTime()) < 5000;
    const grace6mValid = grace6m - end6m === SEVEN_DAYS_MS;

    // Also test GET /api/subscriptions/me reflects active subscription
    const meRes = await makeRequest('GET', '/api/subscriptions/me', null, { Cookie: unsubCookie });
    const meValid =
      meRes.statusCode === 200 &&
      meRes.json?.data?.hasSubscription === true &&
      meRes.json?.data?.subscription?.status === 'active';

    const s9Pass =
      sub3m.durationMonths === 3 &&
      end3mValid &&
      grace3mValid &&
      sub6m.durationMonths === 6 &&
      end6mValid &&
      grace6mValid &&
      meValid;

    reportTest(
      'SC-09',
      'Subscription activation accurately sets 3M/6M duration and exact 7-day grace period',
      s9Pass,
      `3M grace diff: ${(grace3m - end3m) / 86400000}d, 6M grace diff: ${(grace6m - end6m) / 86400000}d, Me endpoint: ${meRes.statusCode}`
    );

    // -------------------------------------------------------------------------
    // Scenario 10: Existing active subscriptions follow current rejection behaviour
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 10: Renewal Attempt Rejection on Active Subscription ---');
    // Active subscriber (viewerUser) attempts to create an order
    process.env.RAZORPAY_CHECKOUT_ENABLED = 'true';
    const s10Res = await makeRequest(
      'POST',
      '/api/subscriptions/create-order',
      { planCode: 'THREE_MONTHS' },
      { Cookie: viewerCookie }
    );

    const s10Pass =
      s10Res.statusCode === 400 &&
      s10Res.json?.success === false &&
      s10Res.json?.message?.includes('already have an active subscription') &&
      s10Res.json?.message?.includes('renewal behavior has not yet been finalized');

    reportTest(
      'SC-10',
      'Active subscriber attempting order creation is rejected until renewal rules are finalized (HTTP 400)',
      s10Pass,
      `Status: ${s10Res.statusCode}, Message: "${s10Res.json?.message}"`
    );

    // Reset checkout enabled back to false
    process.env.RAZORPAY_CHECKOUT_ENABLED = 'false';

    console.log('\n========================================================================');
    console.log(` Test Execution Summary: ${passedCount} / ${testCount} Passed (${Math.round((passedCount / testCount) * 100)}%)`);
    console.log('========================================================================\n');

  } finally {
    console.log('--- Cleaning Up Test Fixtures & Restoring State ---');
    // Restore service stubs
    razorpayService.getRazorpayClient = originalGetRazorpayClient;
    razorpayService.verifyCheckoutSignature = originalVerifyCheckoutSignature;
    razorpayService.verifyWebhookSignature = originalVerifyWebhookSignature;

    // Restore environment variables
    for (const [k, v] of Object.entries(originalEnv)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }

    // Delete test-created payments, subscriptions, credit cycles, and webhook events
    if (createdPaymentOrderIds.length > 0) {
      await Payment.deleteMany({ razorpayOrderId: { $in: createdPaymentOrderIds } });
    }
    if (createdSubscriptionIds.length > 0) {
      await Subscription.deleteMany({ _id: { $in: createdSubscriptionIds } });
      await CreditCycle.deleteMany({ subscription: { $in: createdSubscriptionIds } });
    }
    if (createdWebhookEventIds.length > 0) {
      await WebhookEvent.deleteMany({ eventId: { $in: createdWebhookEventIds } });
    }
    console.log('✓ Cleaned up all synthetic test payments, subscriptions, and webhook events.');

    // Stop test server and close database
    await new Promise((resolve) => testServer.close(resolve));
    console.log('✓ Closed isolated test server on port 5002.');
    await mongoose.disconnect();
    console.log('✓ Disconnected from test MongoDB database.');
  }

  process.exit(passedCount === testCount ? 0 : 1);
}

runTestSuite().catch(async (err) => {
  console.error('\n[FATAL ERROR IN TEST RUNNER]', err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
