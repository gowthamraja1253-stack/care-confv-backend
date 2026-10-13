import mongoose from 'mongoose';

const patientMedicationSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HealthRecord',
      default: null,
      index: true,
    },
    medicineName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    dosage: {
      type: String,
      default: '1 Tablet',
      trim: true,
    },
    frequency: {
      type: String,
      default: 'Daily',
      trim: true,
    },
    schedule: {
      type: [String],
      default: ['08:00 AM'],
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },
    prescribedQuantity: {
      type: Number,
      required: true,
      default: 30,
    },
    remainingQuantity: {
      type: Number,
      required: true,
      default: 30,
      min: [0, 'Remaining stock cannot be negative'],
    },
    refillThreshold: {
      type: Number,
      default: 5,
    },
    prescribingDoctor: {
      type: String,
      default: 'Consulting Physician',
      trim: true,
    },
    activeStatus: {
      type: Boolean,
      default: true,
      index: true,
    },
    instructions: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const PatientMedication =
  mongoose.models.PatientMedication || mongoose.model('PatientMedication', patientMedicationSchema);
export default PatientMedication;
