/**
 * Comprehensive Candidate Details Integration Test Suite
 * 
 * Verifies GET /api/members/:profileId against the isolated test database (matrimony_phase5c_test).
 * 
 * Scenarios:
 * CD-01: Unauthenticated request returns 401
 * CD-02: Unsubscribed member request returns 403 NO_SUBSCRIPTION
 * CD-03: Invalid ObjectId returns 404 PROFILE_NOT_FOUND
 * CD-04: Non-existent ObjectId returns 404 PROFILE_NOT_FOUND
 * CD-05: Subscribed member gets valid candidate profile (Priya Sharma) -> 200 OK + safe DTO
 * CD-06: Strict Privacy Audit: zero candidatePhone, candidateEmail, user.email, credentials in GET response
 * CD-07: Self-profile view attempt returns 400 SELF_PROFILE_VIEW_DENIED
 * CD-08: Inactive profile (profileStatus: 'inactive') returns 404
 * CD-09: Unapproved broker profile (approvalStatus: 'pending_approval') returns 404
 * CD-10: Rejected broker profile (approvalStatus: 'rejected') returns 404
 * CD-11: Candidate with owner expired beyond 7-day grace period returns 404 PROFILE_NOT_AVAILABLE
 * CD-12: First contact unlock on candidate profile (charges 1 credit, returns candidatePhone)
 * CD-13: Candidate details after unlock reflects isContactUnlocked: true (phone still hidden from GET DTO)
 * CD-14: Repeat contact unlock charges 0 credits (alreadyUnlocked: true)
 */

const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.test') });

const BASE_URL = 'http://localhost:5001';
const EXPECTED_TEST_DB = 'matrimony_phase5c_test';

const TEST_VIEWER_CREDENTIALS = {
  email: 'test.viewer.phase5c@example.com',
  password: 'TestViewerPass123!',
};

const TEST_UNSUB_CREDENTIALS = {
  email: 'test.unsub.phase5c@example.com',
  password: 'TestUnsubPass123!',
};

function request(method, reqPath, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, BASE_URL);
    const reqHeaders = { ...headers };
    let bodyPayload = null;

    if (data && (method === 'POST' || method === 'PUT')) {
      bodyPayload = typeof data === 'string' ? data : JSON.stringify(data);
      reqHeaders['Content-Type'] = 'application/json';
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
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(rawData);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: rawData,
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
    if (match) return `token=${match[1]}`;
  }
  return null;
}

