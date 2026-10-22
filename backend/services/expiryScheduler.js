const {
  JOB_NAME,
  logStructured,
  runSubscriptionExpiryDeactivation,
} = require('../scripts/deactivateExpiredProfilesPhase5C');

const DEFAULT_SCHEDULER_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours default

let schedulerTimer = null;
let isJobExecuting = false;

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
  workerId = `in-process-${process.pid}`,
} = {}) => {
  if (isJobExecuting) {
    logStructured('warn', 'scheduler_execution_overlap_skipped', { workerId });
    return { skipped: true, reason: 'execution_in_progress' };
  }

  isJobExecuting = true;
  try {
    const summary = await runSubscriptionExpiryDeactivation({
      now: new Date(),
      apply,
      acquireLock: true,
      workerId,
    });
    return summary;
  } catch (err) {
    logStructured('error', 'scheduler_trigger_failed', { error: err.message });
    return { error: err.message };
  } finally {
    isJobExecuting = false;
  }
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
    logStructured('info', 'in_process_scheduler_disabled', {
      message: 'In-process scheduler is disabled. Use external cron (Render/AWS/Linux crontab) or set ENABLE_IN_PROCESS_SCHEDULER=true.',
    });
    return {
      isRunning: () => false,
      stop: () => {},
      triggerNow: () => triggerDeactivationRun({ apply: true }),
    };
  }

  if (schedulerTimer) {
    logStructured('warn', 'in_process_scheduler_already_running');
    return {
      isRunning: () => Boolean(schedulerTimer),
      stop: stopSubscriptionExpiryScheduler,
      triggerNow: () => triggerDeactivationRun({ apply: true }),
    };
  }

  const resolvedInterval =
    intervalMs ||
    (process.env.SUBSCRIPTION_EXPIRY_INTERVAL_MS
      ? parseInt(process.env.SUBSCRIPTION_EXPIRY_INTERVAL_MS, 10)
      : DEFAULT_SCHEDULER_INTERVAL_MS);

  const shouldRunOnStartup =
    runImmediately || process.env.RUN_EXPIRY_SCHEDULER_ON_STARTUP === 'true';

  logStructured('info', 'in_process_scheduler_started', {
    intervalMs: resolvedInterval,
    runOnStartup: shouldRunOnStartup,
  });

  if (shouldRunOnStartup) {
    // Schedule asynchronous immediate run after startup tick
    setImmediate(() => {
      triggerDeactivationRun({ apply: true }).catch((err) => {
        logStructured('error', 'startup_run_failed', { error: err.message });
      });
    });
  }

  schedulerTimer = setInterval(() => {
    triggerDeactivationRun({ apply: true }).catch((err) => {
      logStructured('error', 'scheduled_run_failed', { error: err.message });
    });
  }, resolvedInterval);

  if (typeof schedulerTimer.unref === 'function') {
    schedulerTimer.unref(); // Allow node process to exit cleanly if all other work is complete
  }

  return {
    isRunning: () => Boolean(schedulerTimer),
    stop: stopSubscriptionExpiryScheduler,
    triggerNow: () => triggerDeactivationRun({ apply: true }),
  };
};

/**
 * Stops the in-process subscription expiry scheduler timer.
 */
const stopSubscriptionExpiryScheduler = () => {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logStructured('info', 'in_process_scheduler_stopped');
  }
};

module.exports = {
  JOB_NAME,
  triggerDeactivationRun,
  startSubscriptionExpiryScheduler,
  stopSubscriptionExpiryScheduler,
};
