import mongoose from 'mongoose';

const preventiveTipSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient ID is required'],
      index: true,
    },
    tipText: {
      type: String,
      required: [true, 'Tip text is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: {
        values: ['seasonal', 'nutrition', 'hygiene', 'chronic-care', 'lifestyle', 'hydration'],
        message: '{VALUE} is not a valid tip category.',
      },
      default: 'seasonal',
    },
    actionableAdvice: {
      type: String,
      default: '',
      trim: true,
    },
    icon: {
      type: String,
      default: '💡',
    },
    language: {
      type: String,
      default: 'en',
    },
    source: {
      type: String,
      enum: ['llm', 'rule-based'],
      default: 'rule-based',
    },
    generatedAt: {
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

// Index to quickly fetch tips for a patient sorted by generation date
preventiveTipSchema.index({ patientId: 1, generatedAt: -1 });

const PreventiveTip = mongoose.model('PreventiveTip', preventiveTipSchema);

export default PreventiveTip;
