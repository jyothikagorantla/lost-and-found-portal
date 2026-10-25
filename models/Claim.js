const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: [true, 'Claim must reference an item'],
      index: true,
    },
    claimant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Claim must belong to a claimant'],
      index: true,
    },
    explanation: {
      type: String,
      required: [true, 'Please explain why you believe this item is yours and provide identifying proof'],
      trim: true,
      minlength: [10, 'Explanation must be at least 10 characters long'],
      maxlength: [2000, 'Explanation cannot exceed 2000 characters'],
    },
    evidenceImage: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Review notes cannot exceed 1000 characters'],
      default: '',
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent multiple pending claims by the same claimant on the same item
claimSchema.index({ item: 1, claimant: 1, status: 1 });

const Claim = mongoose.model('Claim', claimSchema);

module.exports = Claim;
