const mongoose = require('mongoose');

/**
 * WebhookEvent Model
 * 
 * Tracks provider webhook deliveries with a database-enforced unique index on eventId.
 * Ensures idempotent handling of distinct webhook events per payment without overwriting history,
 * supports atomic lease-based recovery for stale 'processing' events after a backend crash,
 * and uses a per-claim fence token (claimToken) so an older worker cannot overwrite a newer worker's state.
 * 
 * Auto-indexing is disabled (autoIndex: false) in accordance with project database safety rules.
 */
const webhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: [true, 'Webhook event ID is required'],
      unique: true,
      trim: true,
      index: true,
    },
    eventType: {
      type: String,
      required: [true, 'Webhook event type is required'],
      trim: true,
      index: true,
    },
    razorpayOrderId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['processing', 'processed', 'failed', 'quarantined', 'ignored'],
        message: '{VALUE} is not a valid webhook event status',
      },
      default: 'processing',
      index: true,
    },
    // Unique fence token for the currently active processing lease
    claimToken: {
      type: String,
      default: null,
      select: false,
    },
    // Timestamp when the current worker acquired the processing lease
    claimedAt: {
      type: Date,
      default: null,
    },
    // Timestamp when the current processing lease expires and becomes eligible for stale recovery
    leaseExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    failureReason: {
      type: String,
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    autoIndex: false,
  }
);

webhookEventSchema.options.toJSON = {
  transform: function (doc, ret) {
    delete ret.claimToken;
    delete ret.__v;
    return ret;
  },
};

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
