/**
 * Database Index Migration Script for Phase 5C: CreditCycles & ContactUnlocks
 *
 * Safety Rules:
 * 1. autoIndex is disabled globally in this project (`autoIndex: false`).
 * 2. Runs in DRY-RUN mode by default.
 * 3. Requires explicit `--apply` and `--confirm-backup-verified` flags to create indexes on a live database.
 * 4. Verifies every index after creation and exits with non-zero status if any index is missing or misconfigured.
 *
 * Execution Order Note:
 * Apply Phase 5A indexes (`scripts/migrateSubscriptionsPhase5A.js`) before or alongside Phase 5C indexes
 * (`scripts/migrateCreditsPhase5C.js`) prior to enabling production subscription/credit traffic.
 *
 * Usage:
 *   Dry-run (default, read-only):
 *     node scripts/migrateCreditsPhase5C.js
 *
 *   Apply indexes (requires explicit confirmation):
 *     node scripts/migrateCreditsPhase5C.js --apply --confirm-backup-verified
 */

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../.env') });

const CreditCycle = require('../models/CreditCycle');
const ContactUnlock = require('../models/ContactUnlock');

const REQUIRED_CREDIT_CYCLE_INDEXES = [
  {
    spec: { subscription: 1, cycleNumber: 1 },
    options: {
      name: 'subscription_1_cycleNumber_1_unique',
      unique: true,
    },
  },
  {
    spec: { user: 1, subscription: 1 },
    options: {
      name: 'user_1_subscription_1',
    },
  },
];

const REQUIRED_CONTACT_UNLOCK_INDEXES = [
  {
    spec: { viewerUser: 1, targetProfile: 1 },
    options: {
      name: 'viewerUser_1_targetProfile_1_unique',
      unique: true,
    },
  },
  {
    spec: { viewerUser: 1 },
    options: {
      name: 'viewerUser_1',
    },
  },
  {
    spec: { targetProfile: 1 },
    options: {
      name: 'targetProfile_1',
    },
  },
];

/**
 * Verifies whether a target index definition is present in a collection's index list.
 */
function verifyIndexPresent(existingIndexes, target) {
  const found = existingIndexes.find((idx) => {
    const keysMatch =
      idx.key &&
      Object.keys(target.spec).length === Object.keys(idx.key).length &&
      Object.keys(target.spec).every((k) => idx.key[k] === target.spec[k]);

    if (!keysMatch) return false;
    if (Boolean(target.options.unique) !== Boolean(idx.unique)) return false;

    return true;
  });

  return Boolean(found);
}

/**
 * Applies and verifies all required Phase 5C indexes on the provided collections.
 * Exported for isolated unit testing with mock collections.
 */
async function applyAndVerifyPhase5CIndexes({
  creditCycleCollection,
  contactUnlockCollection,
}) {
  // 1. Create CreditCycle indexes
  for (const idx of REQUIRED_CREDIT_CYCLE_INDEXES) {
    await creditCycleCollection.createIndex(idx.spec, idx.options);
  }

  // 2. Create ContactUnlock indexes
  for (const idx of REQUIRED_CONTACT_UNLOCK_INDEXES) {
    await contactUnlockCollection.createIndex(idx.spec, idx.options);
  }

  // 3. Verify post-creation index state
  const existingCycleIndexes = await creditCycleCollection.indexes();
  for (const idx of REQUIRED_CREDIT_CYCLE_INDEXES) {
    if (!verifyIndexPresent(existingCycleIndexes, idx)) {
      throw new Error(
        `Post-migration verification failed: CreditCycle index '${idx.options.name}' is missing or misconfigured.`
      );
    }
  }

  const existingUnlockIndexes = await contactUnlockCollection.indexes();
  for (const idx of REQUIRED_CONTACT_UNLOCK_INDEXES) {
    if (!verifyIndexPresent(existingUnlockIndexes, idx)) {
      throw new Error(
        `Post-migration verification failed: ContactUnlock index '${idx.options.name}' is missing or misconfigured.`
      );
    }
  }

  return {
    creditCyclesVerified: REQUIRED_CREDIT_CYCLE_INDEXES.length,
    contactUnlocksVerified: REQUIRED_CONTACT_UNLOCK_INDEXES.length,
  };
}

async function runMigration() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isConfirmed = args.includes('--confirm-backup-verified');

  console.log('=== Phase 5C Database Index Migration (CreditCycle & ContactUnlock) ===');
  console.log(`Mode: ${isApply ? 'APPLY' : 'DRY-RUN (Default)'}\n`);

  if (isApply && !isConfirmed) {
    console.error(
      '[Abort] Both --apply and --confirm-backup-verified flags are required to apply index changes.'
    );
    process.exit(1);
  }

  if (!process.env.MONGODB_URI) {
    console.error('[Error] MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
    console.log('[Connected] Successfully connected to MongoDB.\n');

    if (!isApply) {
      console.log('--- Planned CreditCycle Indexes ---');
      REQUIRED_CREDIT_CYCLE_INDEXES.forEach((idx) => {
        console.log(
          `  • ${idx.options.name}: ${JSON.stringify(idx.spec)} (unique=${Boolean(
            idx.options.unique
          )})`
        );
      });

      console.log('\n--- Planned ContactUnlock Indexes ---');
      REQUIRED_CONTACT_UNLOCK_INDEXES.forEach((idx) => {
        console.log(
          `  • ${idx.options.name}: ${JSON.stringify(idx.spec)} (unique=${Boolean(
            idx.options.unique
          )})`
        );
      });

      console.log(
        '\n[Dry-Run Complete] No changes were made. Pass --apply --confirm-backup-verified to create indexes.'
      );
      await mongoose.disconnect();
      process.exit(0);
    }

    const result = await applyAndVerifyPhase5CIndexes({
      creditCycleCollection: CreditCycle.collection,
      contactUnlockCollection: ContactUnlock.collection,
    });

    console.log('\n[Success] Phase 5C indexes applied and verified:', result);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(`\n[Migration Error] ${error.message}`);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = {
  REQUIRED_CREDIT_CYCLE_INDEXES,
  REQUIRED_CONTACT_UNLOCK_INDEXES,
  verifyIndexPresent,
  applyAndVerifyPhase5CIndexes,
};
