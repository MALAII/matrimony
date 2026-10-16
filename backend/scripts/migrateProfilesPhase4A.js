/**
 * Phase 4A Migration Script: Matrimonial Profiles Index and Defaults Alignment
 * 
 * PURPOSE:
 * Aligns existing MatrimonialProfile documents and indexes with Phase 4A architecture:
 * 1. Backfills legacy profiles missing source, approvalStatus, or profileStatus fields.
 * 2. Backfills legacy users missing registrationSource or accountStatus fields.
 * 3. Replaces old strict unique index on { user: 1 } with partial unique index:
 *    { user: 1 }, { unique: true, partialFilterExpression: { user: { $type: "objectId" } } }
 *
 * SAFETY GUARDRAILS:
 * - Runs in DRY-RUN mode by default (read-only inspection).
 * - Requires explicit CLI flags `--apply` and `--confirm-backup-verified` to perform any writes.
 * - Performs precondition checks and aborts if duplicate user references exist.
 * - Inspects actual legacy index metadata rather than assuming names or options.
 * - Handles index-transition failures with safe restoration attempts or actionable critical alerts.
 * - Verifies post-migration index configuration and document backfill state.
 * - Exits with nonzero code if any postcondition fails.
 * - Fully idempotent: safe to re-run after partial execution or recovery.
 *
 * NOTE:
 * MongoDB index operations are NOT transactional. In the event of a cluster or network
 * failure during index replacement, this script detects the exact state and provides
 * safe automated recovery or guided manual instructions.
 *
 * USAGE:
 * Dry-run (Inspection only):
 *   node scripts/migrateProfilesPhase4A.js
 *
 * Live execution (Requires manual backup confirmation):
 *   node scripts/migrateProfilesPhase4A.js --apply --confirm-backup-verified
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment configuration
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const mongoose = require('mongoose');
const { connectDB } = require('../config/db');

const TARGET_PARTIAL_INDEX_NAME = 'user_1_partial_objectId';

/**
 * Checks whether an index matches the target partial unique index specification
 */
function isTargetPartialIndex(idx) {
  if (!idx || !idx.key || idx.key.user !== 1 || !idx.unique) return false;
  const pfe = idx.partialFilterExpression;
  if (!pfe || !pfe.user) return false;
  return pfe.user.$type === 'objectId' || pfe.user.$type === 7;
}

/**
 * Checks whether an index is a legacy full unique index on user without partial filter
 */
function isLegacyFullUniqueUserIndex(idx) {
  if (!idx || !idx.key || idx.key.user !== 1 || !idx.unique) return false;
  return !idx.partialFilterExpression;
}

