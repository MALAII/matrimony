/**
 * Database Index Migration Script for Phase 5A: Subscriptions, Payments & WebhookEvents
 * 
 * Safety Rules:
 * 1. autoIndex is disabled globally in this project to prevent uncontrolled schema index changes.
 * 2. This script creates and verifies the required indexes explicitly and safely on MongoDB collections.
 * 3. Supports dry-run by default.
 * 4. Requires --apply and --confirm-backup-verified to execute live modifications.
 * 5. Performs post-apply index verification and exits with nonzero status if any required index is missing or misconfigured.
 * 
 * Usage:
 *   Dry-run (safe):
 *     node scripts/migrateSubscriptionsPhase5A.js
 * 
 *   Apply indexes (requires explicit confirmation):
 *     node scripts/migrateSubscriptionsPhase5A.js --apply --confirm-backup-verified
 */

const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const WebhookEvent = require('../models/WebhookEvent');

const REQUIRED_SUBSCRIPTION_INDEXES = [
  { spec: { user: 1 }, options: { name: 'user_1' } },
  { spec: { status: 1 }, options: { name: 'status_1' } },
  {
    spec: { payment: 1 },
    options: {
      name: 'payment_1_partial_unique',
      unique: true,
      partialFilterExpression: { payment: { $type: 'objectId' } },
    },
  },
];

const REQUIRED_PAYMENT_INDEXES = [
  { spec: { user: 1 }, options: { name: 'user_1' } },
  { spec: { razorpayOrderId: 1 }, options: { name: 'razorpayOrderId_1', unique: true } },
  { spec: { razorpayPaymentId: 1 }, options: { name: 'razorpayPaymentId_1' } },
  { spec: { status: 1 }, options: { name: 'status_1' } },
  { spec: { subscription: 1 }, options: { name: 'subscription_1' } },
];

const REQUIRED_WEBHOOK_EVENT_INDEXES = [
  { spec: { eventId: 1 }, options: { name: 'eventId_1', unique: true } },
  { spec: { eventType: 1 }, options: { name: 'eventType_1' } },
  { spec: { razorpayOrderId: 1 }, options: { name: 'razorpayOrderId_1' } },
  { spec: { status: 1 }, options: { name: 'status_1' } },
];

/**
 * Verifies whether a target index definition is satisfied in a collection's actual index list.
 */
function verifyIndexPresent(existingIndexes, target) {
  const found = existingIndexes.find((idx) => {
    // Match by key spec
    const keysMatch =
      idx.key &&
      Object.keys(target.spec).length === Object.keys(idx.key).length &&
      Object.keys(target.spec).every((k) => idx.key[k] === target.spec[k]);

    if (!keysMatch) return false;

    // Match uniqueness
    if (Boolean(target.options.unique) !== Boolean(idx.unique)) return false;

    // Match partialFilterExpression if required
    if (target.options.partialFilterExpression) {
      if (!idx.partialFilterExpression) return false;
      const targetPfe = JSON.stringify(target.options.partialFilterExpression);
      const actualPfe = JSON.stringify(idx.partialFilterExpression);
      if (targetPfe !== actualPfe) return false;
    }

    return true;
  });

  return Boolean(found);
}

/**
 * Applies and verifies all required indexes on the provided collections.
 * Exported so automated tests can verify index creation and post-creation verification using mock collections.
 */
