const mongoose = require('mongoose');

const HoroscopeRecordSchema = new mongoose.Schema(
  {
    personName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other', 'Not Specified'],
      default: 'Not Specified',
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    timeOfBirth: {
      type: String,
      required: true,
      trim: true,
    },
    placeOfBirth: {
      type: String,
      required: true,
      trim: true,
    },
    birthCoordinates: {
      type: String,
      required: true,
      trim: true,
    },
    contactPhone: {
      type: String,
      trim: true,
      default: '',
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    // Astrological Results from Prokerala
    rasi: {
      type: String,
      default: '',
    },
    nakshatram: {
      type: String,
      default: '',
    },
    padam: {
      type: Number,
      default: null,
    },
    lagnam: {
      type: String,
      default: '',
    },
    dosham: {
      hasDosham: { type: Boolean, default: false },
      doshamType: { type: String, default: 'None' },
      doshamSummary: { type: String, default: 'None' },
      description: { type: String, default: '' },
    },
    dasaBalance: {
      planet: { type: String, default: '' },
      years: { type: Number, default: 0 },
      months: { type: Number, default: 0 },
      days: { type: Number, default: 0 },
      balanceDisplay: { type: String, default: '' },
    },
    rasiChartSvg: {
      type: String,
      default: '',
    },
    navamsaChartSvg: {
      type: String,
      default: '',
    },
    isGenerated: {
      type: Boolean,
      default: true,
    },
    isSimulated: {
      type: Boolean,
      default: false,
    },
    attribution: {
      type: String,
      default: 'Astrological calculations powered by Prokerala Astrology API',
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

HoroscopeRecordSchema.index({ createdAt: -1 });
HoroscopeRecordSchema.index({ personName: 1 });

module.exports = mongoose.model('HoroscopeRecord', HoroscopeRecordSchema);
