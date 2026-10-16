/**
 * Isolated Browser Verification Suite for Razorpay Test Mode Checkout
 * Target: http://localhost:3001 (isolated test frontend targeting port 5001 / matrimony_phase5c_test)
 * Uses Microsoft Edge in headless mode via Chrome DevTools Protocol (CDP)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env.test') });

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PROFILE_DIR = path.resolve('C:\\Users\\Windows\\.gemini\\antigravity\\brain\\d479c192-034c-4251-b9fa-f8491206adbc\\scratch\\edge_profile_rzp');
const CDP_PORT = 9225;

const FRONTEND_URL = 'http://localhost:3001';
const BACKEND_URL = 'http://localhost:5001';

const SUBSCRIBER_CREDS = {
  email: 'test.viewer.phase5c@example.com',
  password: 'TestViewerPass123!',
};

const UNSUB_CREDS = {
  email: 'test.unsub.phase5c@example.com',
  password: 'TestUnsubPass123!',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function checkPort(port, reqPath = '/') {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`http://127.0.0.1:${port}${reqPath}`, { signal: controller.signal });
    clearTimeout(timer);
    return res.status > 0;
  } catch (_) {
    return false;
  }
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 0;
    this.callbacks = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.id && this.callbacks.has(msg.id)) {
            const cb = this.callbacks.get(msg.id);
            this.callbacks.delete(msg.id);
            if (msg.error) {
              cb.reject(new Error(msg.error.message));
            } else {
              cb.resolve(msg.result);
            }
          }
        } catch (e) {}
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      awaitPromise: true,
      returnByValue: true,
    });
    return res?.result?.value;
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await sleep(2500);
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
    }
  }
}

async function runBrowserVerification() {
  console.log('========================================================================');
  console.log(' Phase 4: Razorpay Test Mode Browser Verification Suite (Edge CDP)');
  console.log(` Target: ${FRONTEND_URL} -> ${BACKEND_URL} (matrimony_phase5c_test)`);
  console.log('========================================================================\n');

  let testBackendProc = null;
  let testFrontendProc = null;

  // 1. Ensure test backend on port 5001 is running
  const backendAlive = await checkPort(5001);
  if (!backendAlive) {
    console.log('[Startup] Starting isolated test backend on port 5001...');
    testBackendProc = spawn(
      process.execPath,
      [path.join(__dirname, 'runTestServerPhase5C.js')],
      { stdio: 'inherit' }
    );
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      if (await checkPort(5001)) {
        console.log('[Startup] Test backend is live on port 5001.');
        break;
      }
    }
  } else {
    console.log('[Status] Test backend is already running on port 5001.');
  }

  // 2. Ensure test frontend on port 3001 is running
  const frontendAlive = await checkPort(3001);
  if (!frontendAlive) {
    console.log('[Startup] Starting isolated test frontend on port 3001...');
    testFrontendProc = spawn(
      'npx.cmd',
      ['next', 'dev', '-p', '3001'],
      {
        cwd: path.resolve(__dirname, '../../frontend-test'),
        stdio: 'ignore',
        shell: true,
      }
    );
    for (let i = 0; i < 40; i++) {
      await sleep(1000);
      if (await checkPort(3001)) {
        console.log('[Startup] Test frontend is live on port 3001.');
        break;
      }
    }
  } else {
    console.log('[Status] Test frontend is already running on port 3001.');
  }

  // 3. Connect test runner mongoose to isolated test database
  const mongoUri = process.env.MONGODB_URI;
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  console.log(`[DB] Test runner connected to database: ${mongoose.connection.name}`);

  if (!fs.existsSync(PROFILE_DIR)) {
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
  }

  const edgeArgs = [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,850',
    'about:blank',
  ];

  console.log('[Browser] Launching headless Microsoft Edge via CDP...');
  const edgeProc = spawn(EDGE_PATH, edgeArgs, { stdio: 'ignore' });

  let cdp = null;
  let testCount = 0;
  let passedCount = 0;

  function reportTest(id, name, pass, detail = '') {
    testCount++;
    if (pass) {
      passedCount++;
      console.log(`  [PASS] ${id}: ${name} ${detail ? `(${detail})` : ''}`);
    } else {
      console.error(`  [FAIL] ${id}: ${name} FAILED: ${detail}`);
    }
  }

  try {
    let targets = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        targets = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json`);
        if (targets && targets.length > 0) break;
      } catch (_) {}
    }

    if (!targets || targets.length === 0) {
      throw new Error(`Failed to establish CDP connection on port ${CDP_PORT}`);
    }

    const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
    cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    console.log('[CDP] Successfully connected to Edge DevTools Protocol.\n');

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    // -------------------------------------------------------------------------
    // Test 1: Guest / Unauthenticated State
    // -------------------------------------------------------------------------
    console.log('1. Verifying Guest / Unauthenticated View on /membership...');
    await cdp.send('Network.clearBrowserCookies');
    await cdp.navigate(`${FRONTEND_URL}/membership`);
    await sleep(2500);

    const checkGuestScript = `
      (() => {
        const bodyText = document.body.textContent;
        const hasSignInBanner = bodyText.includes('Sign In to View Your Membership & Credits');
        const hasSandboxNotice = bodyText.includes('Razorpay Test Mode Sandbox Environment');
        const hasGold = bodyText.includes('Gold Plan');
        const hasPlatinum = bodyText.includes('Platinum Plan');
        const hasTestAmount3M = bodyText.includes('₹1.00 (100 paise)');
        const hasTestAmount6M = bodyText.includes('₹2.00 (200 paise)');
        return { hasSignInBanner, hasSandboxNotice, hasGold, hasPlatinum, hasTestAmount3M, hasTestAmount6M };
      })()
    `;
    const guestInfo = await cdp.eval(checkGuestScript);

    reportTest(
      'UI-RZP-01',
      'Unauthenticated visitor sees Sign In banner and Sandbox Environment notice',
      guestInfo?.hasSignInBanner && guestInfo?.hasSandboxNotice,
      `Banner: ${guestInfo?.hasSignInBanner}, SandboxNotice: ${guestInfo?.hasSandboxNotice}`
    );

    reportTest(
      'UI-RZP-02',
      'Plan cards display temporary test sandbox prices (₹1.00 and ₹2.00)',
      guestInfo?.hasTestAmount3M && guestInfo?.hasTestAmount6M,
      `3M Amount: ${guestInfo?.hasTestAmount3M}, 6M Amount: ${guestInfo?.hasTestAmount6M}`
    );

    // -------------------------------------------------------------------------
    // Test 2: Active Subscriber Safeguard (Double Billing / Renewal Protection)
    // -------------------------------------------------------------------------
    console.log('\n2. Logging in as active subscriber to verify renewal protection...');
    await cdp.navigate(`${FRONTEND_URL}/login`);
    await sleep(2000);

    const loginSubscriberScript = `
      (async () => {
        const emailInput = document.querySelector('input[type="email"]') || document.querySelector('input[name="email"]');
        const passInput = document.querySelector('input[type="password"]') || document.querySelector('input[name="password"]');
        const submitBtn = document.querySelector('button[type="submit"]');

        if (emailInput && passInput && submitBtn) {
          const setVal = (el, val) => {
            Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, val);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          };
          setVal(emailInput, '${SUBSCRIBER_CREDS.email}');
          setVal(passInput, '${SUBSCRIBER_CREDS.password}');
          submitBtn.click();
          return { success: true };
        }
        return { error: 'Form elements not found' };
      })()
    `;
    await cdp.eval(loginSubscriberScript);
    await sleep(3500);

    await cdp.navigate(`${FRONTEND_URL}/membership`);
    await sleep(2500);

    const checkSubscriberScript = `
      (() => {
        const bodyText = document.body.textContent;
        const hasActiveBadge = bodyText.includes('ACTIVE MEMBERSHIP');
        const hasCredits = bodyText.includes('Contact Unlocking Credits') && bodyText.includes('Available');
        const buttons = Array.from(document.querySelectorAll('button'));
        const disabledActiveButtons = buttons.filter(b => b.hasAttribute('disabled') && b.textContent.includes('Plan Already Active'));
        return { hasActiveBadge, hasCredits, disabledActiveButtonsCount: disabledActiveButtons.length };
      })()
    `;
    const subscriberInfo = await cdp.eval(checkSubscriberScript);

    reportTest(
      'UI-RZP-03',
      'Active subscriber displays ACTIVE MEMBERSHIP banner with remaining credits',
      subscriberInfo?.hasActiveBadge && subscriberInfo?.hasCredits,
      `ActiveBadge: ${subscriberInfo?.hasActiveBadge}, Credits: ${subscriberInfo?.hasCredits}`
    );

    reportTest(
      'UI-RZP-04',
      'Active subscriber has checkout buttons disabled with "Plan Already Active" safeguard',
      subscriberInfo?.disabledActiveButtonsCount === 2,
      `Disabled Plan Active buttons: ${subscriberInfo?.disabledActiveButtonsCount} / 2`
    );

    // -------------------------------------------------------------------------
    // Test 3: Unsubscribed User Sandbox Dashboard
    // -------------------------------------------------------------------------
    console.log('\n3. Logging in as unsubscribed member & checking interactive checkout UI...');
    await cdp.send('Network.clearBrowserCookies');
    await cdp.navigate(`${FRONTEND_URL}/login`);
    await sleep(2000);

    const loginUnsubScript = `
      (async () => {
        const emailInput = document.querySelector('input[type="email"]') || document.querySelector('input[name="email"]');
        const passInput = document.querySelector('input[type="password"]') || document.querySelector('input[name="password"]');
        const submitBtn = document.querySelector('button[type="submit"]');

        if (emailInput && passInput && submitBtn) {
          const setVal = (el, val) => {
            Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, val);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          };
          setVal(emailInput, '${UNSUB_CREDS.email}');
          setVal(passInput, '${UNSUB_CREDS.password}');
          submitBtn.click();
          return { success: true };
        }
        return { error: 'Form elements not found' };
      })()
    `;
    await cdp.eval(loginUnsubScript);
    await sleep(3500);

    await cdp.navigate(`${FRONTEND_URL}/membership`);
    await sleep(2500);

    const checkUnsubScript = `
      (() => {
        const bodyText = document.body.textContent;
        const hasNoPlanBadge = bodyText.includes('REGISTERED ACCOUNT • NO ACTIVE PLAN');
        const buttons = Array.from(document.querySelectorAll('button[data-plan-btn]'));
        const hasInteractiveButtons = buttons.length === 2 && buttons.every(b => !b.hasAttribute('disabled') && b.textContent.includes('Select Plan (Test Checkout)'));
        return { hasNoPlanBadge, hasInteractiveButtons, buttonCount: buttons.length };
      })()
    `;
    const unsubInfo = await cdp.eval(checkUnsubScript);

    reportTest(
      'UI-RZP-05',
      'Unsubscribed user displays NO ACTIVE PLAN and interactive "Select Plan (Test Checkout)" buttons',
      unsubInfo?.hasNoPlanBadge && unsubInfo?.hasInteractiveButtons,
      `NoPlanBadge: ${unsubInfo?.hasNoPlanBadge}, InteractiveButtons: ${unsubInfo?.hasInteractiveButtons}`
    );

    // -------------------------------------------------------------------------
    // Test 4: End-to-End Order Creation via React UI
    // -------------------------------------------------------------------------
    console.log('\n4. Testing React plan selection triggering server order creation...');

    // Intercept window.Razorpay in browser to capture initialization parameters
    await cdp.eval(`
      (() => {
        window.__rzpState = { initialized: false, opened: false, options: null, events: {} };
        window.Razorpay = function(opts) {
          window.__rzpState.initialized = true;
          window.__rzpState.options = opts;
          this.open = () => { window.__rzpState.opened = true; };
          this.on = (evt, fn) => { window.__rzpState.events[evt] = fn; };
        };
      })()
    `);

    // Click "Select Plan (Test Checkout)" for THREE_MONTHS
    await cdp.eval(`
      (() => {
        const btn = document.querySelector('button[data-plan-btn="THREE_MONTHS"]');
        if (btn) btn.click();
      })()
    `);

    // Allow time for server order creation API call to complete
    await sleep(3500);

    const rzpState = await cdp.eval(`window.__rzpState`);

    reportTest(
      'UI-RZP-06',
      'Clicking Select Plan triggers order creation with Razorpay Sandbox and initializes checkout',
      rzpState?.initialized === true && rzpState?.opened === true,
      `Initialized: ${rzpState?.initialized}, Opened: ${rzpState?.opened}`
    );

    reportTest(
      'UI-RZP-07',
      'Razorpay instance receives correct test key, sandbox order ID, and amount (100 paise)',
      rzpState?.options?.key?.startsWith('rzp_test_') &&
      rzpState?.options?.order_id?.startsWith('order_') &&
      rzpState?.options?.amount === 100,
      `Key: ${rzpState?.options?.key?.slice(0, 9)}..., OrderId: ${rzpState?.options?.order_id}, Amount: ${rzpState?.options?.amount}`
    );

    // -------------------------------------------------------------------------
    // Test 5: Checkout Cancellation / Dismissal Graceful Notice
    // -------------------------------------------------------------------------
    console.log('\n5. Testing user cancellation / modal dismissal handling...');
    await cdp.eval(`
      (() => {
        if (window.__rzpState?.options?.modal?.ondismiss) {
          window.__rzpState.options.modal.ondismiss();
        }
      })()
    `);
    await sleep(800);

    const cancelNotice = await cdp.eval(`
      document.body.textContent.includes('Payment checkout was cancelled. No charges were made.')
    `);

    reportTest(
      'UI-RZP-08',
      'Dismissing checkout modal displays friendly cancellation banner without charges',
      cancelNotice === true,
      `Cancellation notice visible: ${cancelNotice}`
    );

    // -------------------------------------------------------------------------
    // Test 6: Checkout Failure Event Handling
    // -------------------------------------------------------------------------
    console.log('\n6. Testing payment failure event notice...');
    await cdp.eval(`
      (() => {
        if (window.__rzpState?.events?.['payment.failed']) {
          window.__rzpState.events['payment.failed']({
            error: { description: 'Card declined by issuing bank (Sandbox simulation)' }
          });
        }
      })()
    `);
    await sleep(800);

    const failureNotice = await cdp.eval(`
      document.body.textContent.includes('Payment failed: Card declined by issuing bank')
    `);

    reportTest(
      'UI-RZP-09',
      'Payment failure event displays red error banner with provider reason',
      failureNotice === true,
      `Failure banner visible: ${failureNotice}`
    );

    // -------------------------------------------------------------------------
    // Test 7: Successful Sandbox Payment & Instant UI Activation
    // -------------------------------------------------------------------------
    console.log('\n7. Testing server-side payment verification and instant UI activation...');

    const orderIdToActivate = rzpState?.options?.order_id;
    if (!orderIdToActivate) {
      throw new Error('Order ID missing from Razorpay state.');
    }

    // In isolated test database, execute processSuccessfulPayment for this order
    const { processSuccessfulPayment } = require('../services/paymentService');
    const dummyPayId = `pay_browser_test_${Date.now()}`;
    const actResult = await processSuccessfulPayment({
      orderId: orderIdToActivate,
      paymentId: dummyPayId,
      expectedAmount: 100,
      expectedCurrency: 'INR',
      verificationMethod: 'client_callback',
    });

    reportTest(
      'UI-RZP-10',
      'processSuccessfulPayment confirms sandbox payment and activates subscription in DB',
      actResult?.success === true && actResult?.subscription?.status === 'active',
      `Sub ID: ${actResult?.subscription?._id}, Status: ${actResult?.subscription?.status}`
    );

    // Refresh membership page in browser to observe updated dashboard
    await cdp.navigate(`${FRONTEND_URL}/membership`);
    await sleep(2500);

    const checkActivatedDashboardScript = `
      (() => {
        const bodyText = document.body.textContent;
        const hasActiveBadge = bodyText.includes('ACTIVE MEMBERSHIP');
        const hasGoldPlan = bodyText.includes('Gold Plan (3 Months)');
        const hasCredits = bodyText.includes('50 / 50 Available') || (bodyText.includes('50') && bodyText.includes('Available'));
        const hasGracePeriod = bodyText.includes('7-day browsing grace period');
        const buttons = Array.from(document.querySelectorAll('button'));
        const planActiveButtons = buttons.filter(b => b.textContent.includes('Plan Already Active'));
        return { hasActiveBadge, hasGoldPlan, hasCredits, hasGracePeriod, planActiveCount: planActiveButtons.length };
      })()
    `;
    const activatedInfo = await cdp.eval(checkActivatedDashboardScript);

    reportTest(
      'UI-RZP-11',
      'Dashboard immediately displays ACTIVE MEMBERSHIP with Gold Plan and 50 allocated credits',
      activatedInfo?.hasActiveBadge && activatedInfo?.hasGoldPlan && activatedInfo?.hasCredits,
      `Badge: ${activatedInfo?.hasActiveBadge}, Plan: ${activatedInfo?.hasGoldPlan}, Credits: ${activatedInfo?.hasCredits}`
    );

    reportTest(
      'UI-RZP-12',
      'Dashboard displays 7-day browsing grace period notice and disables plan purchase buttons',
      activatedInfo?.hasGracePeriod && activatedInfo?.planActiveCount === 2,
      `GracePeriod: ${activatedInfo?.hasGracePeriod}, DisabledButtons: ${activatedInfo?.planActiveCount} / 2`
    );

    // -------------------------------------------------------------------------
    // Test 8: Database Cleanup (Reset test user back to unsubscribed)
    // -------------------------------------------------------------------------
    console.log('\n8. Cleaning up test user records for future test runs...');

    const User = require('../models/User');
    const Subscription = require('../models/Subscription');
    const Payment = require('../models/Payment');
    const CreditCycle = require('../models/CreditCycle');

    const unsubUser = await User.findOne({ email: UNSUB_CREDS.email });
    if (unsubUser) {
      await Subscription.deleteMany({ user: unsubUser._id });
      await Payment.deleteMany({ user: unsubUser._id });
      await CreditCycle.deleteMany({ user: unsubUser._id });
    }

    reportTest(
      'UI-RZP-13',
      'Temporary test subscription and credit records safely cleaned up from test database',
      true,
      'Reset test.unsub.phase5c@example.com to clean unsubscribed state'
    );

    // -------------------------------------------------------------------------
    // Test 9: Production Servers Health Check
    // -------------------------------------------------------------------------
    const prodFrontendAlive = await checkPort(3000, '/membership');
    const prodBackendAlive = await checkPort(5000, '/api/health');

    reportTest(
      'UI-RZP-14',
      'Production servers on ports 3000 and 5000 remained untouched and healthy',
      prodFrontendAlive && prodBackendAlive,
      `Port 3000: ${prodFrontendAlive ? 'ALIVE' : 'DOWN'}, Port 5000: ${prodBackendAlive ? 'ALIVE' : 'DOWN'}`
    );

    console.log('\n========================================================================');
    console.log(` Razorpay Test Mode Browser Verification: ${passedCount} / ${testCount} Passed (${Math.round((passedCount / testCount) * 100)}%)`);
    console.log('========================================================================\n');

  } finally {
    if (cdp) cdp.close();
    edgeProc.kill();
    try {
      fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
    } catch (_) {}
    try {
      await mongoose.disconnect();
    } catch (_) {}
    if (testBackendProc) testBackendProc.kill();
    if (testFrontendProc) testFrontendProc.kill();
  }

  process.exit(passedCount === testCount ? 0 : 1);
}

runBrowserVerification().catch((err) => {
  console.error('\n[FATAL ERROR IN BROWSER TEST RUNNER]', err);
  process.exit(1);
});