async function applyAndVerifyPhase5AIndexes({ subCollection, payCollection, webhookCollection }) {
  // 1. Create Subscription indexes
  for (const idx of REQUIRED_SUBSCRIPTION_INDEXES) {
    await subCollection.createIndex(idx.spec, idx.options);
  }

  // 2. Create Payment indexes
  for (const idx of REQUIRED_PAYMENT_INDEXES) {
    await payCollection.createIndex(idx.spec, idx.options);
  }

  // 3. Create WebhookEvent indexes
  for (const idx of REQUIRED_WEBHOOK_EVENT_INDEXES) {
    await webhookCollection.createIndex(idx.spec, idx.options);
  }

  // 4. Post-creation verification
  const subIndexes = await subCollection.indexes();
  const payIndexes = await payCollection.indexes();
  const webhookIndexes = await webhookCollection.indexes();

  for (const idx of REQUIRED_SUBSCRIPTION_INDEXES) {
    if (!verifyIndexPresent(subIndexes, idx)) {
      throw new Error(`Post-migration verification failed: Missing or invalid Subscription index '${idx.options.name}'.`);
    }
  }

  for (const idx of REQUIRED_PAYMENT_INDEXES) {
    if (!verifyIndexPresent(payIndexes, idx)) {
      throw new Error(`Post-migration verification failed: Missing or invalid Payment index '${idx.options.name}'.`);
    }
  }

  for (const idx of REQUIRED_WEBHOOK_EVENT_INDEXES) {
    if (!verifyIndexPresent(webhookIndexes, idx)) {
      throw new Error(`Post-migration verification failed: Missing or invalid WebhookEvent index '${idx.options.name}'.`);
    }
  }

  return {
    subscriptionsVerified: REQUIRED_SUBSCRIPTION_INDEXES.length,
    paymentsVerified: REQUIRED_PAYMENT_INDEXES.length,
    webhookEventsVerified: REQUIRED_WEBHOOK_EVENT_INDEXES.length,
  };
}

async function runMigration() {
  const isApply = process.argv.includes('--apply');
  const isBackupConfirmed = process.argv.includes('--confirm-backup-verified');

  console.log('========================================================================');
  console.log(' Phase 5A: Subscription, Payment & WebhookEvent Index Setup');
  console.log('========================================================================');
  console.log(`Execution Mode: ${isApply ? 'APPLY' : 'DRY-RUN (Safe, no database changes)'}`);

  if (isApply && !isBackupConfirmed) {
    console.error('\n[Error] Applying indexes requires the --confirm-backup-verified flag.');
    console.error('Usage: node scripts/migrateSubscriptionsPhase5A.js --apply --confirm-backup-verified\n');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('\n[Error] MONGODB_URI is not set in environment variables.\n');
    process.exit(1);
  }

  try {
    mongoose.set('autoIndex', false);
    const conn = await mongoose.connect(mongoUri, { autoIndex: false });
    console.log(`[MongoDB] Connected to database: ${conn.connection.name}`);

    const subCollection = Subscription.collection;
    const payCollection = Payment.collection;
    const webhookCollection = WebhookEvent.collection;

    console.log('\n--- Planned Subscription Indexes ---');
    for (const idx of REQUIRED_SUBSCRIPTION_INDEXES) {
      console.log(`- ${idx.options.name}: ${JSON.stringify(idx.spec)} (options: ${JSON.stringify(idx.options)})`);
    }

    console.log('\n--- Planned Payment Indexes ---');
    for (const idx of REQUIRED_PAYMENT_INDEXES) {
      console.log(`- ${idx.options.name}: ${JSON.stringify(idx.spec)} (options: ${JSON.stringify(idx.options)})`);
    }

    console.log('\n--- Planned WebhookEvent Indexes ---');
    for (const idx of REQUIRED_WEBHOOK_EVENT_INDEXES) {
      console.log(`- ${idx.options.name}: ${JSON.stringify(idx.spec)} (options: ${JSON.stringify(idx.options)})`);
    }

    if (!isApply) {
      console.log('\n[Dry Run Completed] No indexes were created. Run with --apply --confirm-backup-verified to apply.');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log('\nApplying and verifying indexes...');
    const summary = await applyAndVerifyPhase5AIndexes({
      subCollection,
      payCollection,
      webhookCollection,
    });

    console.log(`✓ Verified ${summary.subscriptionsVerified} Subscription indexes`);
    console.log(`✓ Verified ${summary.paymentsVerified} Payment indexes`);
    console.log(`✓ Verified ${summary.webhookEventsVerified} WebhookEvent indexes`);

    console.log('\n========================================================================');
    console.log(' Phase 5A Index Setup & Post-Verification Completed Successfully');
    console.log('========================================================================\n');

    await mongoose.disconnect();
  } catch (err) {
    console.error(`\n[Migration Error] ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = {
  REQUIRED_SUBSCRIPTION_INDEXES,
  REQUIRED_PAYMENT_INDEXES,
  REQUIRED_WEBHOOK_EVENT_INDEXES,
  verifyIndexPresent,
  applyAndVerifyPhase5AIndexes,
};
