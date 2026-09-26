import mongoose from 'mongoose';

const pharmacyStockSchema = new mongoose.Schema(
  {
    pharmacyId: {
      type: mongoose.Schema.Types.Mixed, // Supports ObjectId ref or String ID like 'fac-003'
      ref: 'Facility',
      required: [true, 'Please provide pharmacy facility reference'],
      index: true,
    },
    medicineId: {
      type: mongoose.Schema.Types.Mixed, // Supports ObjectId ref or String ID
      ref: 'Medicine',
      default: null,
      index: true,
    },
    medicineName: {
      type: String,
      required: [true, 'Please provide medicine name'],
      trim: true,
      index: true,
    },
    inStock: {
      type: Boolean,
      default: true,
      index: true,
    },
    quantity: {
      type: Number,
      default: 0,
      min: [0, 'Quantity cannot be negative'],
    },
    price: {
      type: Number,
      default: 0,
      min: [0, 'Price cannot be negative'],
    },
    batchNumber: {
      type: String,
      trim: true,
      default: 'BATCH-STD',
    },
    expiryDate: {
      type: Date,
      default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 1 year from now
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for unique medicine per pharmacy
pharmacyStockSchema.index({ pharmacyId: 1, medicineName: 1 });

export const PharmacyStock = mongoose.model('PharmacyStock', pharmacyStockSchema);
export default PharmacyStock;
