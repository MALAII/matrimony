const mongoose = require('mongoose');

const matrimonialProfileSchema = new mongoose.Schema(
  {
    // Optional reference to User (null for broker-sourced profiles without a login account)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Origin tracking
    source: {
      type: String,
      enum: {
        values: ['direct', 'broker'],
        message: '{VALUE} is not a valid profile source',
      },
      default: 'direct',
      required: true,
      index: true,
    },

    // Lifecycle and approval statuses
    approvalStatus: {
      type: String,
      enum: {
        values: ['pending_approval', 'approved', 'rejected'],
        message: '{VALUE} is not a valid approval status',
      },
      default: 'approved', // Direct user profiles are pre-approved
      required: true,
      index: true,
    },
    profileStatus: {
      type: String,
      enum: {
        values: ['active', 'inactive'],
        message: '{VALUE} is not a valid profile status',
      },
      default: 'active',
      required: true,
      index: true,
    },
    deactivationReason: {
      type: String,
      enum: {
        values: ['subscription_expired', 'admin_action', 'member_action', null],
        message: '{VALUE} is not a valid deactivation reason',
      },
      default: null,
    },
    deactivatedAt: {
      type: Date,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Candidate contact details for broker profiles or direct profiles
    candidateName: {
      type: String,
      trim: true,
      maxlength: [100, 'Candidate name cannot exceed 100 characters'],
      validate: {
        validator: function (v) {
          // If source is broker and there is no linked user, candidateName is required
          if (this.source === 'broker' && !this.user) {
            return typeof v === 'string' && v.trim().length > 0;
          }
          return true;
        },
        message: 'Candidate name is required for broker-sourced profiles without a user account',
      },
    },
    candidateEmail: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: function (v) {
          if (!v) return true; // Optional
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Please provide a valid candidate email address',
      },
    },
    candidatePhone: {
      type: String,
      trim: true,
      maxlength: [25, 'Candidate phone cannot exceed 25 characters'],
    },

    // 1. Personal Details
    personalDetails: {
      gender: {
        type: String,
        enum: {
          values: ['Male', 'Female', 'Other'],
          message: '{VALUE} is not a valid gender option (must be Male, Female, or Other)',
        },
      },
      dateOfBirth: {
        type: Date,
        validate: {
          validator: function (value) {
            if (!value) return true;
            return value <= new Date();
          },
          message: 'Date of birth cannot be in the future',
        },
      },
      height: {
        type: Number, // height in cm
        min: [50, 'Height must be at least 50 cm'],
        max: [260, 'Height must be under 260 cm'],
      },
      maritalStatus: {
        type: String,
        enum: {
          values: ['Never Married', 'Divorced', 'Widowed', 'Awaiting Divorce'],
          message: '{VALUE} is not a valid marital status',
        },
      },
      motherTongue: {
        type: String,
        trim: true,
        maxlength: [50, 'Mother tongue cannot exceed 50 characters'],
      },
      location: {
        type: String,
        trim: true,
        maxlength: [100, 'Location cannot exceed 100 characters'],
      },
    },

    // 2. Education and Professional Details
    educationAndProfession: {
      educationalQualification: {
        type: String,
        trim: true,
        maxlength: [100, 'Educational qualification cannot exceed 100 characters'],
      },
      occupation: {
        type: String,
        trim: true,
        maxlength: [100, 'Occupation cannot exceed 100 characters'],
      },
      company: {
        type: String,
        trim: true,
        maxlength: [100, 'Company name cannot exceed 100 characters'],
      },
      workLocation: {
        type: String,
        trim: true,
        maxlength: [100, 'Work location cannot exceed 100 characters'],
      },
      income: {
        type: String,
        trim: true,
        maxlength: [50, 'Income detail cannot exceed 50 characters'],
      },
    },

    // 3. Family Details
    familyDetails: {
      familyInformation: {
        type: String,
        trim: true,
        maxlength: [500, 'Family information cannot exceed 500 characters'],
      },
      parentInformation: {
        type: String,
        trim: true,
        maxlength: [500, 'Parent information cannot exceed 500 characters'],
      },
      siblingInformation: {
        type: String,
        trim: true,
        maxlength: [500, 'Sibling information cannot exceed 500 characters'],
      },
      familyLocation: {
        type: String,
        trim: true,
        maxlength: [100, 'Family location cannot exceed 100 characters'],
      },
    },

    // 4. Partner Preferences
    partnerPreferences: {
      preferredAgeRange: {
        min: {
          type: Number,
          min: [18, 'Preferred minimum age must be at least 18'],
          max: [100, 'Preferred minimum age cannot exceed 100'],
        },
        max: {
          type: Number,
          min: [18, 'Preferred maximum age must be at least 18'],
          max: [100, 'Preferred maximum age cannot exceed 100'],
        },
      },
      preferredLocation: {
        type: String,
        trim: true,
        maxlength: [100, 'Preferred location cannot exceed 100 characters'],
      },
      educationPreference: {
        type: String,
        trim: true,
        maxlength: [100, 'Education preference cannot exceed 100 characters'],
      },
      occupationPreference: {
        type: String,
        trim: true,
        maxlength: [100, 'Occupation preference cannot exceed 100 characters'],
      },
      otherPreferences: {
        type: String,
        trim: true,
        maxlength: [500, 'Other preferences cannot exceed 500 characters'],
      },
    },

    // 5. Profile Photograph (prepared for future Cloudinary integration)
    profilePhoto: {
      url: {
        type: String,
        default: null,
      },
      publicId: {
        type: String,
        default: null,
      },
    },
  },
  {
    timestamps: true,
    // Automatic indexing disabled. Declared schema indexes must be created through controlled migration procedures.
    autoIndex: false,
  }
);

// Partial unique index: enforces uniqueness only when user is a valid ObjectId, permitting multiple null values for broker candidate profiles
matrimonialProfileSchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: { user: { $type: 'objectId' } },
  }
);

// Validate that preferred age min <= max if both provided, and candidateName is required for unlinked broker profiles
matrimonialProfileSchema.pre('validate', function (next) {
  // Validate candidateName for broker profiles without user
  if (this.source === 'broker' && !this.user) {
    if (!this.candidateName || typeof this.candidateName !== 'string' || !this.candidateName.trim()) {
      this.invalidate(
        'candidateName',
        'Candidate name is required for broker-sourced profiles without a user account'
      );
    }
  }

  const agePref = this.partnerPreferences?.preferredAgeRange;
  if (agePref && typeof agePref.min === 'number' && typeof agePref.max === 'number') {
    if (agePref.min > agePref.max) {
      this.invalidate(
        'partnerPreferences.preferredAgeRange.min',
        'Minimum preferred age cannot be greater than maximum preferred age'
      );
    }
  }
  next();
});

// Clean JSON serialization
matrimonialProfileSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

const MatrimonialProfile = mongoose.model(
  'MatrimonialProfile',
  matrimonialProfileSchema
);

module.exports = MatrimonialProfile;
