const crypto = require('crypto');
const JobLock = require('../models/JobLock');

const DEFAULT_LEASE_MS = process.env.JOB_LOCK_LEASE_MS
  ? parseInt(process.env.JOB_LOCK_LEASE_MS, 10)
  : 10 * 60 * 1000; // 10 minutes default lease

/**
 * Attempts to acquire an atomic distributed lease lock for a named background job.
 *
 * @param {object} options
 * @param {string} options.jobName
 * @param {string} [options.lockedBy='worker']
 * @param {number} [options.leaseDurationMs=600000]
 * @param {Date} [options.now=new Date()]
 * @returns {Promise<{ acquired: boolean, lockToken: string | null, reason?: string, expiresAt?: Date }>}
 */
const acquireJobLock = async ({
  jobName,
  lockedBy = `worker-${process.pid}`,
  leaseDurationMs = DEFAULT_LEASE_MS,
  now = new Date(),
} = {}) => {
  if (!jobName) {
    throw new Error('jobName is required to acquire a job lock.');
  }

  const currentTime = now instanceof Date ? now : new Date(now);
  const leaseExpiresAt = new Date(currentTime.getTime() + leaseDurationMs);
  const lockToken = crypto.randomBytes(16).toString('hex');

  try {
    // 1. Attempt to claim an existing lock whose lease has expired or is currently idle
    const updated = await JobLock.findOneAndUpdate(
      {
        jobName,
        $or: [
          { leaseExpiresAt: null },
          { leaseExpiresAt: { $lte: currentTime } },
        ],
      },
      {
        $set: {
          lockedBy,
          lockToken,
          acquiredAt: currentTime,
          leaseExpiresAt,
        },
      },
      { new: true }
    );

    if (updated) {
      return {
        acquired: true,
        lockToken,
        expiresAt: leaseExpiresAt,
      };
    }

    // 2. If no document was updated, check if the lock document already exists
    const existing = await JobLock.findOne({ jobName });
    if (existing) {
      return {
        acquired: false,
        lockToken: null,
        reason: 'lock_held_by_active_worker',
        leaseExpiresAt: existing.leaseExpiresAt,
      };
    }

    // 3. Document does not exist yet: create initial lock document
    try {
      await JobLock.create({
        jobName,
        lockedBy,
        lockToken,
        acquiredAt: currentTime,
        leaseExpiresAt,
      });

      return {
        acquired: true,
        lockToken,
        expiresAt: leaseExpiresAt,
      };
    } catch (createErr) {
      if (createErr && createErr.code === 11000) {
        // Concurrently created by another worker
        return {
          acquired: false,
          lockToken: null,
          reason: 'lock_held_by_active_worker',
        };
      }
      throw createErr;
    }
  } catch (err) {
    return {
      acquired: false,
      lockToken: null,
      reason: `lock_error: ${err.message}`,
    };
  }
};

/**
 * Releases an atomic distributed lease lock using the fence token.
 * Prevents stale workers from releasing or modifying a lease acquired by a newer worker.
 *
 * @param {object} options
 * @param {string} options.jobName
 * @param {string} options.lockToken
 * @param {'success'|'failed'} [options.status='success']
 * @param {object|null} [options.summary=null]
 * @param {Date} [options.now=new Date()]
 * @returns {Promise<{ released: boolean }>}
 */
const releaseJobLock = async ({
  jobName,
  lockToken,
  status = 'success',
  summary = null,
  now = new Date(),
} = {}) => {
  if (!jobName || !lockToken) {
    return { released: false };
  }

  const currentTime = now instanceof Date ? now : new Date(now);

  const updated = await JobLock.findOneAndUpdate(
    {
      jobName,
      lockToken,
    },
    {
      $set: {
        lockedBy: null,
        lockToken: null,
        leaseExpiresAt: null,
        lastRunAt: currentTime,
        lastRunStatus: status === 'failed' ? 'failed' : 'success',
        lastRunSummary: summary,
      },
    },
    { new: true }
  );

  return { released: Boolean(updated) };
};

module.exports = {
  DEFAULT_LEASE_MS,
  acquireJobLock,
  releaseJobLock,
};
