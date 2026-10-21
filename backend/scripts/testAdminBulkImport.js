/**
 * Comprehensive Automated Test Suite: Admin Bulk Excel Candidate Import
 * Database: matrimony_phase5c_test
 * Port: Ephemeral HTTP Server
 */

const http = require('http');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');

// Load isolated test environment
const envTestPath = path.join(__dirname, '../.env.test');
dotenv.config({ path: envTestPath });

const EXPECTED_TEST_DB = 'matrimony_phase5c_test';

const User = require('../models/User');
const MatrimonialProfile = require('../models/MatrimonialProfile');
const ImportBatch = require('../models/ImportBatch');
const ImportStagingRecord = require('../models/ImportStagingRecord');
const app = require('../app');

/**
 * Builds an in-memory .xlsx buffer using ExcelJS
 */
async function createTestExcelWorkbook(headers, rows) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Candidates');

  worksheet.addRow(headers);
  for (const row of rows) {
    worksheet.addRow(row);
  }

  return await workbook.xlsx.writeBuffer();
}

/**
 * Builds multipart form data payload for Excel upload
 */
function buildExcelMultipartPayload(fieldName, filename, fileBuffer) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const crlf = '\r\n';

  const header =
    `--${boundary}${crlf}` +
    `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"${crlf}` +
    `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet${crlf}${crlf}`;

  const footer = `${crlf}--${boundary}--${crlf}`;

  const payload = Buffer.concat([
    Buffer.from(header, 'utf-8'),
    fileBuffer,
    Buffer.from(footer, 'utf-8'),
  ]);

  return {
    boundary,
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: payload,
  };
}

