import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide medicine name'],
      trim: true,
      index: true,
    },
    genericName: {
      type: String,
      required: [true, 'Please provide generic formulation name'],
      trim: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        'Fever & Pain Relief',
        'Antibiotics & Infection',
        'Diabetes & Blood Sugar',
        'Blood Pressure & Heart',
        'Respiratory & Cough',
        'Gastro & Digestion',
        'Vitamins & Supplements',
        'First Aid & Antiseptics',
        'Other Essential',
      ],
      default: 'Other Essential',
      index: true,
    },
    dosageForm: {
      type: String,
      enum: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Powder/Sachet', 'Other'],
      default: 'Tablet',
    },
    strength: {
      type: String,
      trim: true,
      default: '',
    },
    manufacturer: {
      type: String,
      trim: true,
      default: 'Jan Aushadhi / Govt Supply',
    },
    subsidizedPrice: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative'],
    },
    mrp: {
      type: Number,
      default: 0,
    },
    requiresPrescription: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    sideEffects: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

medicineSchema.index({ name: 'text', genericName: 'text', category: 'text' });

export const Medicine = mongoose.model('Medicine', medicineSchema);
export default Medicine;
