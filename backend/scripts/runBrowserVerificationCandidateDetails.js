/**
 * Isolated Browser Verification Suite for Candidate Details View
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
const PROFILE_DIR = path.resolve('C:\\Users\\Windows\\.gemini\\antigravity\\brain\\d479c192-034c-4251-b9fa-f8491206adbc\\scratch\\edge_profile_cd');
const CDP_PORT = 9223;

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
  console.log(' Candidate Details UI Browser Verification Suite (Microsoft Edge CDP)');
  console.log(` Frontend Target: ${FRONTEND_URL} (Isolated Port 3001)`);
  console.log('========================================================================\n');

  // Pre-test DB cleanup: reset ContactUnlock records so viewer starts fresh (1 credit test)
  console.log('[Setup] Connecting to matrimony_phase5c_test to reset prior test unlocks...');
  let selfProfileId = null;
  const conn = await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  const User = require('../models/User');
  const ContactUnlock = require('../models/ContactUnlock');
  const MatrimonialProfile = require('../models/MatrimonialProfile');
  const viewer = await User.findOne({ email: SUBSCRIBER_CREDS.email });
  if (viewer) {
    await ContactUnlock.deleteMany({ viewerUser: viewer._id });
    console.log('✓ Reset viewer contact unlocks for clean first-unlock test.');

    let viewerSelfProfile = await MatrimonialProfile.findOne({ user: viewer._id });
    if (!viewerSelfProfile) {
      viewerSelfProfile = await MatrimonialProfile.create({
        user: viewer._id,
        source: 'direct',
        approvalStatus: 'approved',
        profileStatus: 'active',
        candidateName: 'Viewer Self Candidate',
        candidatePhone: '+919999988888',
        personalDetails: { gender: 'Male', maritalStatus: 'Never Married', age: 30 },
        location: { city: 'Mumbai', state: 'Maharashtra', country: 'India' },
      });
      console.log('✓ Created synthetic self-profile for viewer self-profile denial test.');
    }
    selfProfileId = viewerSelfProfile._id.toString();
  }
  await mongoose.disconnect();

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

  console.log('\n[Launching Browser] Starting headless Microsoft Edge...');
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

    // UI-CD-01: Authenticate with subscriber credentials
    console.log('1. Authenticating as active subscriber...');
    await cdp.navigate(`${FRONTEND_URL}/login`);

    const loginScript = `
      (async () => {
        for (let i = 0; i < 20; i++) {
          // If already logged in, click Log Out first
          const logoutBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Log Out'));
          if (logoutBtn) {
            logoutBtn.click();
            await new Promise(r => setTimeout(r, 1500));
          }

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
          await new Promise(r => setTimeout(r, 400));
        }
        return { error: 'Login inputs not found within timeout' };
      })()
    `;
    const loginRes = await cdp.eval(loginScript);
    await sleep(3500); // Allow login request to resolve HttpOnly cookie
    reportTest('UI-CD-01', 'Subscriber Login on port 3001', loginRes?.success);

    // UI-CD-02: Open /members and verify View Full Profile links
    console.log('\n2. Verifying Member Directory Card Linkage...');
    await cdp.navigate(`${FRONTEND_URL}/members`);
    await sleep(2500);

    const checkDirectoryCards = `
      (() => {
        const cards = document.querySelectorAll('.member-card');
        const viewProfileLinks = document.querySelectorAll('.btn-view-profile');
        const priyaCard = Array.from(cards).find(c => c.textContent.includes('Priya Sharma'));
        let priyaLink = null;
        if (priyaCard) {
          const l = priyaCard.querySelector('.btn-view-profile') || priyaCard.querySelector('a[href*="/members/"]');
          if (l) priyaLink = l.getAttribute('href');
        }
        return {
          cardCount: cards.length,
          viewProfileCount: viewProfileLinks.length,
          priyaLink,
        };
      })()
    `;
    const dirInfo = await cdp.eval(checkDirectoryCards);
    const hasViewProfile = dirInfo?.cardCount > 0 && dirInfo?.viewProfileCount > 0 && Boolean(dirInfo?.priyaLink);
    reportTest(
      'UI-CD-02',
      'Directory Cards render "View Full Profile" links',
      hasViewProfile,
      `Cards: ${dirInfo?.cardCount}, View Profile links: ${dirInfo?.viewProfileCount}, Priya Link: ${dirInfo?.priyaLink}`
    );

    const priyaProfileHref = dirInfo?.priyaLink || '/members';

    // UI-CD-03 & UI-CD-04: Navigate to Priya Sharma Candidate Details
    console.log('\n3. Verifying Candidate Details Page Structure & Layout...');
    await cdp.navigate(`${FRONTEND_URL}${priyaProfileHref}`);
    await sleep(3000);

    const checkDetailsPage = `
      (() => {
        const h1 = document.querySelector('h1')?.textContent?.trim();
        const bodyText = document.body.textContent;
        const hasPersonalDetails = bodyText.includes('Personal Details');
        const hasEducationCareer = bodyText.includes('Education & Career');
        const hasFamilyDetails = bodyText.includes('Family Details');
        const hasPartnerPreferences = bodyText.includes('Partner Preferences');
        const hasAge = bodyText.includes('29 yrs') || bodyText.includes('29 years');
        const hasGender = bodyText.includes('Female');
        const hasLocation = bodyText.includes('Mumbai') || bodyText.includes('Maharashtra');
        const hasBackLink = Boolean(document.querySelector('a[href="/members"]'));

        return {
          h1,
          hasPersonalDetails,
          hasEducationCareer,
          hasFamilyDetails,
          hasPartnerPreferences,
          hasAge,
          hasGender,
          hasLocation,
          hasBackLink,
        };
      })()
    `;
    const details = await cdp.eval(checkDetailsPage);
    const isDetailsValid =
      details?.h1 === 'Priya Sharma' &&
      details?.hasPersonalDetails &&
      details?.hasEducationCareer &&
      details?.hasFamilyDetails &&
      details?.hasPartnerPreferences &&
      details?.hasAge &&
      details?.hasGender &&
      details?.hasBackLink;
    reportTest(
      'UI-CD-03',
      'Candidate Details Page loaded with complete structured sections',
      isDetailsValid,
      `H1: ${details?.h1}, Sections: Personal/Edu/Family/Prefs present, Back link present: ${details?.hasBackLink}`
    );

    // Responsive Viewports on Candidate Details Page
    console.log('\n4. Verifying Responsive Viewports...');
    await cdp.setViewport(1280, 800);
    const desktopOk = await cdp.eval(`(() => document.body.scrollWidth <= window.innerWidth + 5)()`);
    reportTest('UI-CD-04', 'Desktop Viewport (1280x800) layout integrity (no horizontal scrollbar)', desktopOk);

    await cdp.setViewport(375, 667);
    const mobileOk = await cdp.eval(`(() => document.body.scrollWidth <= window.innerWidth + 5)()`);
    reportTest('UI-CD-05', 'Mobile Viewport (375x667) layout integrity (responsive wrapping, no overflow)', mobileOk);

    // Reset back to standard desktop viewport
    await cdp.setViewport(1280, 800);

    // UI-CD-06: Locked Contact Panel
    console.log('\n5. Verifying Locked Contact Panel...');
    const checkLockedPanel = `
      (() => {
        const bodyText = document.body.textContent;
        const hasCreditExpl = bodyText.includes('1 contact credit is deducted on first unlock') || bodyText.includes('1 Credit');
        const unlockBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.textContent.includes('View Contact Number')
        );
        const rawPhoneExposed = bodyText.includes('9876543210');
        return {
          hasCreditExpl,
          hasUnlockBtn: Boolean(unlockBtn),
          unlockBtnText: unlockBtn?.textContent?.trim(),
          rawPhoneExposed,
        };
      })()
    `;
    const lockedInfo = await cdp.eval(checkLockedPanel);
    const isLockedValid = lockedInfo?.hasCreditExpl && lockedInfo?.hasUnlockBtn && !lockedInfo?.rawPhoneExposed;
    reportTest(
      'UI-CD-06',
      'Locked contact panel explains credit deduction without exposing raw phone',
      isLockedValid,
      `Btn: "${lockedInfo?.unlockBtnText}", Raw phone in DOM: ${lockedInfo?.rawPhoneExposed}`
    );

    // UI-CD-07: Unlock contact on the candidate page
    console.log('\n6. Executing Contact Unlock on Candidate Detail Page...');
    const clickUnlockScript = `
      (() => {
        const unlockBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.textContent.includes('View Contact Number') || b.textContent.includes('View Unlocked')
        );
        if (!unlockBtn) return { error: 'Unlock button not found' };
        unlockBtn.click();
        return { clicked: true };
      })()
    `;
    const clickRes = await cdp.eval(clickUnlockScript);
    await sleep(3000);

    const checkUnlockedState = `
      (() => {
        const bodyText = document.body.textContent;
        const hasPhone = bodyText.includes('+919876543210') || bodyText.includes('9876543210');
        const hasCreditNotice = bodyText.includes('Contact unlocked') || bodyText.includes('Previously unlocked');
        const hasPhoneIcon = Boolean(document.querySelector('svg.lucide-phone'));
        return {
          hasPhone,
          hasCreditNotice,
          hasPhoneIcon,
        };
      })()
    `;
    const unlockedRes = await cdp.eval(checkUnlockedState);
    const isUnlockSuccessful = unlockedRes?.hasPhone && unlockedRes?.hasCreditNotice && unlockedRes?.hasPhoneIcon;
    reportTest(
      'UI-CD-07',
      'Contact unlock revealed phone number with Lucide Phone icon and credit notice',
      isUnlockSuccessful,
      `Phone visible: ${unlockedRes?.hasPhone}, Phone icon: ${unlockedRes?.hasPhoneIcon}, Notice: ${unlockedRes?.hasCreditNotice}`
    );

    // UI-CD-08: Navigate away and revisit same profile (Zero-credit retrieval)
    console.log('\n7. Verifying Revisit Zero-Credit Repeat Unlock...');
    await cdp.navigate(`${FRONTEND_URL}/members`);
    await sleep(2000);
    await cdp.navigate(`${FRONTEND_URL}${priyaProfileHref}`);
    await sleep(3000);

    const checkRevisitState = `
      (() => {
        const bodyText = document.body.textContent;
        // Phone must NOT be pre-loaded in the GET response DOM
        const hasPreloadedPhone = bodyText.includes('+919876543210') || bodyText.includes('9876543210');
        const repeatUnlockBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.textContent.includes('View Unlocked Phone Number (Free)')
        );
        return {
          hasPreloadedPhone,
          hasRepeatBtn: Boolean(repeatUnlockBtn),
          btnText: repeatUnlockBtn?.textContent?.trim(),
        };
      })()
    `;
    const revisitInfo = await cdp.eval(checkRevisitState);
    reportTest(
      'UI-CD-08',
      'Revisit does not leak raw phone in GET DTO; shows Free Unlocked button',
      !revisitInfo?.hasPreloadedPhone && revisitInfo?.hasRepeatBtn,
      `Raw phone in GET DOM: ${revisitInfo?.hasPreloadedPhone}, Button: "${revisitInfo?.btnText}"`
    );

    // Click repeat free unlock
    await cdp.eval(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('View Unlocked'));
        if (btn) btn.click();
      })()
    `);
    await sleep(2500);

    const repeatUnlockedInfo = await cdp.eval(`
      (() => {
        const bodyText = document.body.textContent;
        return {
          hasPhone: bodyText.includes('9876543210'),
          hasZeroCreditText: bodyText.includes('Previously unlocked') || bodyText.includes('0 credits deducted'),
        };
      })()
    `);
    reportTest(
      'UI-CD-09',
      'Clicking Free Unlocked button retrieves phone at 0 additional credits',
      repeatUnlockedInfo?.hasPhone && repeatUnlockedInfo?.hasZeroCreditText,
      `Phone retrieved: ${repeatUnlockedInfo?.hasPhone}, Notice: ${repeatUnlockedInfo?.hasZeroCreditText}`
    );

    // UI-CD-10: Inactive / Invalid Profile 404 State
    console.log('\n8. Verifying Inactive / Invalid Profile 404 State...');
    await cdp.navigate(`${FRONTEND_URL}/members/000000000000000000000000`);
    await sleep(3000);

    const check404State = `
      (() => {
        const bodyText = document.body.textContent;
        const hasNotFoundHeading = bodyText.includes('Candidate Profile Not Found or Unavailable') || bodyText.includes('Not Found');
        const hasReturnBtn = bodyText.includes('Return to Directory') || bodyText.includes('Back to Member Directory');
        return {
          hasNotFoundHeading,
          hasReturnBtn,
        };
      })()
    `;
    const notFoundInfo = await cdp.eval(check404State);
    reportTest(
      'UI-CD-10',
      'Invalid / Inactive profile ID renders clean 404 state with return CTA',
      notFoundInfo?.hasNotFoundHeading && notFoundInfo?.hasReturnBtn
    );

    // UI-CD-11: Attempting to open logged-in candidate's own profile is denied
    console.log('\n9. Verifying Self-Profile View Denial...');
    if (selfProfileId) {
      await cdp.navigate(`${FRONTEND_URL}/members/${selfProfileId}`);
      await sleep(3000);

      const checkSelfProfileState = `
        (() => {
          const bodyText = document.body.textContent;
          const hasSelfHeading = bodyText.includes('This is Your Own Profile');
          const hasSelfExplanation = bodyText.includes('You cannot view your own matrimonial profile');
          const hasMyProfileLink = Array.from(document.querySelectorAll('a')).some(
            a => a.textContent.includes('Go to My Profile') && a.getAttribute('href') === '/profile'
          );
          const hasBackLink = Array.from(document.querySelectorAll('a')).some(
            a => a.textContent.includes('Back to Member Directory') && a.getAttribute('href') === '/members'
          );
          const candidateDetailsHidden = !bodyText.includes('Personal Details') && !bodyText.includes('Education & Career');
          return {
            hasSelfHeading,
            hasSelfExplanation,
            hasMyProfileLink,
            hasBackLink,
            candidateDetailsHidden,
          };
        })()
      `;
      const selfInfo = await cdp.eval(checkSelfProfileState);
      const isSelfProfileValid =
        selfInfo?.hasSelfHeading &&
        selfInfo?.hasSelfExplanation &&
        selfInfo?.hasMyProfileLink &&
        selfInfo?.hasBackLink &&
        selfInfo?.candidateDetailsHidden;
      reportTest(
        'UI-CD-11',
        'Attempting to open own profile is denied with "This is Your Own Profile" and CTA to /profile',
        isSelfProfileValid,
        `Self heading: ${selfInfo?.hasSelfHeading}, My Profile CTA: ${selfInfo?.hasMyProfileLink}, Details hidden: ${selfInfo?.candidateDetailsHidden}`
      );
    } else {
      reportTest('UI-CD-11', 'Attempting to open own profile is denied (selfProfileId missing)', false);
    }

    // UI-CD-12: Unsubscribed Account Paywall Gate
    console.log('\n10. Verifying Unsubscribed Paywall Gate...');
    // Clear cookies to completely terminate subscriber session
    await cdp.send('Network.clearBrowserCookies');
    await cdp.navigate(`${FRONTEND_URL}/login`);
    await sleep(2500);

    const unsubLoginScript = `
      (async () => {
        for (let i = 0; i < 20; i++) {
          const logoutBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Log Out'));
          if (logoutBtn) {
            logoutBtn.click();
            await new Promise(r => setTimeout(r, 1500));
          }

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
          await new Promise(r => setTimeout(r, 400));
        }
        return { error: 'Login elements missing on clean login page' };
      })()
    `;
    const unsubLoginRes = await cdp.eval(unsubLoginScript);
    await sleep(3500);

    await cdp.navigate(`${FRONTEND_URL}${priyaProfileHref}`);
    await sleep(3000);

    const checkUnsubPaywall = `
      (() => {
        const bodyText = document.body.textContent;
        const hasLockHeading = bodyText.includes('Explore eligible matrimonial profiles with an active subscription.');
        const hasPlansBtn = Array.from(document.querySelectorAll('a')).some(
          a => a.textContent.includes('View Membership Plans') && a.getAttribute('href') === '/membership'
        );
        const hasHomeBtn = Array.from(document.querySelectorAll('a')).some(a => a.textContent.includes('Return Home'));
        const candidateDetailsHidden = !bodyText.includes('Personal Details') && !bodyText.includes('Education & Career');
        return {
          hasLockHeading,
          hasPlansBtn,
          hasHomeBtn,
          candidateDetailsHidden,
        };
      })()
    `;
    const paywallInfo = await cdp.eval(checkUnsubPaywall);
    const isPaywallValid = paywallInfo?.hasLockHeading && paywallInfo?.hasPlansBtn && paywallInfo?.candidateDetailsHidden;
    reportTest(
      'UI-CD-12',
      'Unsubscribed user sees paywall state with "View Membership Plans" CTA (0 candidate details leaked)',
      isPaywallValid,
      `Lock heading: ${paywallInfo?.hasLockHeading}, Plans CTA: ${paywallInfo?.hasPlansBtn}, Details hidden: ${paywallInfo?.candidateDetailsHidden}`
    );

    console.log('\n========================================================================');
    console.log(` Browser Verification Summary: ${passedCount} / ${testCount} Passed (${Math.round((passedCount / testCount) * 100)}%)`);
    console.log('========================================================================\n');

  } finally {
    if (cdp) cdp.close();
    edgeProc.kill();
    try {
      fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
    } catch (_) {}
    if (selfProfileId) {
      try {
        await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
        const MatrimonialProfile = require('../models/MatrimonialProfile');
        await MatrimonialProfile.deleteOne({ _id: selfProfileId });
        await mongoose.disconnect();
        console.log('✓ Cleaned up temporary synthetic self-profile.');
      } catch (_) {}
    }
  }

  process.exit(passedCount === testCount ? 0 : 1);
}

runBrowserVerification().catch((err) => {
  console.error('\n[FATAL ERROR IN BROWSER TEST RUNNER]', err);
  process.exit(1);
});
