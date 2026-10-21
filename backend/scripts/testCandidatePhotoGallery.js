/**
 * Isolated Integration Test Suite: Candidate Photo Gallery & Concurrency Safety
 * Database: matrimony_phase5c_test
 * Port: Ephemeral HTTP server
 */

const http = require('http');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// 1. Load test environment
const envTestPath = path.join(__dirname, '../.env.test');
dotenv.config({ path: envTestPath });

const EXPECTED_TEST_DB = 'matrimony_phase5c_test';

const User = require('../models/User');
const MatrimonialProfile = require('../models/MatrimonialProfile');
const app = require('../app');
const cloudinaryConfig = require('../config/cloudinary');
const profileController = require('../controllers/profileController');

// Sample valid JPEG buffer with valid magic bytes (FF D8 FF E0 ...)
const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
]);

/**
 * Builds a multipart/form-data payload for photo upload
 */
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

/**
 * Helper to make HTTP requests to test server
 */
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

async function runTestSuite() {
  console.log('========================================================================');
  console.log(' Candidate Photo Gallery & Concurrency Safety Integration Tests');
  console.log('========================================================================\n');

  // Connect to DB with fallback to local mongod if Atlas IP whitelist blocks outbound connection
  let mongoUri = process.env.MONGODB_URI;
  let conn;

  try {
    console.log('[Connecting] Attempting connection via test MONGODB_URI...');
    conn = await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 4000 });
  } catch (atlasErr) {
    console.warn(`[Notice] Cloud Atlas unreachable (${atlasErr.message.slice(0, 80)}...).`);
    console.log('[Connecting] Falling back to local isolated test MongoDB (127.0.0.1:27017)...');
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
  const baselineUsersCount = await User.countDocuments();
  const baselineProfilesCount = await MatrimonialProfile.countDocuments();
  console.log(`✓ Baseline DB records: ${baselineUsersCount} users, ${baselineProfilesCount} profiles\n`);

  // Start in-process test server
  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  const serverPort = testServer.address().port;
  const baseUrl = `http://127.0.0.1:${serverPort}`;
  console.log(`✓ Isolated test server listening on ${baseUrl}\n`);

  let testCount = 0;
  let passedCount = 0;

  function report(name, passed, detail = '') {
    testCount++;
    if (passed) {
      passedCount++;
      console.log(`  [PASS] Test ${testCount}: ${name} ${detail ? `(${detail})` : ''}`);
    } else {
      console.error(`  [FAIL] Test ${testCount}: ${name} FAILED! ${detail}`);
    }
  }

  const destroyedCloudinaryIds = [];
  let uploadCounter = 0;

  // Save original functions to restore later
  const originalIsConfigured = cloudinaryConfig.isCloudinaryConfigured;
  const originalUpload = profileController.uploadToCloudinary;
  const originalDestroy = cloudinaryConfig.cloudinary.uploader.destroy;

  // Mock Cloudinary behaviors
  let mockCloudinaryConfigured = true;
  cloudinaryConfig.isCloudinaryConfigured = () => mockCloudinaryConfigured;

  profileController.uploadToCloudinary = async (buffer) => {
    uploadCounter++;
    return {
      secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v1/candidate_photo_${uploadCounter}.jpg`,
      public_id: `matrimony/profiles/photo_${uploadCounter}`,
    };
  };

  cloudinaryConfig.cloudinary.uploader.destroy = async (publicId) => {
    destroyedCloudinaryIds.push(publicId);
    return { result: 'ok' };
  };

  let syntheticAdmin = null;
  let syntheticMember = null;
  let syntheticProfile = null;
  let adminCookie = '';
  let memberCookie = '';

  try {
    // -------------------------------------------------------------
    // Setup Test Fixtures
    // -------------------------------------------------------------
    const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_phase5c';

    syntheticAdmin = await User.create({
      name: 'Synthetic Photo Admin',
      email: 'test.photo.admin@example.com',
      passwordHash: 'dummy_hash',
      role: 'admin',
      accountStatus: 'active',
    });

    syntheticMember = await User.create({
      name: 'Synthetic Photo Member',
      email: 'test.photo.member@example.com',
      passwordHash: 'dummy_hash',
      role: 'user',
      accountStatus: 'active',
    });

    syntheticProfile = await MatrimonialProfile.create({
      user: null,
      source: 'broker',
      approvalStatus: 'pending_approval',
      candidateName: 'Synthetic Candidate For Photo Testing',
      candidatePhone: '9876543210',
      candidateEmail: 'candidate.photo.test@example.com',
    });

    const adminToken = jwt.sign({ id: syntheticAdmin._id, role: 'admin' }, jwtSecret, { expiresIn: '1h' });
    const memberToken = jwt.sign({ id: syntheticMember._id, role: 'user' }, jwtSecret, { expiresIn: '1h' });
    adminCookie = `token=${adminToken}`;
    memberCookie = `token=${memberToken}`;

    console.log('--- Suite 1: Schema Validation & Backward Compatibility ---');

    // Test 1: Max 3 photos validator in Mongoose Schema
    let schemaValidationThrew = false;
    try {
      const invalidProfile = new MatrimonialProfile({
        source: 'broker',
        candidateName: 'Over Limit Candidate',
        photos: [
          { url: 'https://pic1.jpg', publicId: 'p1' },
          { url: 'https://pic2.jpg', publicId: 'p2' },
          { url: 'https://pic3.jpg', publicId: 'p3' },
          { url: 'https://pic4.jpg', publicId: 'p4' },
        ],
      });
      await invalidProfile.validate();
    } catch (err) {
      schemaValidationThrew = err.errors && err.errors.photos !== undefined;
    }
    report('Schema validator rejects array with 4 photos', schemaValidationThrew);

    // Test 2: syncPrimaryPhoto helper on document save
    syntheticProfile.photos = [
      { url: 'https://photoA.jpg', publicId: 'pA', isPrimary: false },
      { url: 'https://photoB.jpg', publicId: 'pB', isPrimary: true },
    ];
    await syntheticProfile.save();
    report(
      'Document save synchronizes root profilePhoto with marked isPrimary photo',
      syntheticProfile.profilePhoto.url === 'https://photoB.jpg' &&
      syntheticProfile.profilePhoto.publicId === 'pB'
    );

    // Reset profile photos for API tests
    syntheticProfile.photos = [];
    syntheticProfile.profilePhoto = { url: null, publicId: null };
    await syntheticProfile.save();

    console.log('\n--- Suite 2: Authentication & Authorization Security ---');

    // Test 3: Unauthenticated GET /photos -> 401
    const unauthGet = await request(baseUrl, {
      method: 'GET',
      path: `/api/admin/profiles/${syntheticProfile._id}/photos`,
    });
    report('Unauthenticated GET returns HTTP 401', unauthGet.status === 401);

    // Test 4: Member role GET /photos -> 403
    const memberGet = await request(baseUrl, {
      method: 'GET',
      path: `/api/admin/profiles/${syntheticProfile._id}/photos`,
      headers: { Cookie: memberCookie },
    });
    report('Member role GET returns HTTP 403 Forbidden', memberGet.status === 403);

    // Test 5: Unauthenticated POST /photos -> 401
    const unauthPost = await request(baseUrl, {
      method: 'POST',
      path: `/api/admin/profiles/${syntheticProfile._id}/photos`,
    });
    report('Unauthenticated POST returns HTTP 401', unauthPost.status === 401);

    // Test 6: Member role POST /photos -> 403
    const memberPost = await request(baseUrl, {
      method: 'POST',
      path: `/api/admin/profiles/${syntheticProfile._id}/photos`,
      headers: { Cookie: memberCookie },
    });
    report('Member role POST returns HTTP 403 Forbidden', memberPost.status === 403);

    console.log('\n--- Suite 3: Cloudinary Unconfigured Guard ---');

    // Test 7: Cloudinary unconfigured returns 503
    mockCloudinaryConfigured = false;
    const mpPayload7 = buildMultipartPayload('photo', 'test.jpg', VALID_JPEG_BUFFER);
    const unconfigRes = await request(
      baseUrl,
      {
        method: 'POST',
        path: `/api/admin/profiles/${syntheticProfile._id}/photos`,
        headers: { Cookie: adminCookie, 'Content-Type': mpPayload7.contentType },
      },
      mpPayload7.body
    );
    report('Unconfigured Cloudinary returns HTTP 503 Service Unavailable', unconfigRes.status === 503);
    mockCloudinaryConfigured = true;

    console.log('\n--- Suite 4: Photo Lifecycle (Add, Promote, Replace, Delete) ---');

    // Test 8: Upload Photo 1 (First photo becomes primary automatically)
    const mpPayload1 = buildMultipartPayload('photo', 'photo1.jpg', VALID_JPEG_BUFFER);
    const uploadRes1 = await request(
      baseUrl,
      {
        method: 'POST',
        path: `/api/admin/profiles/${syntheticProfile._id}/photos`,
        headers: { Cookie: adminCookie, 'Content-Type': mpPayload1.contentType },
      },
      mpPayload1.body
    );
    const photo1Doc = uploadRes1.body?.data?.photos?.[0];
    report(
      'Photo 1 upload returns HTTP 201 and automatically becomes primary',
      uploadRes1.status === 201 &&
      uploadRes1.body?.data?.count === 1 &&
      photo1Doc?.isPrimary === true &&
      uploadRes1.body?.data?.primaryPhoto?.url === photo1Doc?.url
    );

    // Test 9: Upload Photo 2 (Second photo does NOT overwrite primary)
    const mpPayload2 = buildMultipartPayload('photo', 'photo2.jpg', VALID_JPEG_BUFFER);
    const uploadRes2 = await request(
      baseUrl,
      {
        method: 'POST',
        path: `/api/admin/profiles/${syntheticProfile._id}/photos`,
        headers: { Cookie: adminCookie, 'Content-Type': mpPayload2.contentType },
      },
      mpPayload2.body
    );
    const photo2Doc = uploadRes2.body?.data?.photos?.[1];
    report(
      'Photo 2 upload returns HTTP 201, isPrimary=false, and primaryPhoto remains Photo 1',
      uploadRes2.status === 201 &&
      uploadRes2.body?.data?.count === 2 &&
      photo2Doc?.isPrimary === false &&
      uploadRes2.body?.data?.primaryPhoto?.publicId === photo1Doc?.publicId
    );

    // Test 10: Upload Photo 3 (Reaches max allowed limit of 3)
    const mpPayload3 = buildMultipartPayload('photo', 'photo3.jpg', VALID_JPEG_BUFFER);
    const uploadRes3 = await request(
      baseUrl,
      {
        method: 'POST',
        path: `/api/admin/profiles/${syntheticProfile._id}/photos`,
        headers: { Cookie: adminCookie, 'Content-Type': mpPayload3.contentType },
      },
      mpPayload3.body
    );
    const photo3Doc = uploadRes3.body?.data?.photos?.[2];
    report(
      'Photo 3 upload returns HTTP 201 and profile has exactly 3 photos',
      uploadRes3.status === 201 &&
      uploadRes3.body?.data?.count === 3 &&
      photo3Doc !== undefined
    );

    // Test 11: Attempt to upload Photo 4 (Ceiling enforced by backend)
    const mpPayload4 = buildMultipartPayload('photo', 'photo4.jpg', VALID_JPEG_BUFFER);
    const uploadRes4 = await request(
      baseUrl,
      {
        method: 'POST',
        path: `/api/admin/profiles/${syntheticProfile._id}/photos`,
        headers: { Cookie: adminCookie, 'Content-Type': mpPayload4.contentType },
      },
      mpPayload4.body
    );
    report(
      'Attempting 4th photo returns HTTP 400 with capacity warning',
      uploadRes4.status === 400 &&
      uploadRes4.body?.message?.includes('maximum allowed of 3 photos')
    );

    // Test 12: Set Primary to Photo 2 via PATCH
    const setPrimRes = await request(
      baseUrl,
      {
        method: 'PATCH',
        path: `/api/admin/profiles/${syntheticProfile._id}/photos/${photo2Doc._id}/primary`,
        headers: { Cookie: adminCookie },
      }
    );
    report(
      'Set primary photo returns HTTP 200 and points primaryPhoto to Photo 2',
      setPrimRes.status === 200 &&
      setPrimRes.body?.data?.primaryPhoto?.publicId === photo2Doc.publicId
    );

    // Test 13: Replace Photo 2 (which is currently primary)
    const initialDestroyCount = destroyedCloudinaryIds.length;
    const mpPayloadRep = buildMultipartPayload('photo', 'photo2_replacement.jpg', VALID_JPEG_BUFFER);
    const replaceRes = await request(
      baseUrl,
      {
        method: 'PUT',
        path: `/api/admin/profiles/${syntheticProfile._id}/photos/${photo2Doc._id}`,
        headers: { Cookie: adminCookie, 'Content-Type': mpPayloadRep.contentType },
      },
      mpPayloadRep.body
    );
    const replacedPhoto = replaceRes.body?.data?.photos?.find((p) => p._id === photo2Doc._id);
    report(
      'Replace photo updates URL/publicId, updates primaryPhoto, and destroys old Cloudinary asset',
      replaceRes.status === 200 &&
      replacedPhoto.publicId !== photo2Doc.publicId &&
      replaceRes.body?.data?.primaryPhoto?.publicId === replacedPhoto.publicId &&
      destroyedCloudinaryIds.includes(photo2Doc.publicId)
    );

    // Test 14: Delete Primary Photo (Photo 2) and verify automatic promotion
    const preDeletePhotos = replaceRes.body.data.photos;
    const deletedPhotoId = photo2Doc._id;
    const expectedPromotedPhoto = preDeletePhotos.find((p) => p._id !== deletedPhotoId);

    const deleteRes1 = await request(
      baseUrl,
      {
        method: 'DELETE',
        path: `/api/admin/profiles/${syntheticProfile._id}/photos/${deletedPhotoId}`,
        headers: { Cookie: adminCookie },
      }
    );
    report(
      'Deleting primary photo promotes another remaining photo to primary and cleans up Cloudinary',
      deleteRes1.status === 200 &&
      deleteRes1.body?.data?.count === 2 &&
      deleteRes1.body?.data?.primaryPhoto?.publicId === expectedPromotedPhoto.publicId &&
      destroyedCloudinaryIds.includes(replacedPhoto.publicId)
    );

    // Test 15: Delete remaining photos until 0 and verify root profilePhoto resets to null
    const remaining1 = deleteRes1.body.data.photos[0];
    const remaining2 = deleteRes1.body.data.photos[1];

    await request(baseUrl, {
      method: 'DELETE',
      path: `/api/admin/profiles/${syntheticProfile._id}/photos/${remaining1._id}`,
      headers: { Cookie: adminCookie },
    });
    const finalDeleteRes = await request(baseUrl, {
      method: 'DELETE',
      path: `/api/admin/profiles/${syntheticProfile._id}/photos/${remaining2._id}`,
      headers: { Cookie: adminCookie },
    });

    report(
      'Deleting all photos resets root profilePhoto to null URL and publicId',
      finalDeleteRes.status === 200 &&
      finalDeleteRes.body?.data?.count === 0 &&
      finalDeleteRes.body?.data?.primaryPhoto?.url === null &&
      finalDeleteRes.body?.data?.primaryPhoto?.publicId === null
    );

    console.log('\n--- Suite 5: Concurrency Safety Under Simultaneous Uploads ---');

    // Populate profile with 2 photos so only 1 slot remains
    const mp1 = buildMultipartPayload('photo', 'slot1.jpg', VALID_JPEG_BUFFER);
    const mp2 = buildMultipartPayload('photo', 'slot2.jpg', VALID_JPEG_BUFFER);
    await request(
      baseUrl,
      {
        method: 'POST',
        path: `/api/admin/profiles/${syntheticProfile._id}/photos`,
        headers: { Cookie: adminCookie, 'Content-Type': mp1.contentType },
      },
      mp1.body
    );
    await request(
      baseUrl,
      {
        method: 'POST',
        path: `/api/admin/profiles/${syntheticProfile._id}/photos`,
        headers: { Cookie: adminCookie, 'Content-Type': mp2.contentType },
      },
      mp2.body
    );

    // Verify current count is 2
    const currentProfileCheck = await MatrimonialProfile.findById(syntheticProfile._id);
    if (currentProfileCheck.photos.length !== 2) {
      throw new Error(`Expected 2 photos before concurrency test, got ${currentProfileCheck.photos.length}`);
    }

    // Fire TWO simultaneous upload requests competing for the 3rd and final slot
    const mpRaceA = buildMultipartPayload('photo', 'raceA.jpg', VALID_JPEG_BUFFER);
    const mpRaceB = buildMultipartPayload('photo', 'raceB.jpg', VALID_JPEG_BUFFER);

    const [resRaceA, resRaceB] = await Promise.all([
      request(
        baseUrl,
        {
          method: 'POST',
          path: `/api/admin/profiles/${syntheticProfile._id}/photos`,
          headers: { Cookie: adminCookie, 'Content-Type': mpRaceA.contentType },
        },
        mpRaceA.body
      ),
      request(
        baseUrl,
        {
          method: 'POST',
          path: `/api/admin/profiles/${syntheticProfile._id}/photos`,
          headers: { Cookie: adminCookie, 'Content-Type': mpRaceB.contentType },
        },
        mpRaceB.body
      ),
    ]);

    const statuses = [resRaceA.status, resRaceB.status].sort();
    const exactlyOneSucceeded = statuses[0] === 201 && statuses[1] === 400;

    const postRaceProfile = await MatrimonialProfile.findById(syntheticProfile._id);
    report(
      'Simultaneous upload requests: exactly 1 succeeds (201) and 1 is rejected (400)',
      exactlyOneSucceeded
    );
    report(
      'Database strictly contains exactly 3 photos after concurrent attempts (never 4)',
      postRaceProfile.photos.length === 3
    );

    console.log('\n--- Suite 6: Directory Projection & Backward Compatibility ---');

    // Test 18: Query directory projection format (memberController projection)
    const rawDoc = await MatrimonialProfile.findById(syntheticProfile._id).select(
      '_id user source approvalStatus profileStatus candidateName profilePhoto.url createdAt'
    );
    report(
      'Direct member directory projection retrieves profilePhoto.url seamlessly',
      typeof rawDoc.profilePhoto?.url === 'string' && rawDoc.profilePhoto.url.length > 0
    );

  } finally {
    // -------------------------------------------------------------
    // Teardown & Integrity Audit
    // -------------------------------------------------------------
    console.log('\n--- Teardown & Database Integrity Verification ---');

    // Restore original functions
    cloudinaryConfig.isCloudinaryConfigured = originalIsConfigured;
    profileController.uploadToCloudinary = originalUpload;
    cloudinaryConfig.cloudinary.uploader.destroy = originalDestroy;

    // Close test server
    await new Promise((resolve) => testServer.close(resolve));

    // Delete synthetic fixtures
    if (syntheticAdmin) await User.deleteOne({ _id: syntheticAdmin._id });
    if (syntheticMember) await User.deleteOne({ _id: syntheticMember._id });
    if (syntheticProfile) await MatrimonialProfile.deleteOne({ _id: syntheticProfile._id });

    // Verify baseline counts
    const finalUsersCount = await User.countDocuments();
    const finalProfilesCount = await MatrimonialProfile.countDocuments();

    const usersRestored = finalUsersCount === baselineUsersCount;
    const profilesRestored = finalProfilesCount === baselineProfilesCount;

    console.log(`  Users baseline: ${baselineUsersCount} -> Final: ${finalUsersCount} (Matched: ${usersRestored})`);
    console.log(`  Profiles baseline: ${baselineProfilesCount} -> Final: ${finalProfilesCount} (Matched: ${profilesRestored})`);

    await mongoose.disconnect();

    console.log('\n========================================================================');
    console.log(` RESULTS: ${passedCount} / ${testCount} Passed (${testCount - passedCount} Failed)`);
    console.log('========================================================================\n');

    if (passedCount === testCount && usersRestored && profilesRestored) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}

runTestSuite().catch((err) => {
  console.error('[FATAL TEST SUITE ERROR]', err);
  process.exit(1);
});
