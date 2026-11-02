/**
 * Subscription-Expiry Email Notification CLI Script
 *
 * Requirements:
 * 1. Default execution is DRY-RUN (read-only, no emails sent, no DB updates).
 * 2. Explicit `--apply` CLI flag required to dispatch emails and update delivery records.
 * 3. Atomic distributed lease locking via JobLock (`subscription_expiry_reminders`) prevents duplicate simultaneous runs.
 * 4. Structured JSON logging without any PII.
 *
 * Usage:
 *   Dry-run mode (safe preview):
 *     node scripts/sendSubscriptionExpiryReminders.js
 *   Live apply mode (dispatches emails):
 *     node scripts/sendSubscriptionExpiryReminders.js --apply
 *   Bypass lock (isolated tests only):
 *     node scripts/sendSubscriptionExpiryReminders.js --apply --no-lock
 */

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../.env') });

const {
  JOB_NAME,
  runSubscriptionExpiryReminders,
} = require('../services/subscriptionReminderService');

async function runCli() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const noLock = args.includes('--no-lock');

  console.log('=== Subscription Expiry Email Reminder Job ===');
  console.log(`Mode: ${isApply ? 'APPLY (Live Email Dispatch & DB Updates Enabled)' : 'DRY-RUN (Default Read-Only Preview)'}`);
  console.log(`Lock: ${noLock ? 'Disabled (--no-lock)' : 'Enabled (JobLock)'}\n`);

  if (!process.env.MONGODB_URI) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      event: 'missing_mongodb_uri',
      job: JOB_NAME,
    }));
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });

    const summary = await runSubscriptionExpiryReminders({
      now: new Date(),
      apply: isApply,
      acquireLock: !noLock,
    });

    console.log('\n--- Execution Summary ---');
    console.log(JSON.stringify(summary, null, 2));

    await mongoose.disconnect();
    process.exit(summary.skippedDueToLock ? 2 : 0);
  } catch (err) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      event: 'cli_fatal_error',
      job: JOB_NAME,
      message: err.message,
    }));
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  JOB_NAME,
  runSubscriptionExpiryReminders,
};