async function runTests() {
  console.log('========================================================================');
  console.log(' Candidate Details Integration Test Suite (GET /api/members/:profileId)');
  console.log(` Target Server: ${BASE_URL}`);
  console.log('========================================================================\n');

  // Safety Assertion
  const conn = await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  if (conn.connection.name !== EXPECTED_TEST_DB) {
    console.error(`[CRITICAL ABORT] Connected to ${conn.connection.name}, expected ${EXPECTED_TEST_DB}`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`[Safety Guard Passed] Connected strictly to test DB: ${conn.connection.name}\n`);

  const MatrimonialProfile = require('../models/MatrimonialProfile');
  const User = require('../models/User');
  const Subscription = require('../models/Subscription');
  const ContactUnlock = require('../models/ContactUnlock');

  let passedCount = 0;
  let totalCount = 0;

  function assertTest(id, name, condition, details = '') {
    totalCount++;
    if (condition) {
      passedCount++;
      console.log(`  [PASS] ${id}: ${name} ${details ? `(${details})` : ''}`);
    } else {
      console.error(`  [FAIL] ${id}: ${name} ${details ? `FAILED: ${details}` : ''}`);
    }
  }

  // 1. Authenticate sessions
  console.log('1. Authenticating test sessions...');
  const viewerLogin = await request('POST', '/api/auth/login', TEST_VIEWER_CREDENTIALS);
  const viewerCookie = extractTokenCookie(viewerLogin.headers['set-cookie']);
  console.log(`✓ Viewer login: ${viewerLogin.statusCode} (Cookie obtained: ${Boolean(viewerCookie)})`);

  const unsubLogin = await request('POST', '/api/auth/login', TEST_UNSUB_CREDENTIALS);
  const unsubCookie = extractTokenCookie(unsubLogin.headers['set-cookie']);
  console.log(`✓ Unsubscribed login: ${unsubLogin.statusCode} (Cookie obtained: ${Boolean(unsubCookie)})\n`);

  const viewerUser = await User.findOne({ email: TEST_VIEWER_CREDENTIALS.email });

  // Idempotent cleanup before test execution
  await MatrimonialProfile.deleteMany({
    candidateName: {
      $in: [
        'Viewer Self Candidate',
        'Inactive Test Candidate',
        'Pending Broker Candidate',
        'Rejected Broker Candidate',
        'Expired Owner Candidate',
      ],
    },
  });
  await User.deleteMany({ email: 'expired.owner.test@example.com' });
  if (viewerUser) {
    await ContactUnlock.deleteMany({ viewerUser: viewerUser._id });
  }

  // Find seeded candidate profile (Priya Sharma)
  const priya = await MatrimonialProfile.findOne({ candidateName: 'Priya Sharma' });
  const priyaId = priya ? String(priya._id) : null;
  console.log(`Target Candidate ID (Priya Sharma): ${priyaId}\n`);

  // CD-01: Unauthenticated request
  console.log('2. Running Access Control & Validation Tests...');
  const cd01 = await request('GET', `/api/members/${priyaId}`);
  assertTest('CD-01', 'Unauthenticated request returns 401', cd01.statusCode === 401);

  // CD-02: Unsubscribed request
  const cd02 = await request('GET', `/api/members/${priyaId}`, null, { Cookie: unsubCookie });
  assertTest(
    'CD-02',
    'Unsubscribed member returns 403 NO_SUBSCRIPTION',
    cd02.statusCode === 403 && (cd02.json?.code === 'NO_SUBSCRIPTION' || cd02.json?.subscriptionAccess?.code === 'NO_SUBSCRIPTION')
  );

  // CD-03: Invalid ObjectId format
  const cd03 = await request('GET', '/api/members/invalid-profile-12345', null, { Cookie: viewerCookie });
  assertTest('CD-03', 'Invalid ObjectId format returns 404', cd03.statusCode === 404 && cd03.json?.code === 'PROFILE_NOT_FOUND');

  // CD-04: Non-existent ObjectId
  const fakeId = new mongoose.Types.ObjectId();
  const cd04 = await request('GET', `/api/members/${fakeId}`, null, { Cookie: viewerCookie });
  assertTest('CD-04', 'Non-existent profile ID returns 404', cd04.statusCode === 404 && cd04.json?.code === 'PROFILE_NOT_FOUND');

  // CD-05: Subscribed member gets valid candidate profile
  console.log('\n3. Running DTO & Privacy Audit Tests...');
  const cd05 = await request('GET', `/api/members/${priyaId}`, null, { Cookie: viewerCookie });
  const pData = cd05.json?.data;
  const isDtoValid =
    cd05.statusCode === 200 &&
    pData &&
    pData.candidateName === 'Priya Sharma' &&
    pData.personalDetails?.gender === 'Female' &&
    typeof pData.personalDetails?.age === 'number' &&
    pData.personalDetails?.maritalStatus === 'Never Married' &&
    pData.educationAndProfession?.educationalQualification &&
    pData.contactLocked === true &&
    pData.isContactUnlocked === false;
  assertTest('CD-05', 'Subscribed member gets full candidate profile DTO', isDtoValid, `Name: ${pData?.candidateName}`);

  // CD-06: Strict Privacy Audit
  const rawBody = cd05.body || '';
  const hasPhoneInBody = rawBody.includes(priya.candidatePhone) || rawBody.includes('9876543210');
  const hasEmailInBody = rawBody.includes('priya.sharma') || rawBody.includes('@example.com');
  const hasUserField = Boolean(pData?.user);
  const hasPasswordOrHash = rawBody.includes('password') || rawBody.includes('$2a$') || rawBody.includes('salt');
  const isPrivacyClean = !hasPhoneInBody && !hasEmailInBody && !hasUserField && !hasPasswordOrHash;
  assertTest(
    'CD-06',
    'Privacy Audit: zero candidatePhone, candidateEmail, user account, credentials leaked',
    isPrivacyClean,
    `Phone hidden: ${!hasPhoneInBody}, Email hidden: ${!hasEmailInBody}, No user obj: ${!hasUserField}`
  );

  // CD-07: Self-profile view attempt
  console.log('\n4. Running Eligibility & Constraint Tests...');
  // Create synthetic self-owned profile for viewerUser
  // Create synthetic self-owned profile for viewerUser
  const selfProfile = await MatrimonialProfile.create({
    user: viewerUser._id,
    source: 'direct',
    approvalStatus: 'approved',
    profileStatus: 'active',
    candidateName: 'Viewer Self Candidate',
    candidatePhone: '+919999988888',
    personalDetails: { gender: 'Male', maritalStatus: 'Never Married' },
  });

  const cd07 = await request('GET', `/api/members/${selfProfile._id}`, null, { Cookie: viewerCookie });
  assertTest(
    'CD-07',
    'Self-profile view attempt returns 400 SELF_PROFILE_VIEW_DENIED',
    cd07.statusCode === 400 && cd07.json?.code === 'SELF_PROFILE_VIEW_DENIED'
  );

  // CD-08: Inactive profile
  const inactiveProfile = await MatrimonialProfile.create({
    source: 'broker',
    approvalStatus: 'approved',
    profileStatus: 'inactive',
    candidateName: 'Inactive Test Candidate',
    candidatePhone: '+919999911111',
    personalDetails: { gender: 'Female', maritalStatus: 'Never Married' },
  });
  const cd08 = await request('GET', `/api/members/${inactiveProfile._id}`, null, { Cookie: viewerCookie });
  assertTest('CD-08', 'Inactive profile returns 404', cd08.statusCode === 404);

  // CD-09: Pending broker profile
  const pendingProfile = await MatrimonialProfile.create({
    source: 'broker',
    approvalStatus: 'pending_approval',
    profileStatus: 'active',
    candidateName: 'Pending Broker Candidate',
    candidatePhone: '+919999922222',
    personalDetails: { gender: 'Female', maritalStatus: 'Never Married' },
  });
  const cd09 = await request('GET', `/api/members/${pendingProfile._id}`, null, { Cookie: viewerCookie });
  assertTest('CD-09', 'Pending broker profile returns 404', cd09.statusCode === 404);

  // CD-10: Rejected broker profile
  const rejectedProfile = await MatrimonialProfile.create({
    source: 'broker',
    approvalStatus: 'rejected',
    profileStatus: 'active',
    candidateName: 'Rejected Broker Candidate',
    candidatePhone: '+919999933333',
    personalDetails: { gender: 'Female', maritalStatus: 'Never Married' },
  });
  const cd10 = await request('GET', `/api/members/${rejectedProfile._id}`, null, { Cookie: viewerCookie });
  assertTest('CD-10', 'Rejected broker profile returns 404', cd10.statusCode === 404);

  // CD-11: Candidate with owner expired beyond 7-day grace period
  const expiredOwner = await User.create({
    name: 'Expired Test Owner',
    email: 'expired.owner.test@example.com',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuu',
    role: 'user',
  });
  const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const pastEndDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
  await Subscription.create({
    user: expiredOwner._id,
    planCode: 'THREE_MONTHS',
    durationMonths: 3,
    status: 'expired',
    startDate: pastDate,
    endDate: pastEndDate,
    gracePeriodEndDate: new Date(pastEndDate.getTime() + 7 * 24 * 60 * 60 * 1000),
    paymentStatus: 'completed',
  });
  const expiredProfile = await MatrimonialProfile.create({
    user: expiredOwner._id,
    source: 'direct',
    approvalStatus: 'approved',
    profileStatus: 'active',
    candidateName: 'Expired Owner Candidate',
    candidatePhone: '+919999944444',
    personalDetails: { gender: 'Male', maritalStatus: 'Never Married' },
  });

  const cd11 = await request('GET', `/api/members/${expiredProfile._id}`, null, { Cookie: viewerCookie });
  assertTest(
    'CD-11',
    'Profile with owner expired beyond grace period returns 404',
    cd11.statusCode === 404 && cd11.json?.code === 'PROFILE_NOT_AVAILABLE'
  );

  // CD-12: First contact unlock on candidate profile
  console.log('\n5. Running Contact Unlock Integration Tests...');
  const unlockRes1 = await request('POST', `/api/members/${priyaId}/view-contact`, null, { Cookie: viewerCookie });
  const isUnlock1Valid =
    unlockRes1.statusCode === 200 &&
    unlockRes1.json?.data?.candidatePhone === priya.candidatePhone &&
    unlockRes1.json?.data?.alreadyUnlocked === false &&
    unlockRes1.json?.data?.creditsCharged === 1;
  assertTest(
    'CD-12',
    'First contact unlock deducts 1 credit and returns phone number',
    isUnlock1Valid,
    `Phone: ${unlockRes1.json?.data?.candidatePhone}, Credits charged: ${unlockRes1.json?.data?.creditsCharged}`
  );

  // CD-13: Candidate details after unlock reflects isContactUnlocked: true
  const cd13 = await request('GET', `/api/members/${priyaId}`, null, { Cookie: viewerCookie });
  const isUnlockedFlag =
    cd13.statusCode === 200 &&
    cd13.json?.data?.isContactUnlocked === true &&
    cd13.json?.data?.contactLocked === true &&
    !cd13.body.includes(priya.candidatePhone); // Phone still hidden from GET response!
  assertTest(
    'CD-13',
    'Candidate details after unlock reflects isContactUnlocked: true (phone still hidden from GET)',
    isUnlockedFlag
  );

  // CD-14: Repeat contact unlock charges 0 credits
  const unlockRes2 = await request('POST', `/api/members/${priyaId}/view-contact`, null, { Cookie: viewerCookie });
  const isUnlock2Valid =
    unlockRes2.statusCode === 200 &&
    unlockRes2.json?.data?.candidatePhone === priya.candidatePhone &&
    unlockRes2.json?.data?.alreadyUnlocked === true &&
    unlockRes2.json?.data?.creditsCharged === 0;
  assertTest(
    'CD-14',
    'Repeat contact unlock charges 0 credits (alreadyUnlocked: true)',
    isUnlock2Valid,
    `Credits charged: ${unlockRes2.json?.data?.creditsCharged}`
  );

  // Cleanup synthetic temporary test fixtures created in this run
  await MatrimonialProfile.deleteMany({
    _id: { $in: [selfProfile._id, inactiveProfile._id, pendingProfile._id, rejectedProfile._id, expiredProfile._id] },
  });
  await User.deleteOne({ _id: expiredOwner._id });
  await Subscription.deleteMany({ user: expiredOwner._id });

  console.log('\n========================================================================');
  console.log(` Summary: ${passedCount} / ${totalCount} Passed (${Math.round((passedCount / totalCount) * 100)}%)`);
  console.log('========================================================================\n');

  await mongoose.disconnect();
  process.exit(passedCount === totalCount ? 0 : 1);
}

runTests().catch(async (err) => {
  console.error('\n[FATAL ERROR IN TEST RUNNER]', err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
