const mongoose = require('mongoose');

/**
 * CreditCycle Model (Phase 5C)
 *
 * Tracks monthly contact-view credit cycles (50 credits per cycle) for a Subscription.
 * Unused credits do not carry forward across cycles.
 *
 * Enforces a unique compound index on `{ subscription: 1, cycleNumber: 1 }` so at most
 * one CreditCycle record can exist per subscription and cycle number.
 *
 * Auto-indexing is disabled (autoIndex: false) in accordance with project database safety rules.
 */
const creditCycleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required for a credit cycle'],
      index: true,
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: [true, 'Subscription reference is required for a credit cycle'],
      index: true,
    },
    cycleNumber: {
      type: Number,
      required: [true, 'Cycle number is required'],
      min: [1, 'Cycle number must be at least 1'],
    },
    cycleStart: {
      type: Date,
      required: [true, 'Cycle start date is required'],
    },
    cycleEnd: {
      type: Date,
      required: [true, 'Cycle end date is required'],
    },
    creditsAllocated: {
      type: Number,
      required: true,
      default: 50,
      min: [0, 'Allocated credits cannot be negative'],
    },
    creditsUsed: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Used credits cannot be negative'],
    },
    creditsRemaining: {
      type: Number,
      required: true,
      default: 50,
      min: [0, 'Remaining credits cannot be negative'],
    },
  },
  {
    timestamps: true,
    autoIndex: false,
  }
);

// Unique compound index: exactly one CreditCycle per subscription and cycleNumber
creditCycleSchema.index(
  { subscription: 1, cycleNumber: 1 },
  {
    name: 'subscription_1_cycleNumber_1_unique',
    unique: true,
  }
);

// Supporting lookup index by user and subscription
creditCycleSchema.index(
  { user: 1, subscription: 1 },
  {
    name: 'user_1_subscription_1',
  }
);

module.exports = mongoose.model('CreditCycle', creditCycleSchema);
