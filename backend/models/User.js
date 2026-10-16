const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address',
      ],
    },
    passwordHash: {
      type: String,
      required: [
        function () {
          // Invited users do not yet have a password; all other account states require a password hash
          return this.accountStatus !== 'invited';
        },
        'Password hash is required for active accounts',
      ],
      default: null,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    registrationSource: {
      type: String,
      enum: ['direct', 'broker'],
      default: 'direct',
    },
    accountStatus: {
      type: String,
      enum: ['active', 'invited', 'suspended', 'inactive'],
      default: 'active',
    },

    // Invitation and Password Setup Security Fields
    invitationTokenHash: {
      type: String,
      default: null,
      select: false, // Never return token hash in queries by default
    },
    invitationExpiresAt: {
      type: Date,
      default: null,
    },
    invitationSentAt: {
      type: Date,
      default: null,
    },
    invitationDeliveryStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: null,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    // Automatic indexing disabled. Declared schema indexes must be created through controlled migration procedures.
    autoIndex: false,
  }
);

// Exclude passwordHash, invitationTokenHash, and internal version key by default from JSON outputs
userSchema.methods.toJSON = function () {
  const userObj = this.toObject();
  delete userObj.passwordHash;
  delete userObj.invitationTokenHash;
  delete userObj.__v;
  return userObj;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
