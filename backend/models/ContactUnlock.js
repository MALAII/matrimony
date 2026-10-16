const mongoose = require('mongoose');

/**
 * ContactUnlock Model (Phase 5C)
 *
 * Tracks lifetime contact-number unlocks per viewing member (`viewerUser`) and target
 * matrimonial profile (`targetProfile`).
 *
 * Enforces a unique compound index on `{ viewerUser: 1, targetProfile: 1 }` so that
 * viewing the same candidate's contact number again (even in a later credit cycle or
 * under concurrent requests) never consumes an additional credit.
 *
 * Auto-indexing is disabled (autoIndex: false) in accordance with project database safety rules.
 */
const contactUnlockSchema = new mongoose.Schema(
  {
    viewerUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Viewer user reference is required'],
      index: true,
    },
    targetProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MatrimonialProfile',
      required: [true, 'Target matrimonial profile reference is required'],
      index: true,
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: [true, 'Subscription reference is required'],
    },
    creditCycle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CreditCycle',
      required: [true, 'CreditCycle reference is required'],
    },
    cycleNumber: {
      type: Number,
      required: [true, 'Cycle number is required'],
      min: [1, 'Cycle number must be at least 1'],
    },
    creditsCharged: {
      type: Number,
      required: true,
      default: 1,
      enum: [1],
    },
    unlockedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    autoIndex: false,
  }
);

// Unique compound index: at most one lifetime unlock per viewerUser and targetProfile
contactUnlockSchema.index(
  { viewerUser: 1, targetProfile: 1 },
  {
    name: 'viewerUser_1_targetProfile_1_unique',
    unique: true,
  }
);

module.exports = mongoose.model('ContactUnlock', contactUnlockSchema);