function request(baseUrl, options, explicitBody = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(options.path, baseUrl);
    const body = explicitBody !== null ? explicitBody : options.body || null;
    const reqOptions = {
      method: options.method || 'GET',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { ...(options.headers || {}) },
    };

    const req = http.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        let json = null;
        try {
          json = JSON.parse(raw);
        } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json || raw,
        });
      });
    });

    req.on('error', reject);

    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else if (typeof body === 'object') {
        req.setHeader('Content-Type', 'application/json');
        req.write(JSON.stringify(body));
      } else {
        req.write(body);
      }
    }

    req.end();
  });
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log(' Automated Integration Test Suite: Admin Bulk Candidate Excel Import');
  console.log('========================================================================\n');

  // Connect to isolated test database
  let mongoUri = process.env.MONGODB_URI;
  let conn;

  try {
    conn = await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
  } catch (atlasErr) {
    console.warn(`[Notice] Cloud Atlas unreachable (${atlasErr.message.slice(0, 50)}...). Falling back to local test DB.`);
    mongoUri = 'mongodb://127.0.0.1:27017/matrimony_phase5c_test';
    conn = await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  }

  const actualDb = conn.connection.name;
  if (actualDb !== EXPECTED_TEST_DB) {
    console.error(`[FATAL] Connected to '${actualDb}', expected '${EXPECTED_TEST_DB}'`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`✓ Connected to isolated test DB: ${actualDb}`);

  // Capture baseline record counts
  const baselineUsers = await User.countDocuments();
  const baselineProfiles = await MatrimonialProfile.countDocuments();
  console.log(`✓ Baseline DB records: ${baselineUsers} users, ${baselineProfiles} profiles\n`);

  // Start test server
  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  const serverPort = testServer.address().port;
  const baseUrl = `http://127.0.0.1:${serverPort}`;
  console.log(`✓ Test HTTP server listening on ${baseUrl}\n`);

  let testCount = 0;
  let passedCount = 0;

  function report(id, description, passed, detail = '') {
    testCount++;
    if (passed) {
      passedCount++;
      console.log(`  [PASS] ${id}: ${description} ${detail ? `(${detail})` : ''}`);
    } else {
      console.error(`  [FAIL] ${id}: ${description} FAILED: ${detail}`);
    }
  }

  let syntheticAdmin = null;
  let syntheticMember = null;
  let preExistingProfile = null;
  let adminCookie = '';
  let memberCookie = '';

  const STANDARD_HEADERS = [
    'Candidate Name',
    'Candidate Phone',
    'Candidate Email',
    'Gender',
    'Date of Birth',
    'Height (cm)',
    'Marital Status',
    'Mother Tongue',
    'Current Location',
    'Education Qualification',
    'Occupation',
    'Company Name',
    'Work Location',
    'Annual Income',
    'Family Details',
    'Parent Details',
    'Sibling Details',
    'Family Location',
    'Partner Preferred Min Age',
    'Partner Preferred Max Age',
    'Partner Preferred Location',
    'Partner Education Preference',
    'Partner Occupation Preference',
    'Other Preferences',
  ];

  try {
    // -------------------------------------------------------------------------
    // Setup Test Accounts & Existing Data Fixtures
    // -------------------------------------------------------------------------
    const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_phase5c';

    syntheticAdmin = await User.create({
      name: 'Import Test Admin',
      email: 'import.admin@example.com',
      passwordHash: 'dummy_hash',
      role: 'admin',
      accountStatus: 'active',
    });

    syntheticMember = await User.create({
      name: 'Registered Existing Member',
      email: 'existing.member.user@example.com',
      passwordHash: 'dummy_hash',
      role: 'user',
      accountStatus: 'active',
    });

    preExistingProfile = await MatrimonialProfile.create({
      user: null,
      source: 'broker',
      approvalStatus: 'approved',
      candidateName: 'Existing Candidate In Database',
      candidatePhone: '9840999999',
      candidateEmail: 'existing.candidate.db@example.com',
    });

    const adminToken = jwt.sign({ id: syntheticAdmin._id, role: 'admin' }, jwtSecret, { expiresIn: '1h' });
    const memberToken = jwt.sign({ id: syntheticMember._id, role: 'user' }, jwtSecret, { expiresIn: '1h' });
    adminCookie = `token=${adminToken}`;
    memberCookie = `token=${memberToken}`;

    console.log('--- Suite 1: Template Download & Authorization Security ---');

    // Test 1: Download official Excel starter template
    const templateRes = await request(baseUrl, {
      method: 'GET',
      path: '/api/admin/imports/candidates/template',
      headers: { Cookie: adminCookie },
    });
    report(
      'IMP-01',
      'GET /template returns HTTP 200 with Excel spreadsheet content-type',
      templateRes.status === 200 &&
      templateRes.headers['content-type']?.includes('spreadsheetml.sheet')
    );

    // Test 2: Unauthenticated /validate access rejected
    const unauthVal = await request(baseUrl, {
      method: 'POST',
      path: '/api/admin/imports/candidates/validate',
    });
    report('IMP-02', 'Unauthenticated POST /validate returns HTTP 401', unauthVal.status === 401);

    // Test 3: Member role /validate access rejected
    const memberVal = await request(baseUrl, {
      method: 'POST',
      path: '/api/admin/imports/candidates/validate',
      headers: { Cookie: memberCookie },
    });
    report('IMP-03', 'Member role POST /validate returns HTTP 403 Forbidden', memberVal.status === 403);

    console.log('\n--- Suite 2: File Format & Header Validation ---');

    // Test 4: Upload non-Excel file (e.g. text/plain with wrong magic bytes)
    const badFilePayload = buildExcelMultipartPayload('file', 'test.txt', Buffer.from('This is a text file'));
    const badFileRes = await request(
      baseUrl,
      {
        method: 'POST',
        path: '/api/admin/imports/candidates/validate',
        headers: { Cookie: adminCookie, 'Content-Type': badFilePayload.contentType },
      },
      badFilePayload.body
    );
    report(
      'IMP-04',
      'Uploading invalid file type returns HTTP 400',
      badFileRes.status === 400
    );

    // Test 5: Missing mandatory column (Candidate Phone missing from header)
    const incompleteHeaders = ['Candidate Name', 'Candidate Email', 'Gender'];
    const incompleteBuffer = await createTestExcelWorkbook(incompleteHeaders, [
      ['Ravi Kumar', 'ravi@example.com', 'Male'],
    ]);
    const incPayload = buildExcelMultipartPayload('file', 'incomplete.xlsx', incompleteBuffer);
    const incRes = await request(
      baseUrl,
      {
        method: 'POST',
        path: '/api/admin/imports/candidates/validate',
        headers: { Cookie: adminCookie, 'Content-Type': incPayload.contentType },
      },
      incPayload.body
    );
    report(
      'IMP-05',
      'Spreadsheet missing mandatory column (Phone) returns HTTP 400 with column warning',
      incRes.status === 400 &&
      incRes.body?.message?.includes('Candidate Phone')
    );

    console.log('\n--- Suite 3: Multi-Tier Duplicate Detection & Dry-Run Invariance ---');

    // Test 6: Construct spreadsheet containing:
    // - Row 2: Valid Candidate A
    // - Row 3: Valid Candidate B
    // - Row 4: Duplicate of Candidate A (in-file duplicate phone & email) -> SKIPPED
    // - Row 5: Duplicate of pre-existing candidate profile (Phone matches DB) -> SKIPPED
    // - Row 6: Duplicate of existing registered user (Email matches User table) -> SKIPPED
    // - Row 7: Invalid Row (Missing Phone and Invalid Email) -> SKIPPED
    const mixedRows = [
      // Row 2: Valid Candidate A
      [
        'Karthik Sundaram', '9840111111', 'karthik.s@example.com',
        'Male', '1994-05-10', 178, 'Never Married', 'Tamil', 'Chennai',
        'B.E', 'Engineer', 'TCS', 'Chennai', '15 LPA',
        'Nuclear family', 'Parents retired', 'None', 'Chennai',
        22, 28, 'Chennai', 'Graduate', 'IT', 'None',
      ],
      // Row 3: Valid Candidate B
      [
        'Meena Natarajan', '9840222222', 'meena.n@example.com',
        'Female', '1996-08-20', 165, 'Never Married', 'Tamil', 'Madurai',
        'MBA', 'Manager', 'Infosys', 'Madurai', '12 LPA',
        'Traditional', 'Parents in Madurai', '1 brother', 'Madurai',
        26, 32, 'Tamil Nadu', 'Post Graduate', 'Professional', 'None',
      ],
      // Row 4: In-file duplicate of Candidate A (same phone '9840111111')
      [
        'Karthik Sundaram Duplicate', '9840111111', 'karthik.dup@example.com',
        'Male', '1994-05-10', 178, 'Never Married', 'Tamil', 'Chennai',
      ],
      // Row 5: Database duplicate matching preExistingProfile (phone '9840999999')
      [
        'Collision Profile Candidate', '9840999999', 'collision.profile@example.com',
        'Female', '1995-01-01', 160, 'Never Married', 'Tamil', 'Salem',
      ],
      // Row 6: Database duplicate matching syntheticMember (email 'existing.member.user@example.com')
      [
        'Collision User Candidate', '9840333333', 'existing.member.user@example.com',
        'Male', '1992-04-12', 172, 'Never Married', 'Tamil', 'Trichy',
      ],
      // Row 7: Invalid Row (empty phone, malformed email)
      [
        'Broken Row Candidate', '', 'not-an-email',
        'Male', '1990-01-01', 170, 'Never Married', 'Tamil', 'Coimbatore',
      ],
    ];

    const mixedExcelBuffer = await createTestExcelWorkbook(STANDARD_HEADERS, mixedRows);
    const mixedPayload = buildExcelMultipartPayload('file', 'test_candidates.xlsx', mixedExcelBuffer);

    // Profile count prior to validation
    const profilesBeforeValidate = await MatrimonialProfile.countDocuments();

    const validateRes = await request(
      baseUrl,
      {
        method: 'POST',
        path: '/api/admin/imports/candidates/validate',
        headers: { Cookie: adminCookie, 'Content-Type': mixedPayload.contentType },
      },
      mixedPayload.body
    );

    const stats = validateRes.body?.data?.stats;
    const batchId = validateRes.body?.data?.batchId;
    const profilesAfterValidate = await MatrimonialProfile.countDocuments();

    report(
      'IMP-06',
      'Dry-Run validation calculates exact stats: 6 total, 2 valid, 3 duplicates, 1 invalid',
      validateRes.status === 200 &&
      stats?.totalRows === 6 &&
      stats?.validRows === 2 &&
      stats?.duplicateRows === 3 &&
      stats?.invalidRows === 1
    );

    report(
      'IMP-07',
      'Dry-Run immutability: zero profiles created in MatrimonialProfile collection during /validate',
      profilesBeforeValidate === profilesAfterValidate
    );

    // Test 8: Download CSV error report
    const csvRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/admin/imports/candidates/${batchId}/errors/csv`,
      headers: { Cookie: adminCookie },
    });
    const csvContent = typeof csvRes.body === 'string' ? csvRes.body : '';
    report(
      'IMP-08',
      'GET /errors/csv returns CSV report containing row numbers, contact details, and failure reasons',
      csvRes.status === 200 &&
      csvRes.headers['content-type']?.includes('text/csv') &&
      csvContent.includes('Duplicate in spreadsheet') &&
      csvContent.includes('Duplicate candidate: Phone already registered') &&
      csvContent.includes('Duplicate candidate: Email already registered') &&
      csvContent.includes('Candidate Phone is mandatory')
    );

    console.log('\n--- Suite 4: Commit Execution & Schema Invariants ---');

    // Test 9: Execute Commit
    const commitRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/admin/imports/candidates/commit',
      headers: { Cookie: adminCookie },
      body: { batchId },
    });

    report(
      'IMP-09',
      'POST /commit returns HTTP 200 and reports exactly 2 valid candidates imported',
      commitRes.status === 200 &&
      commitRes.body?.data?.importedRows === 2
    );

    // Test 10: Invariant verification on imported profiles
    const importedDocs = await MatrimonialProfile.find({ importBatchId: batchId });
    const allHaveBrokerSource = importedDocs.length > 0 && importedDocs.every((p) => p.source === 'broker');
    const allHavePendingApproval = importedDocs.length > 0 && importedDocs.every((p) => p.approvalStatus === 'pending_approval');
    const allHaveActiveStatus = importedDocs.length > 0 && importedDocs.every((p) => p.profileStatus === 'active');
    const allHaveNullUser = importedDocs.length > 0 && importedDocs.every((p) => p.user === null || p.user === undefined);
    const allHaveEmptyPhotos = importedDocs.length > 0 && importedDocs.every((p) => (p.photos || []).length === 0 && (!p.profilePhoto || !p.profilePhoto.url));

    const imp10Passed = importedDocs.length === 2 &&
      allHaveBrokerSource &&
      allHavePendingApproval &&
      allHaveActiveStatus &&
      allHaveNullUser &&
      allHaveEmptyPhotos;

    const imp10Detail = imp10Passed ? '' : `docs=${importedDocs.length}, broker=${allHaveBrokerSource}, pending=${allHavePendingApproval}, active=${allHaveActiveStatus}, nullUser=${allHaveNullUser}, emptyPhotos=${allHaveEmptyPhotos}`;

    report(
      'IMP-10',
      'All imported profiles strictly enforce source=broker, approvalStatus=pending_approval, user=null, photos=[]',
      imp10Passed,
      imp10Detail
    );

    // Test 11: Member Directory Invisibility
    // Directory should NOT show the imported pending profiles
    const directoryDocCheck = await MatrimonialProfile.find({
      approvalStatus: 'approved',
      importBatchId: batchId,
    });
    report(
      'IMP-11',
      'Imported candidates are excluded from active directory (approvalStatus !== approved)',
      directoryDocCheck.length === 0
    );

    // Test 12: Replay / Idempotency Guard (Re-committing same batch returns HTTP 409 Conflict)
    const replayRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/admin/imports/candidates/commit',
      headers: { Cookie: adminCookie },
      body: { batchId },
    });
    report(
      'IMP-12',
      'Re-executing commit with already committed batchId returns HTTP 409 Conflict',
      replayRes.status === 409 &&
      replayRes.body?.message?.includes('already been committed')
    );

    // Test 13: Staging table cleanup
    const remainingStaging = await ImportStagingRecord.countDocuments({ batchId });
    report(
      'IMP-13',
      'Ephemeral staging records are completely purged from database post-commit',
      remainingStaging === 0
    );

    console.log('\n--- Suite 5: Scale Chunking Benchmark (600 Rows across 3 Chunks) ---');

    // Generate 600 synthetic rows
    const scaleRows = [];
    for (let i = 1; i <= 600; i++) {
      scaleRows.push([
        `Scale Candidate ${i}`,
        `9800${String(i).padStart(6, '0')}`,
        `scale.candidate.${i}@example.com`,
        i % 2 === 0 ? 'Male' : 'Female',
        '1995-01-01',
        170,
        'Never Married',
        'Tamil',
        'Chennai',
      ]);
    }

    const scaleBuffer = await createTestExcelWorkbook(STANDARD_HEADERS, scaleRows);
    const scalePayload = buildExcelMultipartPayload('file', 'scale_600.xlsx', scaleBuffer);

    const scaleValRes = await request(
      baseUrl,
      {
        method: 'POST',
        path: '/api/admin/imports/candidates/validate',
        headers: { Cookie: adminCookie, 'Content-Type': scalePayload.contentType },
      },
      scalePayload.body
    );

    const scaleBatchId = scaleValRes.body?.data?.batchId;
    report(
      'IMP-14',
      'Scale batch validation successfully validates and stages 600 candidate rows',
      scaleValRes.status === 200 &&
      scaleValRes.body?.data?.stats?.validRows === 600
    );

    // Commit the 600 rows (processed in chunks of 250)
    const startTime = Date.now();
    const scaleCommitRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/admin/imports/candidates/commit',
      headers: { Cookie: adminCookie },
      body: { batchId: scaleBatchId },
    });
    const durationMs = Date.now() - startTime;

    report(
      'IMP-15',
      `Chunked insertion processes 600 rows across 3 chunks within time limit (${durationMs}ms)`,
      scaleCommitRes.status === 200 &&
      scaleCommitRes.body?.data?.importedRows === 600 &&
      durationMs < 10000
    );

    // Clean up scale candidates
    await MatrimonialProfile.deleteMany({ importBatchId: scaleBatchId });
    await ImportBatch.deleteOne({ batchId: scaleBatchId });

  } finally {
    // -------------------------------------------------------------------------
    // Teardown & Baseline Audit
    // -------------------------------------------------------------------------
    console.log('\n--- Section 6: Teardown & Database Integrity Verification ---');

    await new Promise((resolve) => testServer.close(resolve));

    // Delete all synthetic fixtures
    if (syntheticAdmin) await User.deleteOne({ _id: syntheticAdmin._id });
    if (syntheticMember) await User.deleteOne({ _id: syntheticMember._id });
    if (preExistingProfile) await MatrimonialProfile.deleteOne({ _id: preExistingProfile._id });

    // Clean any synthetic profiles created during test
    await MatrimonialProfile.deleteMany({
      $or: [
        { candidateEmail: /example\.com$/ },
        { candidateName: /Candidate/ },
      ],
    });
    await ImportBatch.deleteMany({});
    await ImportStagingRecord.deleteMany({});

    // Verify baseline counts
    const finalUsers = await User.countDocuments();
    const finalProfiles = await MatrimonialProfile.countDocuments();

    const usersMatch = finalUsers === baselineUsers;
    const profilesMatch = finalProfiles === baselineProfiles;

    console.log(`  Users baseline: ${baselineUsers} -> Final: ${finalUsers} (Matched: ${usersMatch})`);
    console.log(`  Profiles baseline: ${baselineProfiles} -> Final: ${finalProfiles} (Matched: ${profilesMatch})`);

    await mongoose.disconnect();

    console.log('\n========================================================================');
    console.log(` RESULTS: ${passedCount} / ${testCount} Tests Passed (${testCount - passedCount} Failed)`);
    console.log('========================================================================\n');

    if (passedCount === testCount && usersMatch && profilesMatch) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}

runTestSuite().catch((err) => {
  console.error('[FATAL TEST ERROR]', err);
  process.exit(1);
});
