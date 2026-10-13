import mongoose from 'mongoose';

const emergencyEventSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient ID is required'],
      index: true,
    },
    symptoms: {
      type: [String],
      default: [],
    },
    riskLevel: {
      type: String,
      enum: ['LOW', 'MODERATE', 'HIGH', 'EMERGENCY'],
      default: 'EMERGENCY',
      index: true,
    },
    reasons: {
      type: [String],
      default: [],
    },
    requiresEscalation: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED'],
      default: 'OPEN',
      index: true,
    },
    assignedDoctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    emergencyContactsNotified: [
      {
        name: { type: String, default: '' },
        relationship: { type: String, default: '' },
        phone: { type: String, default: '' },
        priority: { type: Number, default: 1 },
        notifiedAt: { type: Date, default: Date.now },
      },
    ],
    doctorNotes: {
      type: String,
      default: '',
      trim: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    timeline: [
      {
        status: { type: String },
        changedBy: { type: String, default: 'System' },
        note: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
      },
    ],
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

export const EmergencyEvent = mongoose.models.EmergencyEvent || mongoose.model('EmergencyEvent', emergencyEventSchema);
export default EmergencyEvent;
