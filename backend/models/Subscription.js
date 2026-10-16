const mongoose = require('mongoose');

/**
 * Subscription Model
 * 
 * Tracks agreement terms, dates, and status for authenticated users.
 * Enforces a partial unique index on `payment` ({ payment: { $type: "objectId" } })
 * so that each Payment can activate at most one Subscription at the database level.
 * 
 * Auto-indexing is disabled (autoIndex: false) in accordance with project database safety rules.
 */
const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required for a subscription'],
      index: true,
    },
    planCode: {
      type: String,
      enum: {
        values: ['THREE_MONTHS', 'SIX_MONTHS'],
        message: '{VALUE} is not a valid subscription plan code',
      },
      required: [true, 'Plan code is required'],
    },
    durationMonths: {
      type: Number,
      required: [true, 'Duration in months is required'],
      enum: [3, 6],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'active', 'grace_period', 'expired', 'cancelled'],
        message: '{VALUE} is not a valid subscription status',
      },
      default: 'pending',
      index: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    gracePeriodEndDate: {
      type: Date,
      default: null,
    },
    // The successful Payment document that activated this subscription
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
  },
  {
    timestamps: true,
    autoIndex: false,
  }
);

// Partial unique index: at most one Subscription per non-null Payment ObjectId
subscriptionSchema.index(
  { payment: 1 },
  {
    name: 'payment_1_partial_unique',
    unique: true,
    partialFilterExpression: { payment: { $type: 'objectId' } },
  }
);

module.exports = mongoose.model('Subscription', subscriptionSchema);
