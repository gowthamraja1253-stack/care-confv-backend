import mongoose from 'mongoose';

const symptomAnalysisSchema = new mongoose.Schema(
  {
    symptomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Symptom',
      required: [true, 'Symptom reference ID is required'],
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient ID is required'],
      index: true,
    },
    possibleConditions: {
      type: [String],
      required: [true, 'Possible conditions array is required'],
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length > 0;
        },
        message: 'At least one possible condition must be provided',
      },
    },
    severityScore: {
      type: Number,
      required: [true, 'Severity score (1-10) is required'],
      min: [1, 'Severity score must be at least 1'],
      max: [10, 'Severity score cannot exceed 10'],
    },
    recommendedAction: {
      type: String,
      required: [true, 'Recommended action is required'],
      enum: {
        values: ['self-care', 'visit-clinic', 'consult-doctor', 'emergency'],
        message: '{VALUE} is not a valid action. Allowed: self-care, visit-clinic, consult-doctor, emergency',
      },
    },
    explanation: {
      type: String,
      required: [true, 'Plain-language explanation is required'],
      trim: true,
    },
    source: {
      type: String,
      enum: ['llm', 'rule-based'],
      default: 'rule-based',
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

export const SymptomAnalysis = mongoose.model('SymptomAnalysis', symptomAnalysisSchema);
export default SymptomAnalysis;
