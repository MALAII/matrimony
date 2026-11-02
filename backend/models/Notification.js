const mongoose = require('mongoose');

/**
 * Notification Model
 *
 * Persists in-website notification events for regular users and administrators.
 * Supports deterministic deduplication keys scoped to recipient to ensure strict idempotency.
 * Auto-indexing is disabled (autoIndex: false) in accordance with project database safety rules,
 * with explicit indexes defined for production deployment.
 */
const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient user ID is required'],
      index: true,
    },
    recipientRole: {
      type: String,
      enum: {
        values: ['user', 'admin'],
        message: '{VALUE} is not a valid recipient role',
      },
      default: 'user',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: [
          'subscription_expiry_reminder',
          'subscription_expired',
          'admin_subscription_expiry_digest',
          'payment_failed',
        ],
        message: '{VALUE} is not a supported notification type',
      },
      required: [true, 'Notification type is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [120, 'Notification title cannot exceed 120 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [500, 'Notification message cannot exceed 500 characters'],
    },
    link: {
      type: String,
      default: '',
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    dedupKey: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for feed queries sorted by creation date with unread filter support
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

// Unique compound index scoped to recipient to guarantee idempotent notification creation
notificationSchema.index({ recipient: 1, dedupKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Notification', notificationSchema);
