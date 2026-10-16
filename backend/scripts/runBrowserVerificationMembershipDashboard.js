/**
 * Isolated Browser Verification Suite for Dedicated Membership Dashboard
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
const PROFILE_DIR = path.resolve('C:\\Users\\Windows\\.gemini\\antigravity\\brain\\d479c192-034c-4251-b9fa-f8491206adbc\\scratch\\edge_profile_mem');
const CDP_PORT = 9224;

const FRONTEND_URL = 'http://localhost:3001';
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

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    await sleep(600);
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
    }
  }
}

async function runBrowserVerification() {
  console.log('========================================================================');
  console.log(' Dedicated Membership Dashboard Browser Verification Suite (Edge CDP)');
  console.log(` Frontend Target: ${FRONTEND_URL} (Isolated Port 3001)`);
  console.log('========================================================================\n');

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
    '--window-size=1280,800',
    'about:blank',
  ];

  console.log('[Launching Browser] Starting headless Microsoft Edge...');
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
    console.log(`[CDP Connected] Attaching to page target: ${pageTarget.title || 'Page'}`);

    cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    console.log('[CDP Connected] Successfully attached to Edge browser DevTools protocol.\n');

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    // Clear any leftover cookies for clean unauthenticated test
    await cdp.send('Network.clearBrowserCookies');

    // -------------------------------------------------------------------------
    // 1. Guest / Unauthenticated View
    // -------------------------------------------------------------------------
    console.log('1. Verifying Guest / Unauthenticated View on /membership...');
    await cdp.navigate(`${FRONTEND_URL}/membership`);
    await sleep(3000);

    const checkGuestView = `
      (() => {
        const bodyText = document.body.textContent;
        const h1 = document.querySelector('h1')?.textContent?.trim();
        const hasSignInBanner = bodyText.includes('Sign In to View Your Membership & Credits') || bodyText.includes('Sign In');
        const hasSignInLink = Array.from(document.querySelectorAll('a')).some(
          a => a.textContent.includes('Sign In') && a.getAttribute('href')?.includes('/login')
        );
        const hasGoldPlan = bodyText.includes('Gold Plan');
        const hasPlatinumPlan = bodyText.includes('Platinum Plan');
        const hasPriceAnnounced = bodyText.includes('Price announced soon');
        const hasDisabledNotice = bodyText.includes('Online Subscription Checkout Notice') || bodyText.includes('Online payment gateway checkout is currently unavailable');
        const hasTrustSection = bodyText.includes('Zero Repeat Deductions') && bodyText.includes('50 Monthly Credits');

        return {
          h1,
          hasSignInBanner,
          hasSignInLink,
          hasGoldPlan,
          hasPlatinumPlan,
          hasPriceAnnounced,
          hasDisabledNotice,
          hasTrustSection,
        };
      })()
    `;
    const guestInfo = await cdp.eval(checkGuestView);
    const isGuestValid =
      guestInfo?.h1?.includes('Membership & Credits Dashboard') &&
      guestInfo?.hasSignInBanner &&
      guestInfo?.hasSignInLink &&
      guestInfo?.hasGoldPlan &&
      guestInfo?.hasPlatinumPlan &&
      guestInfo?.hasPriceAnnounced &&
      guestInfo?.hasDisabledNotice &&
      guestInfo?.hasTrustSection;

    reportTest(
      'UI-MEM-01',
      'Guest view renders title, sign-in CTA, plan options, disabled notice, and trust highlights',
      isGuestValid,
      `H1: "${guestInfo?.h1}", SignInLink: ${guestInfo?.hasSignInLink}, Plans: Gold/Plat present, Notice: ${guestInfo?.hasDisabledNotice}`
    );

    // -------------------------------------------------------------------------
    // 2. Responsive Viewports
    // -------------------------------------------------------------------------
    console.log('\n2. Verifying Responsive Viewports...');
    await cdp.setViewport(1280, 800);
    const desktopOk = await cdp.eval(`(() => document.body.scrollWidth <= window.innerWidth + 5)()`);
    reportTest('UI-MEM-02', 'Desktop Viewport (1280x800) layout integrity (no horizontal scrollbar)', desktopOk);

    await cdp.setViewport(375, 667);
    const mobileOk = await cdp.eval(`(() => document.body.scrollWidth <= window.innerWidth + 5)()`);
    reportTest('UI-MEM-03', 'Mobile Viewport (375x667) layout integrity (responsive wrapping, no overflow)', mobileOk);

    // Reset back to standard desktop viewport
    await cdp.setViewport(1280, 800);

    // -------------------------------------------------------------------------
    // 3. Authenticated Active Subscriber View
    // -------------------------------------------------------------------------
    console.log('\n3. Authenticating as active subscriber & testing /membership...');
    await cdp.navigate(`${FRONTEND_URL}/login`);
    await sleep(2000);

    const loginScript = `
      (async () => {
        const emailInput = document.querySelector('input[name="email"]') || document.querySelector('#email') || document.querySelector('input[type="email"]');
        const passInput = document.querySelector('input[name="password"]') || document.querySelector('#password') || document.querySelector('input[type="password"]');
        const submitBtn = document.querySelector('button[type="submit"]');

        if (emailInput && passInput && submitBtn) {
          const setValue = (input, val) => {
            Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, val);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          };

          setValue(emailInput, '${SUBSCRIBER_CREDS.email}');
          setValue(passInput, '${SUBSCRIBER_CREDS.password}');

          submitBtn.click();
          return { success: true };
        }
        return { error: 'Login elements missing' };
      })()
    `;
    await cdp.eval(loginScript);
    await sleep(3500);

    await cdp.navigate(`${FRONTEND_URL}/membership`);
    await sleep(3000);

    const checkSubscriberView = `
      (() => {
        const bodyText = document.body.textContent;
        const hasActiveBadge = bodyText.includes('ACTIVE MEMBERSHIP');
        const hasPlanName = bodyText.includes('Gold Plan (3 Months)') || bodyText.includes('Platinum Plan (6 Months)');
        const hasValidity = bodyText.includes('Validity & Dates') && bodyText.includes('Activated:') && bodyText.includes('Expires On:');
        const hasGracePeriod = bodyText.includes('7-day browsing grace period through');
        const hasCredits = bodyText.includes('Contact Unlocking Credits') && (bodyText.includes('50 / 50 Available') || bodyText.includes('Available'));
        const hasDirectoryLink = Array.from(document.querySelectorAll('a')).some(
          a => a.textContent.includes('Browse Member Directory') && a.getAttribute('href') === '/members'
        );

        return {
          hasActiveBadge,
          hasPlanName,
          hasValidity,
          hasGracePeriod,
          hasCredits,
          hasDirectoryLink,
        };
      })()
    `;
    const subInfo = await cdp.eval(checkSubscriberView);

    reportTest(
      'UI-MEM-04',
      'Active subscriber displays "ACTIVE MEMBERSHIP" status badge and plan tier',
      subInfo?.hasActiveBadge && subInfo?.hasPlanName,
      `Badge: ${subInfo?.hasActiveBadge}, Plan: ${subInfo?.hasPlanName}`
    );

    reportTest(
      'UI-MEM-05',
      'Active subscriber displays validity period dates and 7-day grace period notice',
      subInfo?.hasValidity && subInfo?.hasGracePeriod,
      `Validity: ${subInfo?.hasValidity}, GracePeriod: ${subInfo?.hasGracePeriod}`
    );

    reportTest(
      'UI-MEM-06',
      'Active subscriber displays monthly contact credit balance & directory navigation CTA',
      subInfo?.hasCredits && subInfo?.hasDirectoryLink,
      `Credits visible: ${subInfo?.hasCredits}, Directory CTA: ${subInfo?.hasDirectoryLink}`
    );

    // -------------------------------------------------------------------------
    // 4. Authenticated Unsubscribed Member View
    // -------------------------------------------------------------------------
    console.log('\n4. Authenticating as unsubscribed member & testing /membership...');
    await cdp.send('Network.clearBrowserCookies');
    await cdp.navigate(`${FRONTEND_URL}/login`);
    await sleep(2000);

    const unsubLoginScript = `
      (async () => {
        const emailInput = document.querySelector('input[name="email"]') || document.querySelector('#email') || document.querySelector('input[type="email"]');
        const passInput = document.querySelector('input[name="password"]') || document.querySelector('#password') || document.querySelector('input[type="password"]');
        const submitBtn = document.querySelector('button[type="submit"]');

        if (emailInput && passInput && submitBtn) {
          const setValue = (input, val) => {
            Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, val);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          };

          setValue(emailInput, '${UNSUB_CREDS.email}');
          setValue(passInput, '${UNSUB_CREDS.password}');

          submitBtn.click();
          return { success: true };
        }
        return { error: 'Login elements missing' };
      })()
    `;
    await cdp.eval(unsubLoginScript);
    await sleep(3500);

    await cdp.navigate(`${FRONTEND_URL}/membership`);
    await sleep(3000);

    const checkUnsubView = `
      (() => {
        const bodyText = document.body.textContent;
        const hasNoPlanBadge = bodyText.includes('NO ACTIVE PLAN') || bodyText.includes('REGISTERED ACCOUNT');
        const hasWelcome = bodyText.includes('Welcome');
        const buttons = Array.from(document.querySelectorAll('button'));
        const disabledButtons = buttons.filter(b => b.hasAttribute('disabled') && b.textContent.includes('Checkout Unavailable'));

        return {
          hasNoPlanBadge,
          hasWelcome,
          disabledButtonCount: disabledButtons.length,
        };
      })()
    `;
    const unsubInfo = await cdp.eval(checkUnsubView);

    reportTest(
      'UI-MEM-07',
      'Unsubscribed user sees "REGISTERED ACCOUNT • NO ACTIVE PLAN" state and plan options',
      unsubInfo?.hasNoPlanBadge && unsubInfo?.hasWelcome,
      `Badge: ${unsubInfo?.hasNoPlanBadge}, Welcome: ${unsubInfo?.hasWelcome}`
    );

    reportTest(
      'UI-MEM-08',
      'Plan cards display disabled "Checkout Unavailable" buttons without triggering payment gateway',
      unsubInfo?.disabledButtonCount === 2,
      `Disabled buttons: ${unsubInfo?.disabledButtonCount} / 2`
    );

    console.log('\n========================================================================');
    console.log(` Membership Browser Verification Summary: ${passedCount} / ${testCount} Passed (${Math.round((passedCount / testCount) * 100)}%)`);
    console.log('========================================================================\n');

  } finally {
    if (cdp) cdp.close();
    edgeProc.kill();
    try {
      fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
    } catch (_) {}
  }

  process.exit(passedCount === testCount ? 0 : 1);
}

runBrowserVerification().catch((err) => {
  console.error('\n[FATAL ERROR IN BROWSER TEST RUNNER]', err);
  process.exit(1);
});
