import mongoose from 'mongoose';

const followUpSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    consultationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
      index: true,
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    instructions: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['UPCOMING', 'DUE', 'MISSED', 'COMPLETED', 'CANCELLED'],
      default: 'UPCOMING',
      index: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
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

followUpSchema.index({ patientId: 1, dueDate: 1 });
followUpSchema.index({ doctorId: 1, dueDate: 1 });

export const FollowUp = mongoose.models.FollowUp || mongoose.model('FollowUp', followUpSchema);
export default FollowUp;
