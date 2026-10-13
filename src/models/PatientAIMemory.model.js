import mongoose from 'mongoose';

const patientAIMemorySchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    memoryType: {
      type: String,
      enum: [
        'allergy',
        'chronic_condition',
        'medication_history',
        'recurring_symptom',
        'consultation_summary',
        'treatment_response',
        'followup_history',
        'risk_event',
      ],
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      enum: ['consultation', 'symptom_check', 'prescription', 'patient_profile', 'doctor_notes', 'emergency_event'],
      default: 'consultation',
    },
    sourceId: {
      type: String,
      default: '',
    },
    importance: {
      type: Number,
      min: 1,
      max: 10,
      default: 5,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

patientAIMemorySchema.index({ patientId: 1, memoryType: 1, createdAt: -1 });
patientAIMemorySchema.index({ patientId: 1, content: 'text' });

export const PatientAIMemory =
  mongoose.models.PatientAIMemory || mongoose.model('PatientAIMemory', patientAIMemorySchema);
export default PatientAIMemory;
