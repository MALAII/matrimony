/**
 * Comprehensive Member Directory Integration Test Suite (Phase 5C - Step 3)
 * Target: http://localhost:5001 (matrimony_phase5c_test isolated test server)
 */

const http = require('http');

const BASE_URL = 'http://localhost:5001';
const TEST_VIEWER_CREDENTIALS = {
  email: 'test.viewer.phase5c@example.com',
  password: 'TestViewerPass123!',
};
const TEST_UNSUB_CREDENTIALS = {
  email: 'test.unsub.phase5c@example.com',
  password: 'TestUnsubPass123!',
};

// Helper: Make HTTP request returning { statusCode, headers, body, json }
function request(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
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

// Extract token cookie from Set-Cookie header
function extractTokenCookie(setCookieHeaders) {
  if (!setCookieHeaders) return null;
  const cookieArr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const c of cookieArr) {
    const match = c.match(/token=([^;]+)/);
    if (match) return match[1];
  }
  return null;
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

async function runDirectoryTestSuite() {
  console.log('========================================================================');
  console.log(' Member Directory Integration Test Suite (Phase 5C - Step 3)');
  console.log(' Server Target: http://localhost:5001 (matrimony_phase5c_test)');
  console.log('========================================================================\n');

  let viewerCookie = null;
  let unsubCookie = null;

  // -------------------------------------------------------------------------
  // 1. Authentication & Access Tests
  // -------------------------------------------------------------------------
  console.log('--- 1. Authentication & Access Control ---');

  // Test 1: Unauthenticated request must return 401
  try {
    const res = await request('GET', '/api/members');
    const passed = res.statusCode === 401 && res.json?.success === false;
    recordTest(
      'TC-01',
      'Unauthenticated GET /api/members returns 401',
      passed,
      res.json?.message || 'No message',
      401,
      res.statusCode
    );
  } catch (err) {
    recordTest('TC-01', 'Unauthenticated GET /api/members returns 401', false, err.message, 401, 'ERROR');
  }

  // Test 2: Login unsubscribed user
  try {
    const res = await request('POST', '/api/auth/login', TEST_UNSUB_CREDENTIALS);
    const token = extractTokenCookie(res.headers['set-cookie']);
    unsubCookie = token ? `token=${token}` : null;
    const passed = res.statusCode === 200 && Boolean(unsubCookie);
    recordTest(
      'TC-02A',
      'Login with unsubscribed test account',
      passed,
      'User authenticated successfully',
      200,
      res.statusCode
    );
  } catch (err) {
    recordTest('TC-02A', 'Login with unsubscribed test account', false, err.message, 200, 'ERROR');
  }

  // Test 3: Unsubscribed user accessing directory returns 403 NO_SUBSCRIPTION
  try {
    const res = await request('GET', '/api/members', null, { Cookie: unsubCookie });
    const passed = res.statusCode === 403 && (res.json?.code === 'NO_SUBSCRIPTION' || res.json?.code === 'NO_ACTIVE_SUBSCRIPTION');
    recordTest(
      'TC-02B',
      'Unsubscribed user GET /api/members returns 403 NO_SUBSCRIPTION',
      passed,
      `code: ${res.json?.code}, reason: ${res.json?.message}`,
      { statusCode: 403, code: 'NO_SUBSCRIPTION' },
      { statusCode: res.statusCode, code: res.json?.code }
    );
  } catch (err) {
    recordTest('TC-02B', 'Unsubscribed user GET /api/members returns 403', false, err.message, 403, 'ERROR');
  }

  // Test 4: Login active subscriber
  try {
    const res = await request('POST', '/api/auth/login', TEST_VIEWER_CREDENTIALS);
    const token = extractTokenCookie(res.headers['set-cookie']);
    viewerCookie = token ? `token=${token}` : null;
    const passed = res.statusCode === 200 && Boolean(viewerCookie);
    recordTest(
      'TC-03A',
      'Login with active-subscriber test account',
      passed,
      'Viewer authenticated successfully with session cookie',
      200,
      res.statusCode
    );
  } catch (err) {
    recordTest('TC-03A', 'Login with active-subscriber test account', false, err.message, 200, 'ERROR');
  }

  // Test 5: Active subscriber accessing directory returns 200 with all 4 seeded profiles
  let initialMembers = [];
  try {
    const res = await request('GET', '/api/members', null, { Cookie: viewerCookie });
    initialMembers = Array.isArray(res.json?.data) ? res.json.data : [];
    const passed = res.statusCode === 200 && res.json?.success === true && initialMembers.length === 4;
    recordTest(
      'TC-03B',
      'Active subscriber GET /api/members returns 200 with all 4 seeded profiles',
      passed,
      `Found ${initialMembers.length} profiles`,
      { statusCode: 200, profileCount: 4 },
      { statusCode: res.statusCode, profileCount: initialMembers.length }
    );
  } catch (err) {
    recordTest('TC-03B', 'Active subscriber GET /api/members returns 200', false, err.message, 200, 'ERROR');
  }

  // -------------------------------------------------------------------------
  // 2. Structured Filters Tests
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Structured Search Filters ---');

  // Test 6: Filter by gender = Female
  try {
    const res = await request('GET', '/api/members?gender=Female', null, { Cookie: viewerCookie });
    const members = Array.isArray(res.json?.data) ? res.json.data : [];
    const names = members.map((m) => m.candidateName).sort();
    const passed = res.statusCode === 200 && members.length === 2 && names.includes('Priya Sharma') && names.includes('Divya Balan');
    recordTest(
      'TC-04',
      'Filter gender=Female returns Priya Sharma & Divya Balan',
      passed,
      `Names returned: ${names.join(', ')}`,
      ['Divya Balan', 'Priya Sharma'],
      names
    );
  } catch (err) {
    recordTest('TC-04', 'Filter gender=Female', false, err.message, 2, 'ERROR');
  }

  // Test 7: Filter by gender = Male
  try {
    const res = await request('GET', '/api/members?gender=Male', null, { Cookie: viewerCookie });
    const members = Array.isArray(res.json?.data) ? res.json.data : [];
    const names = members.map((m) => m.candidateName).sort();
    const passed = res.statusCode === 200 && members.length === 2 && names.includes('Anand Kumar') && names.includes('Rajesh Varma');
    recordTest(
      'TC-05',
      'Filter gender=Male returns Anand Kumar & Rajesh Varma',
      passed,
      `Names returned: ${names.join(', ')}`,
      ['Anand Kumar', 'Rajesh Varma'],
      names
    );
  } catch (err) {
    recordTest('TC-05', 'Filter gender=Male', false, err.message, 2, 'ERROR');
  }

  // Test 8: Age Range 25 to 30 (Priya=29, Divya=25; Anand=32, Rajesh=37 outside)
  try {
    const res = await request('GET', '/api/members?minAge=25&maxAge=30', null, { Cookie: viewerCookie });
    const members = Array.isArray(res.json?.data) ? res.json.data : [];
    const names = members.map((m) => m.candidateName).sort();
    const passed = res.statusCode === 200 && members.length === 2 && names.includes('Priya Sharma') && names.includes('Divya Balan');
    recordTest(
      'TC-06',
      'Filter minAge=25&maxAge=30 returns Priya Sharma (29) & Divya Balan (25)',
      passed,
      `Names returned: ${names.join(', ')}`,
      ['Divya Balan', 'Priya Sharma'],
      names
    );
  } catch (err) {
    recordTest('TC-06', 'Filter minAge=25&maxAge=30', false, err.message, 2, 'ERROR');
  }

  // Test 9: Age Range 35 to 40 (Rajesh=37 matched, Anand=32, Priya=29, Divya=25 excluded)
  try {
    const res = await request('GET', '/api/members?minAge=35&maxAge=40', null, { Cookie: viewerCookie });
    const members = Array.isArray(res.json?.data) ? res.json.data : [];
    const names = members.map((m) => m.candidateName);
    const passed = res.statusCode === 200 && members.length === 1 && names[0] === 'Rajesh Varma';
    recordTest(
      'TC-07',
      'Filter minAge=35&maxAge=40 returns Rajesh Varma (37 on 2026-10-15)',
      passed,
      `Names returned: ${names.join(', ')}`,
      ['Rajesh Varma'],
      names
    );
  } catch (err) {
    recordTest('TC-07', 'Filter minAge=35&maxAge=40', false, err.message, 1, 'ERROR');
  }

  // Test 10: Filter by maritalStatus = Divorced
  try {
    const res = await request('GET', '/api/members?maritalStatus=Divorced', null, { Cookie: viewerCookie });
    const members = Array.isArray(res.json?.data) ? res.json.data : [];
    const names = members.map((m) => m.candidateName);
    const passed = res.statusCode === 200 && members.length === 1 && names[0] === 'Rajesh Varma';
    recordTest(
      'TC-08',
      'Filter maritalStatus=Divorced returns Rajesh Varma',
      passed,
      `Names returned: ${names.join(', ')}`,
      ['Rajesh Varma'],
      names
    );
  } catch (err) {
    recordTest('TC-08', 'Filter maritalStatus=Divorced', false, err.message, 1, 'ERROR');
  }

  // Test 11: Filter by location = Chennai
  try {
    const res = await request('GET', '/api/members?location=Chennai', null, { Cookie: viewerCookie });
    const members = Array.isArray(res.json?.data) ? res.json.data : [];
    const names = members.map((m) => m.candidateName);
    const passed = res.statusCode === 200 && members.length === 1 && names[0] === 'Anand Kumar';
    recordTest(
      'TC-09',
      'Filter location=Chennai returns Anand Kumar',
      passed,
      `Names returned: ${names.join(', ')}`,
      ['Anand Kumar'],
      names
    );
  } catch (err) {
    recordTest('TC-09', 'Filter location=Chennai', false, err.message, 1, 'ERROR');
  }

  // Test 12: Filter by education = Computer Science
  try {
    const res = await request('GET', '/api/members?education=Computer+Science', null, { Cookie: viewerCookie });
    const members = Array.isArray(res.json?.data) ? res.json.data : [];
    const names = members.map((m) => m.candidateName);
    const passed = res.statusCode === 200 && members.length === 1 && names[0] === 'Priya Sharma';
    recordTest(
      'TC-10',
      'Filter education=Computer Science returns Priya Sharma',
      passed,
      `Names returned: ${names.join(', ')}`,
      ['Priya Sharma'],
      names
    );
  } catch (err) {
    recordTest('TC-10', 'Filter education=Computer Science', false, err.message, 1, 'ERROR');
  }

  // Test 13: Filter by occupation = Data Scientist
  try {
    const res = await request('GET', '/api/members?occupation=Data+Scientist', null, { Cookie: viewerCookie });
    const members = Array.isArray(res.json?.data) ? res.json.data : [];
    const names = members.map((m) => m.candidateName);
    const passed = res.statusCode === 200 && members.length === 1 && names[0] === 'Divya Balan';
    recordTest(
      'TC-11',
      'Filter occupation=Data Scientist returns Divya Balan',
      passed,
      `Names returned: ${names.join(', ')}`,
      ['Divya Balan'],
      names
    );
  } catch (err) {
    recordTest('TC-11', 'Filter occupation=Data Scientist', false, err.message, 1, 'ERROR');
  }

  // Test 14: Combined Filter - Female, 24-30 yrs, Bangalore
  try {
    const res = await request('GET', '/api/members?gender=Female&minAge=24&maxAge=30&location=Bangalore', null, { Cookie: viewerCookie });
    const members = Array.isArray(res.json?.data) ? res.json.data : [];
    const names = members.map((m) => m.candidateName);
    const passed = res.statusCode === 200 && members.length === 1 && names[0] === 'Divya Balan';
    recordTest(
      'TC-12',
      'Combined filter gender=Female&minAge=24&maxAge=30&location=Bangalore returns Divya Balan',
      passed,
      `Names returned: ${names.join(', ')}`,
      ['Divya Balan'],
      names
    );
  } catch (err) {
    recordTest('TC-12', 'Combined filter Female 24-30 Bangalore', false, err.message, 1, 'ERROR');
  }

  // Test 15: Keyword search combined with structured filter (search=Finance&gender=Male)
  try {
    const res = await request('GET', '/api/members?search=Finance&gender=Male', null, { Cookie: viewerCookie });
    const members = Array.isArray(res.json?.data) ? res.json.data : [];
    const names = members.map((m) => m.candidateName);
    const passed = res.statusCode === 200 && members.length === 1 && names[0] === 'Anand Kumar';
    recordTest(
      'TC-13',
      'Combined keyword search=Finance & gender=Male returns Anand Kumar',
      passed,
      `Names returned: ${names.join(', ')}`,
      ['Anand Kumar'],
      names
    );
  } catch (err) {
    recordTest('TC-13', 'Keyword + filter', false, err.message, 1, 'ERROR');
  }

  // -------------------------------------------------------------------------
  // 3. Pagination Tests
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Pagination & Empty State ---');

  // Test 16: Pagination page 1 and page 2 with limit 2
  try {
    const res1 = await request('GET', '/api/members?page=1&limit=2', null, { Cookie: viewerCookie });
    const res2 = await request('GET', '/api/members?page=2&limit=2', null, { Cookie: viewerCookie });
    const page1Members = Array.isArray(res1.json?.data) ? res1.json.data : [];
    const page2Members = Array.isArray(res2.json?.data) ? res2.json.data : [];
    const page1Ids = page1Members.map((m) => m.id);
    const page2Ids = page2Members.map((m) => m.id);
    const overlapping = page1Ids.filter((id) => page2Ids.includes(id));
    const allIds = new Set([...page1Ids, ...page2Ids]);

    const passed =
      res1.statusCode === 200 &&
      res2.statusCode === 200 &&
      page1Members.length === 2 &&
      page2Members.length === 2 &&
      overlapping.length === 0 &&
      allIds.size === 4 &&
      res1.json?.pagination?.page === 1 &&
      res2.json?.pagination?.page === 2 &&
      res1.json?.pagination?.totalRecords === 4;

    recordTest(
      'TC-14',
      'Pagination page 1 & 2 with limit=2 (no duplicates, complete set)',
      passed,
      `Page 1 count: ${page1Members.length}, Page 2 count: ${page2Members.length}, Overlaps: ${overlapping.length}`,
      { page1Count: 2, page2Count: 2, overlaps: 0, totalUnique: 4 },
      { page1Count: page1Members.length, page2Count: page2Members.length, overlaps: overlapping.length, totalUnique: allIds.size }
    );
  } catch (err) {
    recordTest('TC-14', 'Pagination test', false, err.message, 4, 'ERROR');
  }

  // Test 17: Empty / Reset Filter returns full eligible set
  try {
    const res = await request('GET', '/api/members?page=1&limit=12', null, { Cookie: viewerCookie });
    const members = Array.isArray(res.json?.data) ? res.json.data : [];
    const passed = res.statusCode === 200 && members.length === 4 && res.json?.pagination?.totalRecords === 4;
    recordTest(
      'TC-15',
      'Reset/empty filter request returns full eligible set (4 candidates)',
      passed,
      `Returned count: ${members.length}`,
      4,
      members.length
    );
  } catch (err) {
    recordTest('TC-15', 'Reset filter test', false, err.message, 4, 'ERROR');
  }

  // -------------------------------------------------------------------------
  // 4. Invalid Parameter Safety Rejections
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Input Validation & Error Handling ---');

  const invalidTestCases = [
    { query: 'page=0', desc: 'page=0 rejected', expectedCode: 400 },
    { query: 'limit=100', desc: 'limit=100 (>50) rejected', expectedCode: 400 },
    { query: 'gender=InvalidGender', desc: 'gender=InvalidGender rejected', expectedCode: 400 },
    { query: 'minAge=15', desc: 'minAge=15 (<18) rejected', expectedCode: 400 },
    { query: 'minAge=40&maxAge=25', desc: 'minAge > maxAge rejected', expectedCode: 400 },
    { query: 'maritalStatus=Single', desc: 'maritalStatus=Single rejected', expectedCode: 400 },
  ];

  for (let i = 0; i < invalidTestCases.length; i++) {
    const { query, desc, expectedCode } = invalidTestCases[i];
    try {
      const res = await request('GET', `/api/members?${query}`, null, { Cookie: viewerCookie });
      const passed = res.statusCode === expectedCode && res.json?.success === false;
      recordTest(
        `TC-16.${i + 1}`,
        `Invalid parameter safety rejection: ${desc}`,
        passed,
        res.json?.message || 'No message',
        expectedCode,
        res.statusCode
      );
    } catch (err) {
      recordTest(`TC-16.${i + 1}`, desc, false, err.message, expectedCode, 'ERROR');
    }
  }

  // -------------------------------------------------------------------------
  // 5. Privacy, Data Leak Prevention & DTO Verification
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Privacy & Data Leak Prevention ---');

  try {
    const res = await request('GET', '/api/members?limit=12', null, { Cookie: viewerCookie });
    const members = Array.isArray(res.json?.data) ? res.json.data : [];
    let exposedPhone = 0;
    let exposedEmail = 0;
    let exposedUserFields = 0;
    let exposedPasswords = 0;
    let exposedAuditFields = 0;

    for (const m of members) {
      if (m.candidatePhone || m.phone) exposedPhone++;
      if (m.candidateEmail || m.email) exposedEmail++;
      if (m.user && (m.user.email || m.user.passwordHash || m.user.role)) exposedUserFields++;
      if (m.password || m.passwordHash) exposedPasswords++;
      if (m.approvedBy || m.approvalStatus || m.deactivationReason) exposedAuditFields++;
    }

    const passed =
      res.statusCode === 200 &&
      members.length === 4 &&
      exposedPhone === 0 &&
      exposedEmail === 0 &&
      exposedUserFields === 0 &&
      exposedPasswords === 0 &&
      exposedAuditFields === 0;

    recordTest(
      'TC-17',
      'Privacy projection audit: Zero phone, email, password, or audit field leaks',
      passed,
      `Evaluated ${members.length} profile cards: 0 leaks detected`,
      { exposedPhone: 0, exposedEmail: 0, exposedUserFields: 0, exposedAuditFields: 0 },
      { exposedPhone, exposedEmail, exposedUserFields, exposedAuditFields }
    );
  } catch (err) {
    recordTest('TC-17', 'Privacy audit', false, err.message, 0, 'ERROR');
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  const total = testResults.length;
  const passedCount = testResults.filter((t) => t.passed).length;
  const failedCount = total - passedCount;
  console.log(` Summary: ${passedCount}/${total} tests passed (${failedCount} failed)`);
  console.log('========================================================================\n');

  return { total, passedCount, failedCount, testResults };
}

if (require.main === module) {
  runDirectoryTestSuite().then(({ failedCount }) => {
    process.exit(failedCount > 0 ? 1 : 0);
  }).catch((err) => {
    console.error('Fatal suite error:', err);
    process.exit(1);
  });
}

module.exports = { runDirectoryTestSuite };
