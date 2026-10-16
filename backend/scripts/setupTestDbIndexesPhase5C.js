/**
 * Setup Required Indexes on Isolated Test Database (Phase 5C)
 * 
 * Safety Invariants:
 * 1. autoIndex: false is strictly enforced.
 * 2. Connects ONLY to the test database 'matrimony_phase5c_test'.
 * 3. Asserts mongoose.connection.name === 'matrimony_phase5c_test' before ANY index operation.
 * 4. Reuses applyAndVerifyPhase5AIndexes and applyAndVerifyPhase5CIndexes without running migrations on prod.
 * 5. Requires --apply and --confirm-test-database to execute.
 * 
 * Usage:
 *   Dry-run (safe):
 *     node scripts/setupTestDbIndexesPhase5C.js
 * 
 *   Apply indexes:
 *     node scripts/setupTestDbIndexesPhase5C.js --apply --confirm-test-database
 */

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Prefer test env file if DOTENV_CONFIG_PATH is not explicitly set
const envTestPath = process.env.DOTENV_CONFIG_PATH
  ? path.resolve(process.env.DOTENV_CONFIG_PATH)
  : path.join(__dirname, '../.env.test');

dotenv.config({ path: envTestPath });

const EXPECTED_TEST_DB = 'matrimony_phase5c_test';

const { applyAndVerifyPhase5AIndexes } = require('./migrateSubscriptionsPhase5A');
const { applyAndVerifyPhase5CIndexes } = require('./migrateCreditsPhase5C');

const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const WebhookEvent = require('../models/WebhookEvent');
const CreditCycle = require('../models/CreditCycle');
const ContactUnlock = require('../models/ContactUnlock');
const User = require('../models/User');
const MatrimonialProfile = require('../models/MatrimonialProfile');

async function setupTestDbIndexes() {
  const isApply = process.argv.includes('--apply');
  const isConfirmed = process.argv.includes('--confirm-test-database');

  console.log('========================================================================');
  console.log(' Setup Indexes on Isolated Test Database (matrimony_phase5c_test)');
  console.log('========================================================================');
  console.log(`Execution Mode: ${isApply ? 'APPLY' : 'DRY-RUN (Safe, no database changes)'}`);

  if (isApply && !isConfirmed) {
    console.error('\n[Error] Applying indexes requires --confirm-test-database flag.');
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

    // Strict safety assertion
    const connectedDb = conn.connection.name;
    if (connectedDb !== EXPECTED_TEST_DB) {
      console.error(`\n[CRITICAL ABORT] Connected to '${connectedDb}'. Expected '${EXPECTED_TEST_DB}'.`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`[Verified] Connected securely to test database: ${connectedDb}`);

    if (!isApply) {
      console.log('\n[Dry Run Completed] Database verified. Run with --apply --confirm-test-database to apply indexes.');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log('\nApplying Phase 5A indexes...');
    await applyAndVerifyPhase5AIndexes({
      subCollection: Subscription.collection,
      payCollection: Payment.collection,
      webhookCollection: WebhookEvent.collection,
    });
    console.log('✓ Phase 5A indexes created and verified.');

    console.log('\nApplying Phase 5C indexes...');
    await applyAndVerifyPhase5CIndexes({
      creditCycleCollection: CreditCycle.collection,
      contactUnlockCollection: ContactUnlock.collection,
    });
    console.log('✓ Phase 5C indexes created and verified.');

    console.log('\nApplying baseline User and MatrimonialProfile indexes...');
    await User.collection.createIndex({ email: 1 }, { unique: true, name: 'email_1' });
    await MatrimonialProfile.collection.createIndex(
      { user: 1 },
      {
        unique: true,
        partialFilterExpression: { user: { $type: 'objectId' } },
        name: 'user_1_partial_objectId',
      }
    );
    await MatrimonialProfile.collection.createIndex({ source: 1 }, { name: 'source_1' });
    await MatrimonialProfile.collection.createIndex({ approvalStatus: 1 }, { name: 'approvalStatus_1' });
    await MatrimonialProfile.collection.createIndex({ profileStatus: 1 }, { name: 'profileStatus_1' });
    console.log('✓ Baseline User and Profile indexes verified.');

    console.log('\n[Success] All required indexes successfully set up on matrimony_phase5c_test.\n');
    await mongoose.disconnect();
  } catch (err) {
    console.error(`\n[Index Setup Error] ${err.message}`);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
}

if (require.main === module) {
  setupTestDbIndexes();
}

module.exports = { setupTestDbIndexes, EXPECTED_TEST_DB };
