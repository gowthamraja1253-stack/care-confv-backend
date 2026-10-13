import mongoose from 'mongoose';

const medicationDoseSchema = new mongoose.Schema(
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
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    takenAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['PENDING', 'TAKEN', 'MISSED', 'SKIPPED'],
      default: 'PENDING',
      index: true,
    },
    syncId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
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

medicationDoseSchema.index({ patientId: 1, scheduledAt: -1 });
medicationDoseSchema.index({ medicationId: 1, scheduledAt: -1 });

export const MedicationDose =
  mongoose.models.MedicationDose || mongoose.model('MedicationDose', medicationDoseSchema);
export default MedicationDose;
