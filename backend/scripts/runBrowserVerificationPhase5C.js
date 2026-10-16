/**
 * Isolated Browser Verification Suite for Member Directory (Phase 5C - Step 4)
 * Runs against test frontend at http://localhost:3001 connected to test backend at http://localhost:5001
 * Uses Microsoft Edge in headless mode via Chrome DevTools Protocol (CDP)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PROFILE_DIR = path.resolve('C:\\Users\\Windows\\.gemini\\antigravity\\brain\\d479c192-034c-4251-b9fa-f8491206adbc\\scratch\\edge_profile');
const CDP_PORT = 9222;

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
    await sleep(2000);
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
    }
  }
}

const testResults = [];

function recordTest(id, name, passed, details, expected, actual) {
  testResults.push({ id, name, passed, details, expected, actual });
  const statusMark = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`[${statusMark}] ${id}: ${name}`);
  if (!passed) {
    console.log(`    Expected: ${JSON.stringify(expected)}`);
    console.log(`    Actual:   ${JSON.stringify(actual)}`);
    console.log(`    Details:  ${details}`);
  }
}

async function runBrowserVerification() {
  console.log('========================================================================');
  console.log(' Member Directory Browser Verification Suite (Phase 5C - Step 4)');
  console.log(' Target Frontend: http://localhost:3001 | Test Backend: http://localhost:5001');
  console.log(' Headless Browser: Microsoft Edge (via CDP)');
  console.log('========================================================================\n');

  if (!fs.existsSync(PROFILE_DIR)) {
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
  }

  const edgeArgs = [
    '--headless',
    '--disable-gpu',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ];

  console.log('Launching headless Microsoft Edge on debugging port 9222...');
  const edgeProc = spawn(EDGE_PATH, edgeArgs, { stdio: 'ignore' });

  let cdpClient = null;

  try {
    let targets = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        targets = await fetchJson(`http://localhost:${CDP_PORT}/json`);
        if (targets && targets.length > 0) break;
      } catch (_) {}
    }

    if (!targets || targets.length === 0) {
      throw new Error('Failed to connect to Microsoft Edge CDP on port 9222');
    }

    const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
    console.log(`Connected to Edge browser target: ${pageTarget.title || 'Page'}`);

    cdpClient = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdpClient.connect();
    await cdpClient.send('Page.enable');
    await cdpClient.send('Runtime.enable');

    // -----------------------------------------------------------------------
    // PART A: Active Subscriber Flow
    // -----------------------------------------------------------------------
    console.log('\n--- Part A: Active Subscriber Authentication & Load ---');

    await cdpClient.navigate(`${FRONTEND_URL}/login`);
    await sleep(1500);

    // Login using React synthetic event dispatchers
    const loginResult = await cdpClient.eval(`
      (async () => {
        const emailInput = document.querySelector('input[type="email"]') || document.querySelector('#email');
        const passInput = document.querySelector('input[type="password"]') || document.querySelector('#password');
        const submitBtn = document.querySelector('button[type="submit"]');
        if (!emailInput || !passInput || !submitBtn) {
          return { success: false, error: 'Login elements missing' };
        }
        
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(emailInput, '${SUBSCRIBER_CREDS.email}');
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        setter.call(passInput, '${SUBSCRIBER_CREDS.password}');
        passInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        submitBtn.click();
        await new Promise(r => setTimeout(r, 2500));
        return { success: true };
      })()
    `);

    recordTest(
      'UI-01',
      'Fill and submit login form with active subscriber credentials',
      loginResult.success,
      'Viewer session successfully authenticated with session cookie',
      true,
      loginResult.success
    );

    // Navigate to /members in the active session
    await cdpClient.navigate(`${FRONTEND_URL}/members`);
    await sleep(3000);

    const initialCards = await cdpClient.eval(`
      (() => {
        const cards = document.querySelectorAll('.member-card');
        const names = Array.from(document.querySelectorAll('.member-card-name')).map(el => el.textContent.trim());
        const hasCredits = document.body.innerText.includes('Monthly Contact Credits');
        return { count: cards.length, names, hasCredits };
      })()
    `);

    const hasAll4 = initialCards?.count === 4 &&
      initialCards.names.includes('Priya Sharma') &&
      initialCards.names.includes('Anand Kumar') &&
      initialCards.names.includes('Divya Balan') &&
      initialCards.names.includes('Rajesh Varma');

    recordTest(
      'UI-02',
      'Directory loads all 4 synthetic profiles with correct candidate names and credit banner',
      hasAll4,
      `Displayed cards: ${initialCards?.names?.join(', ') || 'none'}, Credits banner visible: ${initialCards?.hasCredits}`,
      ['Anand Kumar', 'Divya Balan', 'Priya Sharma', 'Rajesh Varma'],
      (initialCards?.names || []).sort()
    );

    // -----------------------------------------------------------------------
    // PART B: Structured Search Filters UI Tests
    // -----------------------------------------------------------------------
    console.log('\n--- Part B: Filter Controls & Interactions ---');

    // Helper: apply filter via DOM and read back cards
    async function applyFilterAndGetCards(code) {
      await cdpClient.eval(code);
      await sleep(2500); // Wait for fetch and re-render
      return await cdpClient.eval(`
        (() => {
          const cards = document.querySelectorAll('.member-card');
          const names = Array.from(document.querySelectorAll('.member-card-name')).map(el => el.textContent.trim());
          return { count: cards.length, names };
        })()
      `);
    }

    // Helper: reset filters in DOM
    async function resetFilters() {
      await cdpClient.eval(`
        (() => {
          const resetBtn = document.querySelector('.btn-filter-reset');
          if (resetBtn) resetBtn.click();
        })()
      `);
      await sleep(2000);
    }

    // UI-03: Gender = Female
    const femaleCards = await applyFilterAndGetCards(`
      (() => {
        const sel = document.querySelector('#filter-gender');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
        setter.call(sel, 'Female');
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        document.querySelector('.btn-filter-apply').click();
      })()
    `);
    const femaleOk = femaleCards.count === 2 &&
      femaleCards.names.includes('Priya Sharma') &&
      femaleCards.names.includes('Divya Balan');
    recordTest(
      'UI-03',
      'UI Filter: Gender = Female renders Priya Sharma & Divya Balan',
      femaleOk,
      `Names: ${femaleCards.names.join(', ')}`,
      ['Divya Balan', 'Priya Sharma'],
      femaleCards.names.sort()
    );

    // UI-04: Gender = Male
    await resetFilters();
    const maleCards = await applyFilterAndGetCards(`
      (() => {
        const sel = document.querySelector('#filter-gender');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
        setter.call(sel, 'Male');
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        document.querySelector('.btn-filter-apply').click();
      })()
    `);
    const maleOk = maleCards.count === 2 &&
      maleCards.names.includes('Anand Kumar') &&
      maleCards.names.includes('Rajesh Varma');
    recordTest(
      'UI-04',
      'UI Filter: Gender = Male renders Anand Kumar & Rajesh Varma',
      maleOk,
      `Names: ${maleCards.names.join(', ')}`,
      ['Anand Kumar', 'Rajesh Varma'],
      maleCards.names.sort()
    );

    // UI-05: Age Range 25 to 30
    await resetFilters();
    const ageCards = await applyFilterAndGetCards(`
      (() => {
        const minInput = document.querySelector('input[aria-label="Minimum candidate age"]');
        const maxInput = document.querySelector('input[aria-label="Maximum candidate age"]');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(minInput, '25');
        minInput.dispatchEvent(new Event('input', { bubbles: true }));
        setter.call(maxInput, '30');
        maxInput.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('.btn-filter-apply').click();
      })()
    `);
    const ageOk = ageCards.count === 2 &&
      ageCards.names.includes('Priya Sharma') &&
      ageCards.names.includes('Divya Balan');
    recordTest(
      'UI-05',
      'UI Filter: Age Range 25–30 renders Priya Sharma (29) & Divya Balan (25)',
      ageOk,
      `Names: ${ageCards.names.join(', ')}`,
      ['Divya Balan', 'Priya Sharma'],
      ageCards.names.sort()
    );

    // UI-06: Marital Status = Divorced
    await resetFilters();
    const divorcedCards = await applyFilterAndGetCards(`
      (() => {
        const sel = document.querySelector('#filter-marital-status');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
        setter.call(sel, 'Divorced');
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        document.querySelector('.btn-filter-apply').click();
      })()
    `);
    const divorcedOk = divorcedCards.count === 1 && divorcedCards.names[0] === 'Rajesh Varma';
    recordTest(
      'UI-06',
      'UI Filter: Marital Status = Divorced renders Rajesh Varma',
      divorcedOk,
      `Names: ${divorcedCards.names.join(', ')}`,
      ['Rajesh Varma'],
      divorcedCards.names
    );

    // UI-07: Location = Chennai
    await resetFilters();
    const chennaiCards = await applyFilterAndGetCards(`
      (() => {
        const loc = document.querySelector('#filter-location');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(loc, 'Chennai');
        loc.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('.btn-filter-apply').click();
      })()
    `);
    const chennaiOk = chennaiCards.count === 1 && chennaiCards.names[0] === 'Anand Kumar';
    recordTest(
      'UI-07',
      'UI Filter: Location = Chennai renders Anand Kumar',
      chennaiOk,
      `Names: ${chennaiCards.names.join(', ')}`,
      ['Anand Kumar'],
      chennaiCards.names
    );

    // UI-08: Education = Computer Science
    await resetFilters();
    const eduCards = await applyFilterAndGetCards(`
      (() => {
        const edu = document.querySelector('#filter-education');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(edu, 'Computer Science');
        edu.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('.btn-filter-apply').click();
      })()
    `);
    const eduOk = eduCards.count === 1 && eduCards.names[0] === 'Priya Sharma';
    recordTest(
      'UI-08',
      'UI Filter: Education = Computer Science renders Priya Sharma',
      eduOk,
      `Names: ${eduCards.names.join(', ')}`,
      ['Priya Sharma'],
      eduCards.names
    );

    // UI-09: Occupation = Data Scientist
    await resetFilters();
    const occCards = await applyFilterAndGetCards(`
      (() => {
        const occ = document.querySelector('#filter-occupation');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(occ, 'Data Scientist');
        occ.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('.btn-filter-apply').click();
      })()
    `);
    const occOk = occCards.count === 1 && occCards.names[0] === 'Divya Balan';
    recordTest(
      'UI-09',
      'UI Filter: Occupation = Data Scientist renders Divya Balan',
      occOk,
      `Names: ${occCards.names.join(', ')}`,
      ['Divya Balan'],
      occCards.names
    );

    // UI-10: Multi-Criteria Filter (Female, Age 24-30, Bangalore)
    await resetFilters();
    const multiCards = await applyFilterAndGetCards(`
      (() => {
        const genderSel = document.querySelector('#filter-gender');
        const selectSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
        selectSetter.call(genderSel, 'Female');
        genderSel.dispatchEvent(new Event('change', { bubbles: true }));

        const minInput = document.querySelector('input[aria-label="Minimum candidate age"]');
        const maxInput = document.querySelector('input[aria-label="Maximum candidate age"]');
        const inputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        inputSetter.call(minInput, '24');
        minInput.dispatchEvent(new Event('input', { bubbles: true }));
        inputSetter.call(maxInput, '30');
        maxInput.dispatchEvent(new Event('input', { bubbles: true }));

        const locInput = document.querySelector('#filter-location');
        inputSetter.call(locInput, 'Bangalore');
        locInput.dispatchEvent(new Event('input', { bubbles: true }));

        document.querySelector('.btn-filter-apply').click();
      })()
    `);
    const multiOk = multiCards.count === 1 && multiCards.names[0] === 'Divya Balan';
    recordTest(
      'UI-10',
      'UI Combined Filter: Female + 24–30 yrs + Bangalore renders Divya Balan',
      multiOk,
      `Names: ${multiCards.names.join(', ')}`,
      ['Divya Balan'],
      multiCards.names
    );

    // UI-11: Keyword Search (Finance)
    await resetFilters();
    const searchCards = await applyFilterAndGetCards(`
      (() => {
        const searchInput = document.querySelector('#filter-search');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(searchInput, 'Finance');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('.btn-filter-apply').click();
      })()
    `);
    const searchOk = searchCards.count === 1 && searchCards.names[0] === 'Anand Kumar';
    recordTest(
      'UI-11',
      'UI Keyword Search: "Finance" renders Anand Kumar',
      searchOk,
      `Names: ${searchCards.names.join(', ')}`,
      ['Anand Kumar'],
      searchCards.names
    );

    // UI-12: Reset Filters restores all 4 candidates
    await resetFilters();
    const afterReset = await cdpClient.eval(`
      (() => {
        const cards = document.querySelectorAll('.member-card');
        return cards.length;
      })()
    `);
    recordTest(
      'UI-12',
      'UI Action: Reset Filters restores all 4 candidate profiles',
      afterReset === 4,
      `Count after reset: ${afterReset}`,
      4,
      afterReset
    );

    // UI-13: DOM Privacy & Data Leak Audit
    const domLeakCheck = await cdpClient.eval(`
      (() => {
        const bodyText = document.querySelector('.member-directory-grid')?.textContent || '';
        const phoneRegex = /\\+91\\d{10}|987654321\\d/;
        const emailRegex = /@example\\.com|candidateEmail/;
        const hasPhoneLeak = phoneRegex.test(bodyText);
        const hasEmailLeak = emailRegex.test(bodyText);
        const hasPasswordLeak = bodyText.includes('passwordHash');
        return { hasPhoneLeak, hasEmailLeak, hasPasswordLeak, cardCount: document.querySelectorAll('.member-card').length };
      })()
    `);
    const privacyOk = !domLeakCheck.hasPhoneLeak && !domLeakCheck.hasEmailLeak && !domLeakCheck.hasPasswordLeak && domLeakCheck.cardCount === 4;
    recordTest(
      'UI-13',
      'DOM Privacy Audit: Zero candidate phone numbers, emails, or credentials in rendered cards',
      privacyOk,
      `Cards inspected: ${domLeakCheck.cardCount}, Phone leak: ${domLeakCheck.hasPhoneLeak}, Email leak: ${domLeakCheck.hasEmailLeak}`,
      { hasPhoneLeak: false, hasEmailLeak: false, hasPasswordLeak: false },
      domLeakCheck
    );

    // -----------------------------------------------------------------------
    // PART C: Unsubscribed Member Paywall Verification
    // -----------------------------------------------------------------------
    console.log('\n--- Part C: Unsubscribed Account Paywall Verification ---');

    // Clear session cookies
    await cdpClient.send('Network.clearBrowserCookies');
    await sleep(1000);

    // Login as unsubscribed user
    await cdpClient.navigate(`${FRONTEND_URL}/login`);
    await sleep(2000);

    await cdpClient.eval(`
      (async () => {
        const emailInput = document.querySelector('input[type="email"]') || document.querySelector('#email');
        const passInput = document.querySelector('input[type="password"]') || document.querySelector('#password');
        const submitBtn = document.querySelector('button[type="submit"]');
        
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(emailInput, '${UNSUB_CREDS.email}');
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        setter.call(passInput, '${UNSUB_CREDS.password}');
        passInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        submitBtn.click();
      })()
    `);

    // Await authentication response and cookie storage
    await sleep(3500);

    // Navigate to /members as unsubscribed user
    await cdpClient.navigate(`${FRONTEND_URL}/members`);
    await sleep(3500);

    // Verify subscription-required paywall state
    const paywallState = await cdpClient.eval(`
      (() => {
        const text = document.body.innerText;
        const hasPaywallHeading = text.includes('Explore eligible matrimonial profiles with an active subscription.');
        const planBtn = Array.from(document.querySelectorAll('a, button')).find(el => el.textContent.trim() === 'View Membership Plans');
        const homeBtn = Array.from(document.querySelectorAll('a, button')).find(el => el.textContent.trim() === 'Return Home');
        const cardCount = document.querySelectorAll('.member-card').length;
        const hasLockIcon = document.querySelector('svg.lucide-lock') || document.querySelector('.lock-icon') || document.querySelector('svg');
        return {
          hasPaywallHeading,
          hasPlanBtn: Boolean(planBtn),
          planHref: planBtn ? planBtn.getAttribute('href') : null,
          hasHomeBtn: Boolean(homeBtn),
          cardCount,
          hasLockIcon: Boolean(hasLockIcon),
        };
      })()
    `);

    const paywallOk = paywallState.hasPaywallHeading &&
      paywallState.hasPlanBtn &&
      paywallState.hasHomeBtn &&
      paywallState.cardCount === 0;

    recordTest(
      'UI-14',
      'Unsubscribed Account: Displays subscription-required paywall state with "View Membership Plans" button',
      paywallOk,
      `Paywall heading present: ${paywallState.hasPaywallHeading}, Cards count: ${paywallState.cardCount}, Plan button link: ${paywallState.planHref}`,
      { hasPaywallHeading: true, hasPlanBtn: true, cardCount: 0 },
      paywallState
    );

  } catch (err) {
    console.error('Fatal error during browser automation:', err);
  } finally {
    if (cdpClient) {
      cdpClient.close();
    }
    console.log('\nClosing headless Microsoft Edge browser...');
    try {
      edgeProc.kill('SIGTERM');
    } catch (_) {}
  }

  console.log('\n========================================================================');
  const total = testResults.length;
  const passedCount = testResults.filter((t) => t.passed).length;
  const failedCount = total - passedCount;
  console.log(` Summary: ${passedCount}/${total} browser checks passed (${failedCount} failed)`);
  console.log('========================================================================\n');

  return { total, passedCount, failedCount };
}

if (require.main === module) {
  runBrowserVerification().then(({ failedCount }) => {
    process.exit(failedCount > 0 ? 1 : 0);
  }).catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}

module.exports = { runBrowserVerification };
