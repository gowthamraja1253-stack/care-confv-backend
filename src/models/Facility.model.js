import mongoose from 'mongoose';

const facilitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['primary-health-centre', 'government-hospital', 'clinic', 'pharmacy'],
      required: true,
      index: true,
    },
    location: {
      lat: {
        type: Number,
        required: true,
      },
      lng: {
        type: Number,
        required: true,
      },
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    hours: {
      type: String,
      default: 'Open 24x7 Emergency',
      trim: true,
    },
    rating: {
      type: Number,
      default: 4.8,
    },
    services: {
      type: [String],
      default: [],
    },
    isGovernmentVerified: {
      type: Boolean,
      default: true,
    },
    emergencyContact: {
      type: String,
      default: '108',
    },
    bedsAvailable: {
      type: Number,
      default: 10,
    },
    doctorsCount: {
      type: Number,
      default: 2,
    },
    genericMedicineStock: {
      type: Boolean,
      default: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    isRegisteredCenter: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Geo index on location if needed
facilitySchema.index({ 'location.lat': 1, 'location.lng': 1 });

export const Facility = mongoose.model('Facility', facilitySchema);
export default Facility;
