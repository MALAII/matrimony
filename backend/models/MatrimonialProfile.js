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
      default: 'pending_approval',
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

    // Batch import tracking
    importBatchId: {
      type: String,
      default: null,
      index: true,
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
      weight: {
        type: Number, // weight in kg
        min: [20, 'Weight must be at least 20 kg'],
        max: [250, 'Weight cannot exceed 250 kg'],
        default: null,
      },
      bloodGroup: {
        type: String,
        trim: true,
        default: null,
      },
      complexion: {
        type: String,
        trim: true,
        default: null,
      },
      diet: {
        type: String,
        trim: true,
        default: null,
      },
      physicalStatus: {
        type: String,
        trim: true,
        default: 'Normal',
      },
      disabilityDetails: {
        type: String,
        trim: true,
        default: null,
      },
      nativity: {
        type: String,
        trim: true,
        default: null,
      },
      placeOfBirth: {
        type: String,
        trim: true,
        default: null,
      },
      timeOfBirth: {
        type: String,
        trim: true,
        default: null,
      },
      presentAddress: {
        type: String,
        trim: true,
        default: null,
      },
      permanentAddress: {
        type: String,
        trim: true,
        default: null,
      },
      contactPerson: {
        type: String,
        trim: true,
        default: null,
      },
      alternatePhone: {
        type: String,
        trim: true,
        default: null,
      },
    },

    // 1b. Community & Lineage Details
    communityDetails: {
      religion: {
        type: String,
        trim: true,
        maxlength: [50, 'Religion cannot exceed 50 characters'],
        default: 'Hindu',
      },
      caste: {
        type: String,
        trim: true,
        maxlength: [100, 'Caste cannot exceed 100 characters'],
        default: null,
      },
      subcaste: {
        type: String,
        trim: true,
        maxlength: [100, 'Subcaste cannot exceed 100 characters'],
        default: null,
      },
      gothram: {
        type: String,
        trim: true,
        maxlength: [100, 'Gothram cannot exceed 100 characters'],
        default: null,
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
      fatherName: {
        type: String,
        trim: true,
        default: null,
      },
      fatherAlive: {
        type: String,
        trim: true,
        set: (v) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : (typeof v === 'string' && v.trim() ? (v.trim().toLowerCase() === 'no' ? 'No' : 'Yes') : null)),
        enum: ['Yes', 'No', null],
        default: 'Yes',
      },
      fatherOccupation: {
        type: String,
        trim: true,
        default: null,
      },
      motherName: {
        type: String,
        trim: true,
        default: null,
      },
      motherAlive: {
        type: String,
        trim: true,
        set: (v) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : (typeof v === 'string' && v.trim() ? (v.trim().toLowerCase() === 'no' ? 'No' : 'Yes') : null)),
        enum: ['Yes', 'No', null],
        default: 'Yes',
      },
      motherOccupation: {
        type: String,
        trim: true,
        default: null,
      },
      marriedElderBrothers: {
        type: Number,
        default: 0,
      },
      unmarriedElderBrothers: {
        type: Number,
        default: 0,
      },
      marriedYoungerBrothers: {
        type: Number,
        default: 0,
      },
      unmarriedYoungerBrothers: {
        type: Number,
        default: 0,
      },
      marriedElderSisters: {
        type: Number,
        default: 0,
      },
      unmarriedElderSisters: {
        type: Number,
        default: 0,
      },
      marriedYoungerSisters: {
        type: Number,
        default: 0,
      },
      unmarriedYoungerSisters: {
        type: Number,
        default: 0,
      },
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
      jobRequirement: {
        type: String,
        trim: true,
        enum: ['Must', 'Optional', 'Not required', null],
        default: null,
      },
      maritalStatusPreference: {
        type: [String],
        default: [],
      },
      dietPreference: {
        type: [String],
        default: [],
      },
      horoscopeRequired: {
        type: String,
        trim: true,
        set: (v) => (v === 'Must Match' ? 'Yes' : v === 'Not Necessary' ? 'No' : v),
        enum: ['Yes', 'No', 'Must Match', 'Not Necessary', "Doesn't Matter", null],
        default: 'Yes',
      },
      castePreference: {
        type: String,
        trim: true,
        default: null,
      },
      subcastePreference: {
        type: String,
        trim: true,
        default: null,
      },
      incomePreference: {
        type: String,
        trim: true,
        default: null,
      },
      otherPreferences: {
        type: String,
        trim: true,
        maxlength: [500, 'Other preferences cannot exceed 500 characters'],
      },
    },

    // 5. Profile Photograph (prepared for future Cloudinary integration)
    // Primary photograph retained for backward compatibility with directory cards and projections
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

    // Multi-photo gallery (maximum 3 photos per candidate)
    photos: {
      type: [
        {
          url: {
            type: String,
            required: [true, 'Photo URL is required'],
            trim: true,
          },
          publicId: {
            type: String,
            required: [true, 'Photo publicId is required'],
            trim: true,
          },
          isPrimary: {
            type: Boolean,
            default: false,
          },
          uploadedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      validate: [
        function (val) {
          return !val || val.length <= 3;
        },
        'Candidate profile cannot exceed a maximum of 3 photos',
      ],
      default: [],
    },

    // 6. Astrological Details (Jathagam / Prokerala Integration)
    horoscope: {
      requestStatus: {
        type: String,
        enum: ['none', 'pending', 'processing', 'completed', 'failed'],
        default: 'none',
      },
      requestedAt: {
        type: Date,
        default: null,
      },
      processedAt: {
        type: Date,
        default: null,
      },
      failedReason: {
        type: String,
        trim: true,
        default: null,
      },
      isGenerated: {
        type: Boolean,
        default: false,
      },
      isSimulated: {
        type: Boolean,
        default: false,
      },
      generatedAt: {
        type: Date,
        default: null,
      },
      timeOfBirth: {
        type: String,
        trim: true,
        default: null,
      },
      placeOfBirth: {
        type: String,
        trim: true,
        default: null,
      },
      birthCoordinates: {
        type: String,
        trim: true,
        default: null,
      },
      timezone: {
        type: String,
        trim: true,
        default: '+05:30',
      },
      rasi: {
        type: String,
        trim: true,
        default: null,
        index: true,
      },
      nakshatram: {
        type: String,
        trim: true,
        default: null,
        index: true,
      },
      padam: {
        type: Number,
        min: 1,
        max: 4,
        default: null,
      },
      lagnam: {
        type: String,
        trim: true,
        default: null,
      },
      dosham: {
        hasChevvaiDosham: {
          type: Boolean,
          default: false,
        },
        hasNagaDosham: {
          type: Boolean,
          default: false,
        },
        doshamSummary: {
          type: String,
          trim: true,
          default: 'None',
        },
        description: {
          type: String,
          trim: true,
          default: null,
        },
      },
      dasaBalance: {
        text: {
          type: String,
          trim: true,
          default: null,
        },
        planet: {
          type: String,
          trim: true,
          default: null,
        },
        years: {
          type: Number,
          default: null,
        },
        months: {
          type: Number,
          default: null,
        },
        days: {
          type: Number,
          default: null,
        },
      },
      rasiChartSvg: {
        type: String,
        default: null,
      },
      navamsaChartSvg: {
        type: String,
        default: null,
      },
      rasiChartBoxes: {
        type: [String],
        default: () => Array(12).fill(''),
      },
      navamsaChartBoxes: {
        type: [String],
        default: () => Array(12).fill(''),
      },
      attribution: {
        type: String,
        default: 'Astrological calculations powered by Prokerala Astrology API',
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

// Synchronizes the primary photo between `photos` array and root `profilePhoto`
matrimonialProfileSchema.methods.syncPrimaryPhoto = function () {
  if (!this.photos || this.photos.length === 0) {
    this.profilePhoto = { url: null, publicId: null };
    return;
  }

  // Find marked primary photo or default to first photo
  let primary = this.photos.find((p) => p.isPrimary);
  if (!primary) {
    this.photos[0].isPrimary = true;
    primary = this.photos[0];
  }

  // Ensure strict single primary flag across the array
  const primaryIdStr = primary._id ? primary._id.toString() : null;
  this.photos.forEach((p) => {
    p.isPrimary = primaryIdStr && p._id ? p._id.toString() === primaryIdStr : p === primary;
  });

  this.profilePhoto = {
    url: primary.url,
    publicId: primary.publicId,
  };
};

// Ensure primary photo synchronization on document saves if photos array was modified
matrimonialProfileSchema.pre('save', function (next) {
  if (this.isModified('photos')) {
    this.syncPrimaryPhoto();
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
