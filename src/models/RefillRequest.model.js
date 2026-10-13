import mongoose from 'mongoose';

const refillRequestSchema = new mongoose.Schema(
  {
    medicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientMedication',
      required: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    medicineName: {
      type: String,
      required: true,
      trim: true,
    },
    currentRemaining: {
      type: Number,
      default: 0,
    },
    requestedQuantity: {
      type: Number,
      required: true,
      default: 30,
    },
    reason: {
      type: String,
      default: 'Prescription running low',
      trim: true,
    },
    status: {
      type: String,
      enum: ['REQUESTED', 'APPROVED', 'REJECTED', 'FULFILLED'],
      default: 'REQUESTED',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const RefillRequest =
  mongoose.models.RefillRequest || mongoose.model('RefillRequest', refillRequestSchema);
export default RefillRequest;
