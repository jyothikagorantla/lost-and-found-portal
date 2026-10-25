const mongoose = require('mongoose');

const CATEGORIES = [
  'Electronics',
  'Wallets and Purses',
  'Identity Cards',
  'Keys',
  'Bags and Luggage',
  'Books and Stationery',
  'Clothing',
  'Jewellery and Accessories',
  'Documents',
  'Other',
];

const itemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide an item title'],
      trim: true,
      minlength: [2, 'Item title must be at least 2 characters'],
      maxlength: [120, 'Item title cannot exceed 120 characters'],
    },
    type: {
      type: String,
      enum: {
        values: ['lost', 'found'],
        message: 'Item type must be either "lost" or "found"',
      },
      required: [true, 'Please specify if the item was lost or found'],
      index: true,
    },
    category: {
      type: String,
      enum: {
        values: CATEGORIES,
        message: 'Invalid category selected',
      },
      required: [true, 'Please select an item category'],
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide a detailed description'],
      trim: true,
      maxlength: [3000, 'Description cannot exceed 3000 characters'],
    },
    location: {
      type: String,
      required: [true, 'Please specify the location (last seen or found)'],
      trim: true,
      maxlength: [200, 'Location cannot exceed 200 characters'],
      index: true,
    },
    itemDate: {
      type: Date,
      required: [true, 'Please specify the date when the item was lost or found'],
      default: Date.now,
      index: true,
    },
    imageUrl: {
      type: String,
      default: '/images/default-item.svg',
    },
    additionalPrivateNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Private notes cannot exceed 1000 characters'],
      default: '',
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Item must be associated with a user'],
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'pending_review', 'claimed', 'resolved', 'rejected'],
      default: 'active',
      index: true,
    },
    claimCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound text index for search
itemSchema.index({
  title: 'text',
  description: 'text',
  location: 'text',
});

// Category and status compound index for browsing
itemSchema.index({ type: 1, category: 1, status: 1, createdAt: -1 });

const Item = mongoose.model('Item', itemSchema);
Item.CATEGORIES = CATEGORIES;

module.exports = Item;
