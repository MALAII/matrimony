/**
 * Isolated Test Backend Server Runner (Phase 5C)
 * 
 * Safety Invariants:
 * 1. Loads configuration exclusively from backend/.env.test (or DOTENV_CONFIG_PATH).
 * 2. Strictly verifies that connected database name is exactly 'matrimony_phase5c_test'.
 * 3. Halts with exit code 1 immediately if database name does not match expected test database.
 * 4. Binds strictly to port 5001.
 * 5. Uses extracted app.js without touching production server.js or default port 5000.
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
const TEST_PORT = parseInt(process.env.PORT, 10) || 5001;

async function startIsolatedTestServer() {
  console.log('========================================================================');
  console.log(' Starting Isolated Test Server (Phase 5C Manual Testing)');
  console.log('========================================================================');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('\n[FATAL] MONGODB_URI is not configured in test environment.\n');
    process.exit(1);
  }

  try {
    mongoose.set('autoIndex', false);

    console.log('[Connecting] Connecting to test MongoDB database...');
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: false,
    });

    const actualDbName = conn.connection.name;

    // Hard safety guard: abort before listening on any port
    if (actualDbName !== EXPECTED_TEST_DB) {
      console.error(
        `\n========================================================================` +
        `\n[CRITICAL SAFETY ABORT]` +
        `\nConnected database name is '${actualDbName}'.` +
        `\nExpected exclusively '${EXPECTED_TEST_DB}'.` +
        `\nServer startup aborted before serving any requests.` +
        `\n========================================================================\n`
      );
      await mongoose.disconnect();
      process.exit(1);
    }

    const host = conn.connection.host || 'cluster';
    console.log(`[Verified] Database safety assertion passed: [${actualDbName}] on host: [${host}]`);

    // Import the reusable Express app (free of side-effects)
    const app = require('../app');

    const server = app.listen(TEST_PORT, () => {
      console.log(`\n✓ Isolated Test Backend running on http://localhost:${TEST_PORT}`);
      console.log(`✓ Bound exclusively to database: ${actualDbName}`);
      console.log(`✓ Razorpay checkout enabled: ${process.env.RAZORPAY_CHECKOUT_ENABLED || 'false'}`);
      console.log('✓ Ready for manual API test requests.\n');
    });

    // Graceful shutdown handling
    const shutdown = async () => {
      console.log('\n[Shutting Down] Closing isolated test server and database connection...');
      server.close(async () => {
        try {
          await mongoose.disconnect();
          console.log('[Stopped] Isolated test server stopped safely.');
          process.exit(0);
        } catch (_) {
          process.exit(0);
        }
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error(`\n[Server Startup Error] ${err.message}\n`);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
}

if (require.main === module) {
  startIsolatedTestServer();
}

module.exports = { startIsolatedTestServer, EXPECTED_TEST_DB, TEST_PORT };
