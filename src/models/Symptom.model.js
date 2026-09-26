import mongoose from 'mongoose';

const symptomSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient ID is required'],
      index: true,
    },
    symptoms: {
      type: [String],
      required: [true, 'At least one symptom must be selected'],
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length > 0;
        },
        message: 'Please select at least one symptom',
      },
    },
    durationDays: {
      type: Number,
      required: [true, 'Duration in days is required'],
      min: [1, 'Duration must be at least 1 day'],
      max: [365, 'Duration cannot exceed 365 days'],
    },
    severity: {
      type: String,
      required: [true, 'Severity level is required'],
      enum: {
        values: ['mild', 'moderate', 'severe'],
        message: '{VALUE} is not a valid severity level (must be mild, moderate, or severe)',
      },
      default: 'mild',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
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

export const Symptom = mongoose.model('Symptom', symptomSchema);
export default Symptom;
