const mongoose = require('mongoose');

const importStagingRecordSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      required: true,
      index: true,
    },
    rowNumber: {
      type: Number,
      required: true,
    },
    payload: {
      type: Object,
      required: true,
    },
    // Ephemeral staging records auto-expire after 2 hours
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 7200,
    },
  },
  {
    timestamps: false,
    autoIndex: false,
  }
);

// Compound index for efficient batch iteration
importStagingRecordSchema.index({ batchId: 1, rowNumber: 1 });

const ImportStagingRecord = mongoose.model('ImportStagingRecord', importStagingRecordSchema);

module.exports = ImportStagingRecord;
