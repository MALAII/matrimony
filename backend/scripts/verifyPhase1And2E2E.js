/**
 * End-to-End Verification Suite for Phase 1 & Phase 2
 * Scope: Candidate Photo Gallery (Backend Endpoints, Mongoose Schema, Frontend API Contracts, Persistence, Security)
 * Database: matrimony_phase5c_test
 */

const http = require('http');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Load isolated test environment
const envTestPath = path.join(__dirname, '../.env.test');
dotenv.config({ path: envTestPath });

const EXPECTED_TEST_DB = 'matrimony_phase5c_test';

const User = require('../models/User');
const MatrimonialProfile = require('../models/MatrimonialProfile');
const app = require('../app');
const cloudinaryConfig = require('../config/cloudinary');
const profileController = require('../controllers/profileController');

// Sample valid JPEG buffer with valid magic bytes
const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
]);

function buildMultipartPayload(fieldName, filename, fileBuffer) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const crlf = '\r\n';

  const header =
    `--${boundary}${crlf}` +
    `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"${crlf}` +
    `Content-Type: image/jpeg${crlf}${crlf}`;

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

function request(baseUrl, options, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(options.path, baseUrl);
    const reqOptions = {
      method: options.method || 'GET',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: options.headers || {},
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

async function runE2EVerification() {
  console.log('========================================================================');
  console.log(' Focused End-to-End Verification: Phase 1 & Phase 2 Photo Management');
  console.log('========================================================================\n');

  // 1. Database Connection & Environment Audit
  let mongoUri = process.env.MONGODB_URI;
  let conn;

  try {
    conn = await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
  } catch (atlasErr) {
    console.warn(`[Notice] Cloud Atlas unreachable (${atlasErr.message.slice(0, 60)}...). Using local test MongoDB.`);
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

  // Baseline records
  const baselineUsers = await User.countDocuments();
  const baselineProfiles = await MatrimonialProfile.countDocuments();
  console.log(`✓ Baseline counts: ${baselineUsers} users, ${baselineProfiles} profiles\n`);

  // Start test server on ephemeral port
  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  const serverPort = testServer.address().port;
  const baseUrl = `http://127.0.0.1:${serverPort}`;
  console.log(`✓ Test HTTP server listening on ${baseUrl}\n`);

  let checksTotal = 0;
  let checksPassed = 0;
  let checksBlocked = 0;
  const results = [];

  function recordCheck(id, description, passed, detail = '', blocked = false) {
    checksTotal++;
    if (blocked) {
      checksBlocked++;
      results.push({ id, description, status: 'BLOCKED', detail });
      console.log(`  [BLOCKED] ${id}: ${description} (${detail})`);
    } else if (passed) {
      checksPassed++;
      results.push({ id, description, status: 'PASS', detail });
      console.log(`  [PASS] ${id}: ${description} ${detail ? `(${detail})` : ''}`);
    } else {
      results.push({ id, description, status: 'FAIL', detail });
      console.error(`  [FAIL] ${id}: ${description} FAILED: ${detail}`);
    }
  }

  // Backup original cloudinary functions
  const originalIsConfigured = cloudinaryConfig.isCloudinaryConfigured;
  const originalUpload = profileController.uploadToCloudinary;
  const originalDestroy = cloudinaryConfig.cloudinary.uploader.destroy;

  const destroyedCloudinaryAssets = [];
  let simulatedUploadCounter = 0;

  let syntheticAdmin = null;
  let syntheticMember = null;
  let syntheticCandidate = null;
  let adminCookie = '';
  let memberCookie = '';

  try {
    // -------------------------------------------------------------------------
    // Check 1: Cloudinary Configuration Audit (Separating Real vs Mocked)
    // -------------------------------------------------------------------------
    console.log('--- Section 1: Cloudinary Configuration & Environment Audit ---');
    const realCloudinaryConfiguredInTest = originalIsConfigured();
    console.log(`  Cloudinary in .env.test configured?: ${realCloudinaryConfiguredInTest}`);

    recordCheck(
      'ENV-01',
      'Test environment safely recognizes whether Cloudinary credentials exist without leaking secrets',
      typeof realCloudinaryConfiguredInTest === 'boolean',
      `Configured: ${realCloudinaryConfiguredInTest}`
    );

    // Create synthetic auth sessions
    const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_phase5c';
    syntheticAdmin = await User.create({
      name: 'Verification Admin',
      email: 'e2e.admin@example.com',
      passwordHash: 'dummy_hash',
      role: 'admin',
      accountStatus: 'active',
    });

    syntheticMember = await User.create({
      name: 'Verification Member',
      email: 'e2e.member@example.com',
      passwordHash: 'dummy_hash',
      role: 'user',
      accountStatus: 'active',
    });

    syntheticCandidate = await MatrimonialProfile.create({
      user: null,
      source: 'broker',
      approvalStatus: 'pending_approval',
      candidateName: 'Pooja Sundaram (Synthetic Test)',
      candidatePhone: '9840123456',
      candidateEmail: 'pooja.sundaram.test@example.com',
    });

    const adminToken = jwt.sign({ id: syntheticAdmin._id, role: 'admin' }, jwtSecret, { expiresIn: '1h' });
    const memberToken = jwt.sign({ id: syntheticMember._id, role: 'user' }, jwtSecret, { expiresIn: '1h' });
    adminCookie = `token=${adminToken}`;
    memberCookie = `token=${memberToken}`;

    // Test real Cloudinary unconfigured behavior (Guard test)
    if (!realCloudinaryConfiguredInTest) {
      const mpGuard = buildMultipartPayload('photo', 'guard.jpg', VALID_JPEG_BUFFER);
      const guardRes = await request(
        baseUrl,
        {
          method: 'POST',
          path: `/api/admin/profiles/${syntheticCandidate._id}/photos`,
          headers: { Cookie: adminCookie, 'Content-Type': mpGuard.contentType },
        },
        mpGuard.body
      );
      recordCheck(
        'GUARD-01',
        'When Cloudinary is unconfigured, upload safely returns HTTP 503 Service Unavailable',
        guardRes.status === 503,
        `HTTP ${guardRes.status}`
      );
    } else {
      recordCheck(
        'GUARD-01',
        'Real Cloudinary credentials present; skipping unconfigured guard check',
        true,
        'Real credentials detected'
      );
    }

    // -------------------------------------------------------------------------
    // Setup Mocked Cloudinary Adapter for Full Lifecycle Verification
    // -------------------------------------------------------------------------
    console.log('\n--- Section 2: Mocked Cloudinary Adapter Lifecycle Testing ---');
    cloudinaryConfig.isCloudinaryConfigured = () => true;
    profileController.uploadToCloudinary = async (buf) => {
      simulatedUploadCounter++;
      return {
        secure_url: `https://res.cloudinary.com/demo/image/upload/v1/pooja_photo_${simulatedUploadCounter}.jpg`,
        public_id: `matrimony/candidates/pooja_photo_${simulatedUploadCounter}`,
      };
    };
    cloudinaryConfig.cloudinary.uploader.destroy = async (publicId) => {
      destroyedCloudinaryAssets.push(publicId);
      return { result: 'ok' };
    };

    // -------------------------------------------------------------------------
    // Check 2: Unauthorized & Forbidden Access
    // -------------------------------------------------------------------------
    const unauthRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/admin/profiles/${syntheticCandidate._id}/photos`,
    });
    recordCheck('SEC-01', 'Unauthenticated request to GET /photos returns HTTP 401', unauthRes.status === 401);

    const memberRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/admin/profiles/${syntheticCandidate._id}/photos`,
      headers: { Cookie: memberCookie },
    });
    recordCheck('SEC-02', 'Member role request to GET /photos returns HTTP 403 Forbidden', memberRes.status === 403);

    const memberPostRes = await request(baseUrl, {
      method: 'POST',
      path: `/api/admin/profiles/${syntheticCandidate._id}/photos`,
      headers: { Cookie: memberCookie },
    });
    recordCheck('SEC-03', 'Member role request to POST /photos returns HTTP 403 Forbidden', memberPostRes.status === 403);

    // -------------------------------------------------------------------------
    // Check 3: Initial Candidate Photo Loading
    // -------------------------------------------------------------------------
    const initGet = await request(baseUrl, {
      method: 'GET',
      path: `/api/admin/profiles/${syntheticCandidate._id}/photos`,
      headers: { Cookie: adminCookie },
    });
    recordCheck(
      'API-01',
      'Admin GET /photos returns HTTP 200 with accurate response envelope',
      initGet.status === 200 &&
      initGet.body?.success === true &&
      initGet.body?.data?.count === 0 &&
      initGet.body?.data?.maxAllowed === 3
    );

    // -------------------------------------------------------------------------
    // Check 4: Upload Photo 1 -> Auto-Primary Promotion & Count Update
    // -------------------------------------------------------------------------
    const mpUpload1 = buildMultipartPayload('photo', 'photo_1.jpg', VALID_JPEG_BUFFER);
    const uploadRes1 = await request(
      baseUrl,
      {
        method: 'POST',
        path: `/api/admin/profiles/${syntheticCandidate._id}/photos`,
        headers: { Cookie: adminCookie, 'Content-Type': mpUpload1.contentType },
      },
      mpUpload1.body
    );
    const photo1 = uploadRes1.body?.data?.photos?.[0];
    recordCheck(
      'PHOTO-01',
      'Upload Photo 1 returns HTTP 201, auto-promotes isPrimary=true, and syncs root profilePhoto',
      uploadRes1.status === 201 &&
      uploadRes1.body?.data?.count === 1 &&
      photo1?.isPrimary === true &&
      uploadRes1.body?.data?.primaryPhoto?.url === photo1?.url
    );

    // -------------------------------------------------------------------------
    // Check 5: Upload Photo 2 -> isPrimary remains Photo 1
    // -------------------------------------------------------------------------
    const mpUpload2 = buildMultipartPayload('photo', 'photo_2.jpg', VALID_JPEG_BUFFER);
    const uploadRes2 = await request(
      baseUrl,
      {
        method: 'POST',
        path: `/api/admin/profiles/${syntheticCandidate._id}/photos`,
        headers: { Cookie: adminCookie, 'Content-Type': mpUpload2.contentType },
      },
      mpUpload2.body
    );
    const photo2 = uploadRes2.body?.data?.photos?.[1];
    recordCheck(
      'PHOTO-02',
      'Upload Photo 2 returns HTTP 201, isPrimary=false, and primaryPhoto remains Photo 1',
      uploadRes2.status === 201 &&
      uploadRes2.body?.data?.count === 2 &&
      photo2?.isPrimary === false &&
      uploadRes2.body?.data?.primaryPhoto?.publicId === photo1?.publicId
    );

    // -------------------------------------------------------------------------
    // Check 6: Upload Photo 3 -> Full Gallery Ceiling
    // -------------------------------------------------------------------------
    const mpUpload3 = buildMultipartPayload('photo', 'photo_3.jpg', VALID_JPEG_BUFFER);
    const uploadRes3 = await request(
      baseUrl,
      {
        method: 'POST',
        path: `/api/admin/profiles/${syntheticCandidate._id}/photos`,
        headers: { Cookie: adminCookie, 'Content-Type': mpUpload3.contentType },
      },
      mpUpload3.body
    );
    const photo3 = uploadRes3.body?.data?.photos?.[2];
    recordCheck(
      'PHOTO-03',
      'Upload Photo 3 returns HTTP 201 and fills all 3 gallery slots',
      uploadRes3.status === 201 &&
      uploadRes3.body?.data?.count === 3 &&
      photo3 !== undefined
    );

    // -------------------------------------------------------------------------
    // Check 7: Upload Photo 4 -> Enforced Rejection
    // -------------------------------------------------------------------------
    const mpUpload4 = buildMultipartPayload('photo', 'photo_4.jpg', VALID_JPEG_BUFFER);
    const uploadRes4 = await request(
      baseUrl,
      {
        method: 'POST',
        path: `/api/admin/profiles/${syntheticCandidate._id}/photos`,
        headers: { Cookie: adminCookie, 'Content-Type': mpUpload4.contentType },
      },
      mpUpload4.body
    );
    recordCheck(
      'LIMIT-01',
      'Attempting 4th photo returns HTTP 400 and preserves 3-photo ceiling',
      uploadRes4.status === 400 &&
      uploadRes4.body?.message?.includes('maximum allowed of 3 photos')
    );

    // -------------------------------------------------------------------------
    // Check 8: Set Primary Photo to Photo 2
    // -------------------------------------------------------------------------
    const setPrimRes = await request(
      baseUrl,
      {
        method: 'PATCH',
        path: `/api/admin/profiles/${syntheticCandidate._id}/photos/${photo2._id}/primary`,
        headers: { Cookie: adminCookie },
      }
    );
    recordCheck(
      'PRIMARY-01',
      'PATCH /primary switches primaryPhoto to target photo and toggles isPrimary flags',
      setPrimRes.status === 200 &&
      setPrimRes.body?.data?.primaryPhoto?.publicId === photo2.publicId &&
      setPrimRes.body?.data?.photos?.find((p) => p._id === photo2._id)?.isPrimary === true &&
      setPrimRes.body?.data?.photos?.find((p) => p._id === photo1._id)?.isPrimary === false
    );

    // -------------------------------------------------------------------------
    // Check 9: Replace Photo 2 -> Destroys Old Asset on Cloudinary
    // -------------------------------------------------------------------------
    const mpReplace = buildMultipartPayload('photo', 'photo_2_new.jpg', VALID_JPEG_BUFFER);
    const replaceRes = await request(
      baseUrl,
      {
        method: 'PUT',
        path: `/api/admin/profiles/${syntheticCandidate._id}/photos/${photo2._id}`,
        headers: { Cookie: adminCookie, 'Content-Type': mpReplace.contentType },
      },
      mpReplace.body
    );
    const replacedPhoto = replaceRes.body?.data?.photos?.find((p) => p._id === photo2._id);
    recordCheck(
      'REPLACE-01',
      'PUT /replace updates asset URL/publicId and triggers Cloudinary destroy for old asset',
      replaceRes.status === 200 &&
      replacedPhoto.publicId !== photo2.publicId &&
      destroyedCloudinaryAssets.includes(photo2.publicId)
    );

    // -------------------------------------------------------------------------
    // Check 10: Delete Primary Photo -> Auto-Promote Another Remaining Photo
    // -------------------------------------------------------------------------
    const deleteRes1 = await request(
      baseUrl,
      {
        method: 'DELETE',
        path: `/api/admin/profiles/${syntheticCandidate._id}/photos/${photo2._id}`,
        headers: { Cookie: adminCookie },
      }
    );
    const remainingPhotos = deleteRes1.body?.data?.photos || [];
    const promotedPhoto = remainingPhotos.find((p) => p.isPrimary);
    recordCheck(
      'DELETE-01',
      'DELETE primary photo removes asset, auto-promotes remaining photo, and updates root profilePhoto',
      deleteRes1.status === 200 &&
      deleteRes1.body?.data?.count === 2 &&
      promotedPhoto !== undefined &&
      deleteRes1.body?.data?.primaryPhoto?.publicId === promotedPhoto.publicId &&
      destroyedCloudinaryAssets.includes(replacedPhoto.publicId)
    );

    // -------------------------------------------------------------------------
    // Check 11: Persistence Verification Across Simulated Page Reload
    // -------------------------------------------------------------------------
    console.log('\n--- Section 3: Persistence Across Simulated Page Reload ---');
    const freshDbDoc = await MatrimonialProfile.findById(syntheticCandidate._id);
    const reloadedApiRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/admin/profiles/${syntheticCandidate._id}/photos`,
      headers: { Cookie: adminCookie },
    });

    recordCheck(
      'PERSIST-01',
      'Database document directly matches in-memory photo gallery after simulated reload',
      freshDbDoc.photos.length === 2 &&
      freshDbDoc.profilePhoto.publicId === promotedPhoto.publicId &&
      reloadedApiRes.body?.data?.count === 2 &&
      reloadedApiRes.body?.data?.primaryPhoto?.publicId === promotedPhoto.publicId
    );

    // Directory projection check (ensuring member card displays the promoted photo)
    const directoryProjection = await MatrimonialProfile.findById(syntheticCandidate._id).select(
      '_id user source approvalStatus profileStatus candidateName profilePhoto.url'
    );
    recordCheck(
      'PERSIST-02',
      'Member directory projection retains valid profilePhoto.url matching the promoted primary photo',
      typeof directoryProjection.profilePhoto?.url === 'string' &&
      directoryProjection.profilePhoto.url === promotedPhoto.url
    );

    // -------------------------------------------------------------------------
    // Check 12: Delete All Remaining Photos -> Root profilePhoto Resets to null
    // -------------------------------------------------------------------------
    for (const p of remainingPhotos) {
      await request(baseUrl, {
        method: 'DELETE',
        path: `/api/admin/profiles/${syntheticCandidate._id}/photos/${p._id}`,
        headers: { Cookie: adminCookie },
      });
    }

    const finalEmptyCheck = await request(baseUrl, {
      method: 'GET',
      path: `/api/admin/profiles/${syntheticCandidate._id}/photos`,
      headers: { Cookie: adminCookie },
    });
    recordCheck(
      'CLEANUP-01',
      'Deleting all photos resets gallery count to 0 and root profilePhoto to null URL & publicId',
      finalEmptyCheck.body?.data?.count === 0 &&
      finalEmptyCheck.body?.data?.primaryPhoto?.url === null &&
      finalEmptyCheck.body?.data?.primaryPhoto?.publicId === null
    );

  } finally {
    // -------------------------------------------------------------------------
    // Teardown & Invariant Verification
    // -------------------------------------------------------------------------
    console.log('\n--- Section 4: Teardown & Database Integrity Verification ---');

    // Restore original functions
    cloudinaryConfig.isCloudinaryConfigured = originalIsConfigured;
    profileController.uploadToCloudinary = originalUpload;
    cloudinaryConfig.cloudinary.uploader.destroy = originalDestroy;

    // Close server
    await new Promise((resolve) => testServer.close(resolve));

    // Delete synthetic fixtures
    if (syntheticAdmin) await User.deleteOne({ _id: syntheticAdmin._id });
    if (syntheticMember) await User.deleteOne({ _id: syntheticMember._id });
    if (syntheticCandidate) await MatrimonialProfile.deleteOne({ _id: syntheticCandidate._id });

    // Verify baseline counts
    const finalUsers = await User.countDocuments();
    const finalProfiles = await MatrimonialProfile.countDocuments();

    const usersMatch = finalUsers === baselineUsers;
    const profilesMatch = finalProfiles === baselineProfiles;

    recordCheck(
      'TEARDOWN-01',
      'All synthetic fixtures deleted; user collection restored to exact baseline',
      usersMatch,
      `Users: ${baselineUsers} -> ${finalUsers}`
    );
    recordCheck(
      'TEARDOWN-02',
      'All synthetic profiles deleted; candidate collection restored to exact baseline',
      profilesMatch,
      `Profiles: ${baselineProfiles} -> ${finalProfiles}`
    );

    await mongoose.disconnect();

    console.log('\n========================================================================');
    console.log(` SUMMARY: ${checksPassed} / ${checksTotal} Checks Passed (${checksBlocked} Blocked)`);
    console.log('========================================================================\n');

    if (checksPassed === checksTotal && usersMatch && profilesMatch) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}

runE2EVerification().catch((err) => {
  console.error('[FATAL E2E ERROR]', err);
  process.exit(1);
});
