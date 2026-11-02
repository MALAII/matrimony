const {
  JOB_NAME: DEACTIVATION_JOB_NAME,
  logStructured: logDeactivationStructured,
  runSubscriptionExpiryDeactivation,
} = require('../scripts/deactivateExpiredProfilesPhase5C');
const {
  JOB_NAME: REMINDER_JOB_NAME,
  runSubscriptionExpiryReminders,
} = require('./subscriptionReminderService');

const DEFAULT_SCHEDULER_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours default

let schedulerTimer = null;
let isDeactivationExecuting = false;
let isReminderExecuting = false;

/**
 * Triggers a single execution of the 7-day subscription expiry email reminder job with distributed lock.
 *
 * @param {object} [options]
 * @param {boolean} [options.apply=true]
 * @param {string} [options.workerId]
 * @returns {Promise<object>}
 */
const triggerReminderRun = async ({
  apply = true,
  workerId = `in-process-reminder-${process.pid}`,
} = {}) => {
  if (isReminderExecuting) {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'warn',
      event: 'reminder_execution_overlap_skipped',
      workerId,
    }));
    return { skipped: true, reason: 'execution_in_progress' };
  }

  isReminderExecuting = true;
  try {
    const summary = await runSubscriptionExpiryReminders({
      now: new Date(),
      apply,
      acquireLock: true,
      workerId,
    });
    return summary;
  } catch (err) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      event: 'reminder_trigger_failed',
      error: err.message,
    }));
    return { error: err.message };
  } finally {
    isReminderExecuting = false;
  }
};

/**
 * Triggers a single execution of the deactivation job with distributed lock acquisition.
 *
 * @param {object} [options]
 * @param {boolean} [options.apply=true]
 * @param {string} [options.workerId]
 * @returns {Promise<object>}
 */
const triggerDeactivationRun = async ({
  apply = true,
  workerId = `in-process-deactivation-${process.pid}`,
} = {}) => {
  if (isDeactivationExecuting) {
    logDeactivationStructured('warn', 'scheduler_execution_overlap_skipped', { workerId });
    return { skipped: true, reason: 'execution_in_progress' };
  }

  isDeactivationExecuting = true;
  try {
    const summary = await runSubscriptionExpiryDeactivation({
      now: new Date(),
      apply,
      acquireLock: true,
      workerId,
    });
    return summary;
  } catch (err) {
    logDeactivationStructured('error', 'scheduler_trigger_failed', { error: err.message });
    return { error: err.message };
  } finally {
    isDeactivationExecuting = false;
  }
};

/**
 * Triggers both daily subscription jobs sequentially:
 * 1. 7-Day Expiry Email Reminders (user reminder & admin digest)
 * 2. Grace-Period Profile Deactivations
 *
 * @param {object} [options]
 * @returns {Promise<{ reminders: object, deactivation: object }>}
 */
const triggerAllExpiryJobs = async ({ apply = true, workerId } = {}) => {
  const reminderSummary = await triggerReminderRun({ apply, workerId });
  const deactivationSummary = await triggerDeactivationRun({ apply, workerId });
  return { reminders: reminderSummary, deactivation: deactivationSummary };
};

/**
 * Starts the in-process daily subscription expiry scheduler if enabled via environment variable
 * or explicitly enabled by caller.
 *
 * Controlled by:
 * - `ENABLE_IN_PROCESS_SCHEDULER=true` (must be explicitly true)
 * - `SUBSCRIPTION_EXPIRY_INTERVAL_MS` (optional interval in milliseconds, defaults to 24h)
 * - `RUN_EXPIRY_SCHEDULER_ON_STARTUP=true` (optional immediate run on boot)
 *
 * @param {object} [options]
 * @param {boolean} [options.forceEnable=false]
 * @param {number} [options.intervalMs]
 * @param {boolean} [options.runImmediately=false]
 * @returns {object} Scheduler controller
 */
const startSubscriptionExpiryScheduler = ({
  forceEnable = false,
  intervalMs = null,
  runImmediately = false,
} = {}) => {
  const isEnabled = forceEnable || process.env.ENABLE_IN_PROCESS_SCHEDULER === 'true';

  if (!isEnabled) {
    logDeactivationStructured('info', 'in_process_scheduler_disabled', {
      message: 'In-process scheduler is disabled. Use external cron (Render/AWS/Linux crontab) or set ENABLE_IN_PROCESS_SCHEDULER=true.',
    });
    return {
      isRunning: () => false,
      stop: () => {},
      triggerNow: () => triggerAllExpiryJobs({ apply: true }),
      triggerRemindersNow: () => triggerReminderRun({ apply: true }),
      triggerDeactivationNow: () => triggerDeactivationRun({ apply: true }),
    };
  }

  if (schedulerTimer) {
    logDeactivationStructured('warn', 'in_process_scheduler_already_running');
    return {
      isRunning: () => Boolean(schedulerTimer),
      stop: stopSubscriptionExpiryScheduler,
      triggerNow: () => triggerAllExpiryJobs({ apply: true }),
      triggerRemindersNow: () => triggerReminderRun({ apply: true }),
      triggerDeactivationNow: () => triggerDeactivationRun({ apply: true }),
    };
  }

  const resolvedInterval =
    intervalMs ||
    (process.env.SUBSCRIPTION_EXPIRY_INTERVAL_MS
      ? parseInt(process.env.SUBSCRIPTION_EXPIRY_INTERVAL_MS, 10)
      : DEFAULT_SCHEDULER_INTERVAL_MS);

  const shouldRunOnStartup =
    runImmediately || process.env.RUN_EXPIRY_SCHEDULER_ON_STARTUP === 'true';

  logDeactivationStructured('info', 'in_process_scheduler_started', {
    intervalMs: resolvedInterval,
    runOnStartup: shouldRunOnStartup,
  });

  if (shouldRunOnStartup) {
    setImmediate(() => {
      triggerAllExpiryJobs({ apply: true }).catch((err) => {
        logDeactivationStructured('error', 'startup_run_failed', { error: err.message });
      });
    });
  }

  schedulerTimer = setInterval(() => {
    triggerAllExpiryJobs({ apply: true }).catch((err) => {
      logDeactivationStructured('error', 'scheduled_run_failed', { error: err.message });
    });
  }, resolvedInterval);

  if (typeof schedulerTimer.unref === 'function') {
    schedulerTimer.unref(); // Allow node process to exit cleanly if all other work is complete
  }

  return {
    isRunning: () => Boolean(schedulerTimer),
    stop: stopSubscriptionExpiryScheduler,
    triggerNow: () => triggerAllExpiryJobs({ apply: true }),
    triggerRemindersNow: () => triggerReminderRun({ apply: true }),
    triggerDeactivationNow: () => triggerDeactivationRun({ apply: true }),
  };
};

/**
 * Stops the in-process subscription expiry scheduler timer.
 */
const stopSubscriptionExpiryScheduler = () => {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logDeactivationStructured('info', 'in_process_scheduler_stopped');
  }
};

module.exports = {
  DEACTIVATION_JOB_NAME,
  REMINDER_JOB_NAME,
  triggerReminderRun,
  triggerDeactivationRun,
  triggerAllExpiryJobs,
  startSubscriptionExpiryScheduler,
  stopSubscriptionExpiryScheduler,
};
