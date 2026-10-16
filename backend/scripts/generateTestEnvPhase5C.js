/**
 * Utility script to generate a minimal, secure backend/.env.test file
 * derived from backend/.env without exposing secrets to console or logs.
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const prodEnvPath = path.join(__dirname, '../.env');
const testEnvPath = path.join(__dirname, '../.env.test');

if (!fs.existsSync(prodEnvPath)) {
  console.error('[Error] backend/.env file not found.');
  process.exit(1);
}

const prodConfig = dotenv.parse(fs.readFileSync(prodEnvPath, 'utf8'));
const prodMongoUri = prodConfig.MONGODB_URI;

if (!prodMongoUri) {
  console.error('[Error] MONGODB_URI not found in backend/.env.');
  process.exit(1);
}

// Strictly derive test database URI targeting 'matrimony_phase5c_test'
// Replaces '/matrimony' database path segment with '/matrimony_phase5c_test'
const testMongoUri = prodMongoUri.replace(/\/matrimony(?=[\?\/]|$)/, '/matrimony_phase5c_test');

if (testMongoUri === prodMongoUri) {
  console.error('[Error] Failed to derive test database URI: prod URI does not contain /matrimony database name.');
  process.exit(1);
}

const testEnvContent = [
  '# Auto-generated isolated test configuration for Phase 5C manual testing',
  '# DO NOT COMMIT TO VERSION CONTROL',
  'NODE_ENV=development',
  'PORT=5001',
  `MONGODB_URI=${testMongoUri}`,
  'JWT_SECRET=test_phase5c_jwt_secret_isolated_only_847192837492',
  'JWT_EXPIRES_IN=7d',
  'RAZORPAY_CHECKOUT_ENABLED=false',
  'CLIENT_URL=http://localhost:3000',
  '',
].join('\n');

fs.writeFileSync(testEnvPath, testEnvContent, { encoding: 'utf8', mode: 0o600 });
console.log('[Success] Created backend/.env.test securely (database: matrimony_phase5c_test, port: 5001).');
