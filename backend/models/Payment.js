const mongoose = require('mongoose');

/**
 * Payment Model
 * 
 * Captures financial transaction details, Razorpay references, and validation logs.
 * Auto-indexing is disabled (autoIndex: false) in accordance with project database safety rules.
 */
const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required for payment'],
      index: true,
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      default: null,
      index: true,
    },
    planCode: {
      type: String,
      enum: {
        values: ['THREE_MONTHS', 'SIX_MONTHS'],
        message: '{VALUE} is not a valid plan code for payment',
      },
      required: [true, 'Plan code is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount in paise is required'],
      min: [1, 'Amount must be greater than zero'],
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    razorpayOrderId: {
      type: String,
      required: [true, 'Razorpay order ID is required'],
      unique: true,
      trim: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    razorpaySignature: {
      type: String,
      default: null,
      select: false, // Do not return signature in queries by default
    },
    status: {
      type: String,
      enum: {
        values: ['created', 'authorized', 'captured', 'failed', 'refunded'],
        message: '{VALUE} is not a valid payment status',
      },
      default: 'created',
      index: true,
    },
    verificationMethod: {
      type: String,
      enum: ['client_callback', 'webhook', null],
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    autoIndex: false,
  }
);

// Ensure sensitive signature is stripped in JSON output
paymentSchema.options.toJSON = {
  transform: function (doc, ret) {
    delete ret.razorpaySignature;
    delete ret.__v;
    return ret;
  },
};

module.exports = mongoose.model('Payment', paymentSchema);
