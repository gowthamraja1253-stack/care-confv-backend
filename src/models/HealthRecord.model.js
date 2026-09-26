import mongoose from 'mongoose';

const healthRecordSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['medical-history', 'prescription', 'test-result', 'consultation-note'],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    textContent: {
      type: String,
      default: '',
      trim: true,
    },
    fileUrl: {
      type: String,
      default: '',
      trim: true,
    },
    fileName: {
      type: String,
      default: '',
      trim: true,
    },
    fileType: {
      type: String,
      default: '',
      trim: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    doctorName: {
      type: String,
      default: '',
      trim: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
      index: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    tags: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    aiExplanation: {
      summary: { type: String, default: '' },
      keyFindings: { type: [String], default: [] },
      actionableAdvice: { type: String, default: '' },
      urgencyLevel: { type: String, default: 'routine' },
      language: { type: String, default: 'en' },
      source: { type: String, default: 'rule-based' },
      generatedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

export const HealthRecord = mongoose.models.HealthRecord || mongoose.model('HealthRecord', healthRecordSchema);
export default HealthRecord;
