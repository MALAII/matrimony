const mongoose = require('mongoose');

const importBatchSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    adminUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileHash: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['validated', 'committing', 'completed', 'failed', 'cancelled'],
      default: 'validated',
      required: true,
      index: true,
    },
    stats: {
      totalRows: { type: Number, default: 0 },
      validRows: { type: Number, default: 0 },
      duplicateRows: { type: Number, default: 0 },
      invalidRows: { type: Number, default: 0 },
      importedRows: { type: Number, default: 0 },
    },
    errors: [
      {
        rowNumber: { type: Number, required: true },
        candidateName: { type: String, default: 'Unknown' },
        candidatePhone: { type: String, default: null },
        candidateEmail: { type: String, default: null },
        reasons: [{ type: String }],
      },
    ],
    // Ephemeral audit tracking: batches auto-expire after 2 hours (7200 seconds)
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 7200,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    autoIndex: false,
    suppressReservedKeysWarning: true,
  }
);

const ImportBatch = mongoose.model('ImportBatch', importBatchSchema);

module.exports = ImportBatch;
