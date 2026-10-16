/**
 * Disposable Fixture Seeder for Phase 5C Manual Integration Testing
 * 
 * Safety Invariants:
 * 1. Connects ONLY to the test database 'matrimony_phase5c_test'.
 * 2. Asserts mongoose.connection.name === 'matrimony_phase5c_test' before ANY write or deletion operation.
 * 3. Requires --apply and --confirm-test-database to execute live modifications.
 * 4. Safe to retry after partial failure: cleanly removes previous partial test records (users,
 *    subscriptions, credit cycles, contact unlocks, candidate profiles) scoped strictly to test emails/phone.
 * 5. Uses exact schema enum values from MatrimonialProfile:
 *    - personalDetails.gender: 'Female'
 *    - personalDetails.maritalStatus: 'Never Married'
 * 6. Stores disposable IDs in Git-ignored backend/.test_phase5c_session.json (never passwords or secrets).
 * 
 * Usage:
 *   Dry-run (safe, read-only):
 *     node scripts/seedPhase5CTestFixtures.js
 * 
 *   Seed fixtures (live modification on test DB):
 *     node scripts/seedPhase5CTestFixtures.js --apply --confirm-test-database
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const envTestPath = process.env.DOTENV_CONFIG_PATH
  ? path.resolve(process.env.DOTENV_CONFIG_PATH)
  : path.join(__dirname, '../.env.test');

dotenv.config({ path: envTestPath });

const EXPECTED_TEST_DB = 'matrimony_phase5c_test';
const SESSION_FILE_PATH = path.join(__dirname, '../.test_phase5c_session.json');

const User = require('../models/User');
const Subscription = require('../models/Subscription');
const CreditCycle = require('../models/CreditCycle');
const ContactUnlock = require('../models/ContactUnlock');
const MatrimonialProfile = require('../models/MatrimonialProfile');

// Test accounts and fixture definitions
const TEST_EMAILS = [
  'test.viewer.phase5c@example.com',
  'test.unsub.phase5c@example.com',
];

const TEST_PASSWORDS = {
  viewer: 'TestViewerPass123!',
  unsub: 'TestUnsubPass123!',
};

const TEST_CANDIDATES = [
  {
    candidateName: 'Priya Sharma',
    candidatePhone: '+919876543210',
    source: 'direct',
    profileStatus: 'active',
    approvalStatus: 'approved',
    personalDetails: {
      gender: 'Female',
      dateOfBirth: new Date('1997-06-15'), // 29 years old
      maritalStatus: 'Never Married',
      motherTongue: 'Hindi',
      location: 'Mumbai, Maharashtra',
    },
    educationAndProfession: {
      educationalQualification: 'B.Tech Computer Science',
      occupation: 'Software Engineer',
      workLocation: 'Mumbai',
      income: '15-20 LPA',
    },
    familyDetails: {
      familyLocation: 'Mumbai',
    },
  },
  {
    candidateName: 'Anand Kumar',
    candidatePhone: '+919876543211',
    source: 'direct',
    profileStatus: 'active',
    approvalStatus: 'approved',
    personalDetails: {
      gender: 'Male',
      dateOfBirth: new Date('1994-03-20'), // 32 years old
      maritalStatus: 'Never Married',
      motherTongue: 'Tamil',
      location: 'Chennai, Tamil Nadu',
    },
    educationAndProfession: {
      educationalQualification: 'MBA Finance',
      occupation: 'Finance Manager',
      workLocation: 'Chennai',
      income: '18-22 LPA',
    },
    familyDetails: {
      familyLocation: 'Chennai',
    },
  },
  {
    candidateName: 'Divya Balan',
    candidatePhone: '+919876543212',
    source: 'direct',
    profileStatus: 'active',
    approvalStatus: 'approved',
    personalDetails: {
      gender: 'Female',
      dateOfBirth: new Date('2001-08-10'), // 25 years old
      maritalStatus: 'Never Married',
      motherTongue: 'Kannada',
      location: 'Bangalore, Karnataka',
    },
    educationAndProfession: {
      educationalQualification: 'M.S. Data Science',
      occupation: 'Data Scientist',
      workLocation: 'Bangalore',
      income: '20-25 LPA',
    },
    familyDetails: {
      familyLocation: 'Bangalore',
    },
  },
  {
    candidateName: 'Rajesh Varma',
    candidatePhone: '+919876543213',
    source: 'direct',
    profileStatus: 'active',
    approvalStatus: 'approved',
    personalDetails: {
      gender: 'Male',
      dateOfBirth: new Date('1988-11-05'), // 37-38 years old
      maritalStatus: 'Divorced',
      motherTongue: 'Tamil',
      location: 'Madurai, Tamil Nadu',
    },
    educationAndProfession: {
      educationalQualification: 'B.E. Civil Engineering',
      occupation: 'Civil Engineer',
      workLocation: 'Madurai',
      income: '12-15 LPA',
    },
    familyDetails: {
      familyLocation: 'Madurai',
    },
  },
];

const TEST_CANDIDATE_NAMES = TEST_CANDIDATES.map((c) => c.candidateName);
const TEST_CANDIDATE_PHONES = TEST_CANDIDATES.map((c) => c.candidatePhone);
const TEST_PHONE = '+919876543210';

/**
 * Asserts the active Mongoose connection is strictly connected to the test database.
 */
