import mongoose from 'mongoose';

const medicineOrderItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    dosage: {
      type: String,
      default: '',
      trim: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    instructions: {
      type: String,
      default: '',
      trim: true,
    },
    price: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const medicineOrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    patientName: {
      type: String,
      required: true,
      trim: true,
    },
    patientPhone: {
      type: String,
      default: '',
      trim: true,
    },
    patientVillage: {
      type: String,
      default: '',
      trim: true,
    },
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
      required: true,
      index: true,
    },
    pharmacyName: {
      type: String,
      required: true,
      trim: true,
    },
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HealthRecord',
      default: null,
    },
    prescriptionTitle: {
      type: String,
      default: '',
      trim: true,
    },
    doctorName: {
      type: String,
      default: '',
      trim: true,
    },
    medicines: {
      type: [medicineOrderItemSchema],
      default: [],
      validate: [
        (arr) => arr.length > 0,
        'At least one medicine item is required for the order',
      ],
    },
    deliveryType: {
      type: String,
      enum: ['pickup', 'delivery'],
      default: 'pickup',
    },
    deliveryAddress: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'ready', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    totalEstimatedPrice: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    readyAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast order lookups
medicineOrderSchema.index({ patientId: 1, createdAt: -1 });
medicineOrderSchema.index({ pharmacyId: 1, status: 1, createdAt: -1 });

export const MedicineOrder = mongoose.models.MedicineOrder || mongoose.model('MedicineOrder', medicineOrderSchema);
export default MedicineOrder;
