/**
 * Targeted Unit & Contract Test Suite for Frontend API Client Expansion (Phase 2)
 * 
 * Verifies:
 * 1. createSubscriptionOrderApi() sends POST /api/subscriptions/create-order with { planCode }
 * 2. verifySubscriptionPaymentApi() sends POST /api/subscriptions/verify-payment with paymentData
 * 3. getMySubscriptionApi() sends GET /api/subscriptions/me
 * 4. Response parsing: { success, status, data, message }
 * 5. Error handling: HTTP error codes and network connection failures
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Extract the 3 functions or compile test wrapper
const apiFilePath = path.join(__dirname, '../../frontend/src/lib/api.js');
const apiContent = fs.readFileSync(apiFilePath, 'utf8');

// Ensure functions are defined
if (!apiContent.includes('export async function createSubscriptionOrderApi')) {
  throw new Error('createSubscriptionOrderApi is not exported in frontend/src/lib/api.js');
}
if (!apiContent.includes('export async function verifySubscriptionPaymentApi')) {
  throw new Error('verifySubscriptionPaymentApi is not exported in frontend/src/lib/api.js');
}
if (!apiContent.includes('export async function getMySubscriptionApi')) {
  throw new Error('getMySubscriptionApi is not exported in frontend/src/lib/api.js');
}

const TEST_PORT = 5099;
let lastRequest = null;
let mockResponseHandler = null;

// Mock HTTP server to capture exact outgoing fetch requests
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    lastRequest = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: body ? JSON.parse(body) : null,
    };

    if (mockResponseHandler) {
      mockResponseHandler(req, res);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    }
  });
});

async function runTests() {
  console.log('========================================================================');
  console.log(' Frontend API Client Expansion — Contract & Unit Verification');
  console.log('========================================================================\n');

  await new Promise(resolve => server.listen(TEST_PORT, '127.0.0.1', resolve));

  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${TEST_PORT}/api`;
  const { pathToFileURL } = require('url');
  const actualApiModule = await import(pathToFileURL(apiFilePath).href);

  let passed = 0;
  let total = 0;

  function assertTest(id, name, condition, detail = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`  [PASS] ${id}: ${name} ${detail ? `(${detail})` : ''}`);
    } else {
      console.error(`  [FAIL] ${id}: ${name} FAILED: ${detail}`);
    }
  }

  try {
    const {
      createSubscriptionOrderApi,
      verifySubscriptionPaymentApi,
      getMySubscriptionApi,
    } = actualApiModule;

    // 1. Test createSubscriptionOrderApi success
    mockResponseHandler = (req, res) => {
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: {
          orderId: 'order_test_123',
          amount: 100000,
          currency: 'INR',
          planCode: 'THREE_MONTHS',
          durationMonths: 3,
        },
      }));
    };

    const res1 = await createSubscriptionOrderApi('THREE_MONTHS');
    assertTest(
      'API-01',
      'createSubscriptionOrderApi sends POST /api/subscriptions/create-order with planCode',
      lastRequest.method === 'POST' &&
      lastRequest.url === '/api/subscriptions/create-order' &&
      lastRequest.body?.planCode === 'THREE_MONTHS' &&
      res1.success === true &&
      res1.status === 201 &&
      res1.data?.orderId === 'order_test_123',
      `Method: ${lastRequest.method}, URL: ${lastRequest.url}`
    );

    // 2. Test createSubscriptionOrderApi disabled checkout (HTTP 403)
    mockResponseHandler = (req, res) => {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Online subscription checkout is currently disabled. Please contact administration.',
      }));
    };

    const res2 = await createSubscriptionOrderApi('THREE_MONTHS');
    assertTest(
      'API-02',
      'createSubscriptionOrderApi handles HTTP 403 disabled checkout gracefully',
      res2.success === false &&
      res2.status === 403 &&
      res2.data === null &&
      res2.message.includes('currently disabled'),
      `Status: ${res2.status}, Message: "${res2.message}"`
    );

    // 3. Test verifySubscriptionPaymentApi success
    const mockPaymentPayload = {
      razorpay_order_id: 'order_test_123',
      razorpay_payment_id: 'pay_test_456',
      razorpay_signature: 'sig_mock_hex',
    };

    mockResponseHandler = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Payment verified and subscription activated successfully.',
        data: {
          subscriptionId: 'sub_test_789',
          status: 'active',
          planCode: 'THREE_MONTHS',
          startDate: '2026-10-16T00:00:00.000Z',
          endDate: '2027-01-16T00:00:00.000Z',
        },
      }));
    };

    const res3 = await verifySubscriptionPaymentApi(mockPaymentPayload);
    assertTest(
      'API-03',
      'verifySubscriptionPaymentApi sends POST /api/subscriptions/verify-payment with verification body',
      lastRequest.method === 'POST' &&
      lastRequest.url === '/api/subscriptions/verify-payment' &&
      lastRequest.body?.razorpay_order_id === 'order_test_123' &&
      lastRequest.body?.razorpay_payment_id === 'pay_test_456' &&
      res3.success === true &&
      res3.status === 200 &&
      res3.data?.status === 'active',
      `Method: ${lastRequest.method}, SubId: ${res3.data?.subscriptionId}`
    );

    // 4. Test verifySubscriptionPaymentApi invalid signature (HTTP 400)
    mockResponseHandler = (req, res) => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Payment verification failed: Invalid checkout signature.',
      }));
    };

    const res4 = await verifySubscriptionPaymentApi({ ...mockPaymentPayload, razorpay_signature: 'invalid' });
    assertTest(
      'API-04',
      'verifySubscriptionPaymentApi handles HTTP 400 invalid signature error gracefully',
      res4.success === false &&
      res4.status === 400 &&
      res4.data === null &&
      res4.message.includes('Invalid checkout signature'),
      `Status: ${res4.status}, Message: "${res4.message}"`
    );

    // 5. Test getMySubscriptionApi with active subscription
    mockResponseHandler = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: {
          hasSubscription: true,
          subscription: {
            id: 'sub_test_789',
            planCode: 'SIX_MONTHS',
            durationMonths: 6,
            status: 'active',
            startDate: '2026-10-16T00:00:00.000Z',
            endDate: '2027-04-16T00:00:00.000Z',
            gracePeriodEndDate: '2027-04-23T00:00:00.000Z',
          },
        },
      }));
    };

    const res5 = await getMySubscriptionApi();
    assertTest(
      'API-05',
      'getMySubscriptionApi sends GET /api/subscriptions/me and returns subscription details',
      lastRequest.method === 'GET' &&
      lastRequest.url === '/api/subscriptions/me' &&
      res5.success === true &&
      res5.status === 200 &&
      res5.data?.hasSubscription === true &&
      res5.data?.subscription?.planCode === 'SIX_MONTHS',
      `Method: ${lastRequest.method}, Plan: ${res5.data?.subscription?.planCode}`
    );

    // 6. Test getMySubscriptionApi for unsubscribed member (hasSubscription: false)
    mockResponseHandler = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: {
          hasSubscription: false,
          subscription: null,
        },
      }));
    };

    const res6 = await getMySubscriptionApi();
    assertTest(
      'API-06',
      'getMySubscriptionApi returns hasSubscription: false for unsubscribed user',
      res6.success === true &&
      res6.status === 200 &&
      res6.data?.hasSubscription === false &&
      res6.data?.subscription === null,
      `hasSubscription: ${res6.data?.hasSubscription}`
    );

    // 7. Test network error handling
    await new Promise(resolve => server.close(resolve));
    const res7 = await getMySubscriptionApi();
    assertTest(
      'API-07',
      'Network failure is safely caught returning success: false, status: 0, and user message',
      res7.success === false &&
      res7.status === 0 &&
      res7.data === null &&
      res7.message.includes('Unable to connect to the server'),
      `Status: ${res7.status}, Message: "${res7.message}"`
    );

    console.log('\n========================================================================');
    console.log(` Summary: ${passed} / ${total} Passed (${Math.round((passed / total) * 100)}%)`);
    console.log('========================================================================\n');

  } finally {
    server.close();
  }

  process.exit(passed === total ? 0 : 1);
}

runTests().catch(err => {
  console.error('[FATAL ERROR]', err);
  server.close();
  process.exit(1);
});
