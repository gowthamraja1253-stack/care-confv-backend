import mongoose from 'mongoose';

const riskHistorySchema = new mongoose.Schema(
  {
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    level: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true,
    },
    riskType: {
      type: String,
      default: 'general',
    },
    reason: {
      type: String,
      default: 'Routine risk recalculation',
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const riskFactorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    contribution: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const riskProfileSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient ID is required'],
      unique: true,
      index: true,
    },
    riskType: {
      type: String,
      enum: {
        values: ['diabetes', 'hypertension', 'maternal', 'general', 'cardiovascular', 'respiratory'],
        message: '{VALUE} is not a valid risk type',
      },
      default: 'general',
      required: true,
    },
    score: {
      type: Number,
      required: [true, 'Risk score (0-100) is required'],
      min: [0, 'Risk score cannot be negative'],
      max: [100, 'Risk score cannot exceed 100'],
      default: 20,
    },
    level: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high'],
        message: '{VALUE} is not a valid risk level (must be low, medium, or high)',
      },
      default: 'low',
      required: true,
    },
    explanation: {
      type: String,
      required: [true, 'Explanation is required'],
      trim: true,
      default: 'Low baseline health risk profile based on current age and clinical parameters.',
    },
    factors: {
      type: [riskFactorSchema],
      default: [],
    },
    history: {
      type: [riskHistorySchema],
      default: [],
    },
    lastUpdated: {
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

export const RiskProfile = mongoose.model('RiskProfile', riskProfileSchema);
export default RiskProfile;
