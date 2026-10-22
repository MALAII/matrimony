const mongoose = require('mongoose');

/**
 * JobLock Model
 *
 * Provides atomic, lease-based distributed locking for scheduled background jobs
 * (such as daily subscription expiry deactivation) across multiple backend instances.
 *
 * Invariants:
 * - Unique index on `jobName` guarantees mutual exclusion.
 * - Leases expire automatically after `leaseExpiresAt` to recover safely from worker crashes.
 * - Fence token (`lockToken`) prevents stale workers from releasing or modifying a newer lease.
 * - `autoIndex: false` preserved in accordance with project database safety rules.
 */
const jobLockSchema = new mongoose.Schema(
  {
    jobName: {
      type: String,
      required: [true, 'jobName is required'],
      unique: true,
      trim: true,
    },
    lockedBy: {
      type: String,
      default: null,
      trim: true,
    },
    lockToken: {
      type: String,
      default: null,
      select: false,
    },
    acquiredAt: {
      type: Date,
      default: null,
    },
    leaseExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastRunAt: {
      type: Date,
      default: null,
    },
    lastRunStatus: {
      type: String,
      enum: {
        values: ['idle', 'success', 'failed'],
        message: '{VALUE} is not a valid lastRunStatus',
      },
      default: 'idle',
    },
    lastRunSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    autoIndex: false,
  }
);

module.exports = mongoose.model('JobLock', jobLockSchema);
