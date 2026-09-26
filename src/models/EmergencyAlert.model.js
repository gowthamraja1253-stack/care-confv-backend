import mongoose from 'mongoose';

const emergencyAlertSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient ID is required'],
      index: true,
    },
    symptomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Symptom',
      required: [true, 'Symptom ID is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['triggered', 'notified', 'acknowledged', 'resolved'],
        message: '{VALUE} is not a valid alert status',
      },
      default: 'triggered',
      index: true,
    },
    severityScore: {
      type: Number,
      default: 9,
    },
    reason: {
      type: String,
      default: 'Critical emergency symptom triage triggered',
    },
    emergencyContactNotified: {
      type: Boolean,
      default: false,
    },
    notifiedAt: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const EmergencyAlert = mongoose.model('EmergencyAlert', emergencyAlertSchema);
export default EmergencyAlert;