function assertTestDatabase(conn) {
  const currentDb = conn?.connection?.name;
  if (currentDb !== EXPECTED_TEST_DB) {
    throw new Error(
      `CRITICAL SAFETY ABORT: Database is '${currentDb}'. Operations strictly restricted to '${EXPECTED_TEST_DB}'.`
    );
  }
}

async function seedTestFixtures() {
  const isApply = process.argv.includes('--apply');
  const isConfirmed = process.argv.includes('--confirm-test-database');

  console.log('========================================================================');
  console.log(' Seed Test Fixtures on Isolated Database (matrimony_phase5c_test)');
  console.log('========================================================================');
  console.log(`Execution Mode: ${isApply ? 'APPLY' : 'DRY-RUN (Safe, no database changes)'}`);

  if (isApply && !isConfirmed) {
    console.error('\n[Error] Seeding fixtures requires --confirm-test-database flag.');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('\n[Error] MONGODB_URI is not configured in test environment.');
    process.exit(1);
  }

  try {
    mongoose.set('autoIndex', false);
    const conn = await mongoose.connect(mongoUri, { autoIndex: false });

    // 1. Initial strict safety check
    assertTestDatabase(conn);
    console.log(`[Verified] Connected securely to test database: ${conn.connection.name}`);

    // Check for existing partial fixture records from previous runs
    const existingTestUsers = await User.find({ email: { $in: TEST_EMAILS } }).select('_id email');
    const existingUserIds = existingTestUsers.map((u) => u._id);
    const existingSubCount = existingUserIds.length > 0
      ? await Subscription.countDocuments({ user: { $in: existingUserIds } })
      : 0;
    const existingProfileCount = await MatrimonialProfile.countDocuments({ candidatePhone: { $in: TEST_CANDIDATE_PHONES } });

    console.log('\n[Status Check] Existing Phase 5C test records in test database:');
    console.log(`  - Test Users: ${existingTestUsers.length} (${existingTestUsers.map((u) => u.email).join(', ') || 'none'})`);
    console.log(`  - Test Subscriptions: ${existingSubCount}`);
    console.log(`  - Test Profiles: ${existingProfileCount}`);

    if (!isApply) {
      console.log('\n[Dry Run Completed] Target verified. Pass --apply --confirm-test-database to seed records.');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log('\n[Idempotent Cleanup] Removing any prior partial or complete Phase 5C test records...');

    // Re-verify database name before write operations
    assertTestDatabase(conn);

    // 2. Clean up child records linked to test users first
    if (existingUserIds.length > 0) {
      await ContactUnlock.deleteMany({ viewerUser: { $in: existingUserIds } });
      await CreditCycle.deleteMany({ user: { $in: existingUserIds } });
      await Subscription.deleteMany({ user: { $in: existingUserIds } });
      await User.deleteMany({ _id: { $in: existingUserIds } });
      console.log('✓ Cleaned up prior test users, subscriptions, credit cycles, and unlocks.');
    }

    // 3. Clean up prior candidate profiles
    await MatrimonialProfile.deleteMany({
      $or: [
        { candidatePhone: { $in: TEST_CANDIDATE_PHONES } },
        { candidateName: { $in: TEST_CANDIDATE_NAMES }, source: 'direct' },
      ],
    });
    console.log('✓ Cleaned up prior test candidate profiles.');

    console.log('\n[Seeding] Creating fresh test fixture documents...');

    // Re-verify database name before creation
    assertTestDatabase(conn);

    // 4. Hash passwords for test accounts
    const viewerPasswordHash = await bcrypt.hash(TEST_PASSWORDS.viewer, 10);
    const unsubPasswordHash = await bcrypt.hash(TEST_PASSWORDS.unsub, 10);

    // 5. Create Viewer User (active subscriber)
    const viewerUser = await User.create({
      name: 'Test Viewer Member',
      email: 'test.viewer.phase5c@example.com',
      passwordHash: viewerPasswordHash,
      role: 'user',
      accountStatus: 'active',
    });

    // 6. Create Active 3-Month Subscription for Viewer
    const now = new Date();
    const startDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago (active)
    const endDate = new Date(now.getTime() + 85 * 24 * 60 * 60 * 1000); // 85 days in future
    const gracePeriodEndDate = new Date(endDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const subscription = await Subscription.create({
      user: viewerUser._id,
      planCode: 'THREE_MONTHS',
      durationMonths: 3,
      status: 'active',
      startDate,
      endDate,
      gracePeriodEndDate,
    });

    // 7. Create Candidate Profiles covering diverse filter dimensions:
    //    - Genders: Female, Male
    //    - Marital Statuses: Never Married, Divorced
    //    - Locations: Mumbai, Chennai, Bangalore, Madurai
    //    - Education: B.Tech, MBA, M.S. Data Science, B.E.
    //    - Occupation: Software Engineer, Finance Manager, Data Scientist, Civil Engineer
    //    - Age ranges: 25, 29, 32, 38
    const seededProfiles = [];
    for (const cand of TEST_CANDIDATES) {
      const p = await MatrimonialProfile.create(cand);
      seededProfiles.push(p);
    }

    // 8. Create Unsubscribed User (for 403 NO_ACTIVE_SUBSCRIPTION denial tests)
    const unsubUser = await User.create({
      name: 'Test Unsubscribed Member',
      email: 'test.unsub.phase5c@example.com',
      passwordHash: unsubPasswordHash,
      role: 'user',
      accountStatus: 'active',
    });

    // 9. Save non-secret session metadata to Git-ignored file
    const sessionMetadata = {
      testDatabase: EXPECTED_TEST_DB,
      seededAt: new Date().toISOString(),
      viewerUser: {
        id: String(viewerUser._id),
        email: viewerUser.email,
      },
      subscription: {
        id: String(subscription._id),
        planCode: subscription.planCode,
        status: subscription.status,
      },
      candidateProfiles: seededProfiles.map((p) => ({
        id: String(p._id),
        candidateName: p.candidateName,
        gender: p.personalDetails.gender,
        maritalStatus: p.personalDetails.maritalStatus,
        location: p.personalDetails.location,
        occupation: p.educationAndProfession.occupation,
        education: p.educationAndProfession.educationalQualification,
        dob: p.personalDetails.dateOfBirth.toISOString(),
      })),
      unsubUser: {
        id: String(unsubUser._id),
        email: unsubUser.email,
      },
    };

    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(sessionMetadata, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });

    console.log('✓ Seeded Viewer User (active subscriber)');
    console.log('✓ Seeded Subscription (active 3-month window)');
    for (const p of seededProfiles) {
      console.log(`✓ Seeded Candidate Profile (${p.candidateName}, ${p.personalDetails.gender}, ${p.personalDetails.maritalStatus}, ${p.personalDetails.location})`);
    }
    console.log('✓ Seeded Unsubscribed User (for 403 denial tests)');
    console.log(`✓ Session metadata saved to: ${SESSION_FILE_PATH}`);

    console.log('\n[Success] Test fixtures seeded successfully and ready for API tests.\n');
    await mongoose.disconnect();
  } catch (err) {
    console.error(`\n[Fixture Seeding Error] ${err.message}`);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
}

if (require.main === module) {
  seedTestFixtures();
}

module.exports = {
  seedTestFixtures,
  assertTestDatabase,
  EXPECTED_TEST_DB,
  SESSION_FILE_PATH,
  TEST_EMAILS,
  TEST_PASSWORDS,
  TEST_PHONE,
  TEST_CANDIDATES,
  TEST_CANDIDATE_NAMES,
  TEST_CANDIDATE_PHONES,
};