async function runMigration() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isBackupConfirmed = args.includes('--confirm-backup-verified');

  console.log('================================================================');
  console.log(' Phase 4A Matrimonial Profiles Migration Script');
  console.log('================================================================');
  console.log(`Mode: ${isApply ? 'LIVE APPLY' : 'DRY RUN (Read-Only Inspection)'}`);
  console.log(`Backup Confirmed: ${isBackupConfirmed ? 'YES' : 'NO'}`);
  console.log('----------------------------------------------------------------');

  if (isApply && !isBackupConfirmed) {
    console.error('\n[SAFETY ERROR] Execution aborted!');
    console.error('To apply changes to the live database, you must supply BOTH:');
    console.error('  --apply');
    console.error('  --confirm-backup-verified');
    console.error('\nPlease verify your database backup before proceeding.\n');
    process.exit(1);
  }

  let dbConnection = null;

  try {
    // 1. Establish database connection
    console.log('[1/6] Connecting to MongoDB...');
    dbConnection = await connectDB();
    if (!dbConnection || mongoose.connection.readyState !== 1) {
      console.error('[Migration Error] Failed to connect to MongoDB. Check MONGODB_URI.');
      process.exit(1);
    }
    console.log('      Connected successfully to database:', mongoose.connection.name);

    const profilesCollection = mongoose.connection.db.collection('matrimonialprofiles');
    const usersCollection = mongoose.connection.db.collection('users');

    // 2. Precondition verification: Check collections & detect duplicate users
    console.log('\n[2/6] Running pre-condition and data integrity checks...');
    const totalProfiles = await profilesCollection.countDocuments();
    const totalUsers = await usersCollection.countDocuments();
    console.log(`      Found ${totalProfiles} matrimonial profile(s) and ${totalUsers} user(s).`);

    // Detect duplicate user associations among profiles where user != null
    const duplicateUserAgg = await profilesCollection.aggregate([
      { $match: { user: { $ne: null } } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]).toArray();

    if (duplicateUserAgg.length > 0) {
      console.error('\n[INTEGRITY ERROR] Duplicate profile associations detected for user ID(s):');
      duplicateUserAgg.forEach((d) => console.error(`  - User: ${d._id} (${d.count} profiles)`));
      console.error('Migration aborted to prevent data corruption. Resolve duplicates first.\n');
      await mongoose.connection.close();
      process.exit(1);
    }
    console.log('      Data integrity verified: No duplicate user associations found.');

    // 3. Inspect document backfill requirements
    console.log('\n[3/6] Inspecting document backfill requirements...');
    
    // Profiles needing backfill (missing any of the required Phase 4A fields)
    const profilesNeedingBackfill = await profilesCollection.countDocuments({
      $or: [
        { source: { $exists: false } },
        { approvalStatus: { $exists: false } },
        { profileStatus: { $exists: false } },
      ],
    });
    console.log(`      Profiles requiring backfill (source/approvalStatus/profileStatus): ${profilesNeedingBackfill}`);

    // Users needing backfill (missing any of the required Phase 4A fields)
    const usersNeedingBackfill = await usersCollection.countDocuments({
      $or: [
        { registrationSource: { $exists: false } },
        { accountStatus: { $exists: false } },
      ],
    });
    console.log(`      Users requiring backfill (registrationSource/accountStatus): ${usersNeedingBackfill}`);

    // 4. Inspect index configurations dynamically from actual metadata
    console.log('\n[4/6] Inspecting existing indexes on matrimonialprofiles collection...');
    const existingIndexes = await profilesCollection.indexes();
    console.log('      Current indexes:');
    existingIndexes.forEach((idx) => {
      console.log(`        - Name: "${idx.name}", Key: ${JSON.stringify(idx.key)}, Unique: ${!!idx.unique}, Partial: ${JSON.stringify(idx.partialFilterExpression || null)}`);
    });

    const legacyUserIndex = existingIndexes.find(isLegacyFullUniqueUserIndex);
    const existingPartialIndex = existingIndexes.find(isTargetPartialIndex);

    if (legacyUserIndex) {
      console.log(`      Found legacy full unique index: "${legacyUserIndex.name}" (Key: ${JSON.stringify(legacyUserIndex.key)})`);
    } else {
      console.log('      No legacy un-partitioned unique index on "user" detected.');
    }

    if (existingPartialIndex) {
      console.log(`      Found partial unique index: "${existingPartialIndex.name}" (Key: ${JSON.stringify(existingPartialIndex.key)})`);
    } else {
      console.log('      Target partial unique index not yet present.');
    }

    // 5. Execution or Dry-run Summary
    console.log('\n[5/6] Processing migration actions...');

    if (!isApply) {
      console.log('\n================== DRY RUN PLAN ==================');
      console.log('1. Documents to update:');
      console.log(`   - Backfill ${profilesNeedingBackfill} profile(s) with missing Phase 4A defaults (preserving any existing values):`);
      console.log('       source: "direct"');
      console.log('       approvalStatus: "approved"');
      console.log('       profileStatus: "active"');
      console.log(`   - Backfill ${usersNeedingBackfill} user(s) with missing Phase 4A defaults (preserving any existing values):`);
      console.log('       registrationSource: "direct"');
      console.log('       accountStatus: "active"');
      console.log('2. Index adjustments:');
      if (legacyUserIndex) {
        console.log(`   - Drop legacy unique index: "${legacyUserIndex.name}"`);
      } else {
        console.log('   - No legacy unique index needing drop.');
      }
      if (!existingPartialIndex) {
        console.log('   - Create new partial unique index:');
        console.log('       Key: { user: 1 }');
        console.log(`       Options: { unique: true, partialFilterExpression: { user: { $type: "objectId" } }, name: "${TARGET_PARTIAL_INDEX_NAME}" }`);
      } else {
        console.log(`   - Partial unique index already present: "${existingPartialIndex.name}". No creation needed.`);
      }
      console.log('--------------------------------------------------');
      console.log('DRY RUN COMPLETED. No modifications were written to the database.');
      console.log('To apply these changes, verify your backup and execute with:');
      console.log('  node scripts/migrateProfilesPhase4A.js --apply --confirm-backup-verified');
      console.log('==================================================\n');
      await mongoose.connection.close();
      process.exit(0);
    }

    // --- LIVE APPLY EXECUTION ---
    console.log('Applying live updates...');

    // 5a. Backfill profiles (only missing fields, preserving existing values)
    if (profilesNeedingBackfill > 0) {
      const profileUpdateResult = await profilesCollection.updateMany(
        {
          $or: [
            { source: { $exists: false } },
            { approvalStatus: { $exists: false } },
            { profileStatus: { $exists: false } },
          ],
        },
        [
          {
            $set: {
              source: { $ifNull: ['$source', 'direct'] },
              approvalStatus: { $ifNull: ['$approvalStatus', 'approved'] },
              profileStatus: { $ifNull: ['$profileStatus', 'active'] },
            },
          },
        ]
      );
      console.log(`      Updated ${profileUpdateResult.modifiedCount} profile document(s).`);
    } else {
      console.log('      Profiles already up-to-date.');
    }

    // 5b. Backfill users (only missing fields, preserving existing values)
    if (usersNeedingBackfill > 0) {
      const userUpdateResult = await usersCollection.updateMany(
        {
          $or: [
            { registrationSource: { $exists: false } },
            { accountStatus: { $exists: false } },
          ],
        },
        [
          {
            $set: {
              registrationSource: { $ifNull: ['$registrationSource', 'direct'] },
              accountStatus: { $ifNull: ['$accountStatus', 'active'] },
            },
          },
        ]
      );
      console.log(`      Updated ${userUpdateResult.modifiedCount} user document(s).`);
    } else {
      console.log('      Users already up-to-date.');
    }

    // 5c & 5d. Index Transition with failure handling and safe restoration
    let legacyDropped = false;
    let legacyBackupSpec = null;

    if (legacyUserIndex) {
      legacyBackupSpec = {
        name: legacyUserIndex.name,
        key: { ...legacyUserIndex.key },
        unique: !!legacyUserIndex.unique,
      };

      console.log(`      Dropping legacy index "${legacyUserIndex.name}"...`);
      await profilesCollection.dropIndex(legacyUserIndex.name);
      legacyDropped = true;
      console.log(`      Legacy index "${legacyUserIndex.name}" dropped.`);
    }

    if (!existingPartialIndex) {
      console.log(`      Creating partial unique index "${TARGET_PARTIAL_INDEX_NAME}"...`);
      try {
        await profilesCollection.createIndex(
          { user: 1 },
          {
            unique: true,
            partialFilterExpression: { user: { $type: 'objectId' } },
            name: TARGET_PARTIAL_INDEX_NAME,
          }
        );
        console.log(`      Partial unique index "${TARGET_PARTIAL_INDEX_NAME}" created successfully.`);
      } catch (createErr) {
        console.error(`\n[CRITICAL FAILURE] Failed to create partial unique index "${TARGET_PARTIAL_INDEX_NAME}":`, createErr.message);

        // Attempt safe restoration of legacy index if it was dropped during this run
        if (legacyDropped && legacyBackupSpec) {
          console.log(`[RECOVERY] Attempting safe restoration of legacy index "${legacyBackupSpec.name}"...`);
          try {
            // Verify data can support legacy full unique index before restoring (no duplicate nulls or keys)
            const nullCount = await profilesCollection.countDocuments({ user: null });
            if (nullCount > 1) {
              console.error(`[RECOVERY ABORTED] Database contains ${nullCount} profiles with user: null.`);
              console.error('Cannot safely restore full unique index without collision error E11000.');
            } else {
              await profilesCollection.createIndex(legacyBackupSpec.key, {
                unique: legacyBackupSpec.unique,
                name: legacyBackupSpec.name,
              });
              console.log(`[RECOVERY SUCCESSFUL] Legacy index "${legacyBackupSpec.name}" restored successfully.`);
            }
          } catch (restoreErr) {
            console.error(`[RECOVERY ERROR] Automatic restoration of legacy index failed: ${restoreErr.message}`);
          }
        }

        console.error('\n================================================================');
        console.error(' ACTION REQUIRED: INDEX TRANSITION FAILED');
        console.error(' 1. Check current collection indexes: db.matrimonialprofiles.getIndexes()');
        console.error(' 2. Verify why partial index creation failed (e.g. shard timeout or memory limit).');
        console.error(' 3. To retry partial index creation safely, re-run this script:');
        console.error('    node scripts/migrateProfilesPhase4A.js --apply --confirm-backup-verified');
        console.error(' 4. If necessary, restore database from verified backup.');
        console.error('================================================================\n');

        if (mongoose.connection && mongoose.connection.readyState !== 0) {
          await mongoose.connection.close();
        }
        process.exit(1);
      }
    } else {
      console.log(`      Partial unique index "${existingPartialIndex.name}" already in place.`);
    }

    // 6. Comprehensive Post-Migration Verification
    console.log('\n[6/6] Verifying post-migration state and invariants...');

    // 6a. Verify index state
    const postIndexes = await profilesCollection.indexes();
    const verifiedPartial = postIndexes.find(isTargetPartialIndex);
    const remainingLegacy = postIndexes.find(isLegacyFullUniqueUserIndex);

    if (!verifiedPartial) {
      throw new Error(
        'Postcondition failed: Target partial unique index on { user: 1 } was not found after migration.'
      );
    }
    console.log(`      ✓ Target partial unique index verified: "${verifiedPartial.name}"`);

    if (remainingLegacy) {
      throw new Error(
        `Postcondition failed: Legacy full unique index "${remainingLegacy.name}" is still present.`
      );
    }
    console.log('      ✓ Verified legacy full unique index is completely removed.');

    // 6b. Verify document backfill completeness
    const missingProfileFields = await profilesCollection.countDocuments({
      $or: [
        { source: { $exists: false } },
        { approvalStatus: { $exists: false } },
        { profileStatus: { $exists: false } },
      ],
    });
    if (missingProfileFields > 0) {
      throw new Error(
        `Postcondition failed: ${missingProfileFields} profile(s) still missing Phase 4A fields.`
      );
    }
    console.log('      ✓ Verified 0 profiles have missing Phase 4A lifecycle fields.');

    const missingUserFields = await usersCollection.countDocuments({
      $or: [
        { registrationSource: { $exists: false } },
        { accountStatus: { $exists: false } },
      ],
    });
    if (missingUserFields > 0) {
      throw new Error(
        `Postcondition failed: ${missingUserFields} user(s) still missing Phase 4A account fields.`
      );
    }
    console.log('      ✓ Verified 0 users have missing Phase 4A account fields.');

    console.log('\n================================================================');
    console.log(' Migration Phase 4A completed and all postconditions verified!');
    console.log('================================================================\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('\n[Migration Failure] An error occurred during migration:', err.message);
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      try {
        await mongoose.connection.close();
      } catch (closeErr) {
        // Suppress secondary close errors
      }
    }
    process.exit(1);
  }
}

// Execute migration entrypoint
runMigration();
