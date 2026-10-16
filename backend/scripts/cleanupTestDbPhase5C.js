/**
 * Isolated Test Database Cleanup & Teardown Script (Phase 5C)
 * 
 * Safety Invariants:
 * 1. Explicit, standalone command. NEVER runs automatically.
 * 2. Requires both --apply and --confirm-drop-test-database flags.
 * 3. Asserts mongoose.connection.name === 'matrimony_phase5c_test' before ANY drop operation.
 * 4. Drops ONLY the isolated test database 'matrimony_phase5c_test'.
 * 5. Cleans up temporary session metadata file.
 * 
 * Usage:
 *   Dry-run (safe):
 *     node scripts/cleanupTestDbPhase5C.js
 * 
 *   Execute drop and cleanup:
 *     node scripts/cleanupTestDbPhase5C.js --apply --confirm-drop-test-database
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const envTestPath = process.env.DOTENV_CONFIG_PATH
  ? path.resolve(process.env.DOTENV_CONFIG_PATH)
  : path.join(__dirname, '../.env.test');

dotenv.config({ path: envTestPath });

const EXPECTED_TEST_DB = 'matrimony_phase5c_test';
const SESSION_FILE_PATH = path.join(__dirname, '../.test_phase5c_session.json');

async function cleanupTestDb() {
  const isApply = process.argv.includes('--apply');
  const isConfirmed = process.argv.includes('--confirm-drop-test-database');

  console.log('========================================================================');
  console.log(' Teardown & Drop Isolated Test Database (matrimony_phase5c_test)');
  console.log('========================================================================');
  console.log(`Execution Mode: ${isApply ? 'APPLY (DESTRUCTIVE TO TEST DB)' : 'DRY-RUN (Safe, no database changes)'}`);

  if (isApply && !isConfirmed) {
    console.error('\n[Error] Dropping test database requires the --confirm-drop-test-database flag.');
    console.error('Usage: node scripts/cleanupTestDbPhase5C.js --apply --confirm-drop-test-database\n');
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
      console.error(
        `\n========================================================================` +
        `\n[CRITICAL SAFETY ABORT]` +
        `\nConnected database is '${connectedDb}'. Refusing to drop non-test database!` +
        `\nDrop operation cancelled immediately.` +
        `\n========================================================================\n`
      );
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`[Verified] Connected securely to target test database: ${connectedDb}`);

    if (!isApply) {
      console.log('\n[Dry Run Completed] Target database verified. To drop, pass --apply --confirm-drop-test-database.');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`\nDropping database '${connectedDb}'...`);
    await conn.connection.db.dropDatabase();
    console.log(`✓ Database '${connectedDb}' dropped successfully.`);

    // Remove temporary session file if present
    if (fs.existsSync(SESSION_FILE_PATH)) {
      fs.unlinkSync(SESSION_FILE_PATH);
      console.log(`✓ Deleted test session metadata: ${SESSION_FILE_PATH}`);
    }

    console.log('\n[Success] Phase 5C test database cleanup completed cleanly.\n');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(`\n[Cleanup Error] ${err.message}`);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
}

if (require.main === module) {
  cleanupTestDb();
}

module.exports = { cleanupTestDb, EXPECTED_TEST_DB };
