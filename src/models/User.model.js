import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },
    // Supports either phone or email
    phone: {
      type: String,
      trim: true,
      sparse: true,
      default: null,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      default: null,
    },
    identifier: {
      type: String,
      required: [true, 'Please provide a phone number or email address'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ['patient', 'doctor', 'admin', 'pharmacy'],
        message: '{VALUE} is not a valid role. Allowed: patient, doctor, admin, pharmacy',
      },
      default: 'patient',
    },
    village: {
      type: String,
      trim: true,
      default: 'Rampur Village',
    },
    preferredLanguage: {
      type: String,
      trim: true,
      default: 'Hindi',
    },

    // --- Role-Specific Fields ---

    // Patient Specific
    age: {
      type: Number,
      min: [0, 'Age cannot be negative'],
      max: [130, 'Age exceeds realistic limit'],
      default: 35,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other', 'Prefer not to say'],
      default: 'Male',
    },
    chronicFlags: {
      type: [String],
      default: [],
    },
    emergencyContact: {
      name: {
        type: String,
        trim: true,
        default: 'Ramesh Kumar (Brother)',
      },
      phone: {
        type: String,
        trim: true,
        default: '+91 98765 43210',
      },
      relation: {
        type: String,
        trim: true,
        default: 'Family Member',
      },
    },

    // Doctor Specific
    specialization: {
      type: String,
      trim: true,
      default: 'General Physician',
    },
    licenseId: {
      type: String,
      trim: true,
      default: '',
    },
    availability: {
      type: [String],
      default: ['Mon - Fri: 09:00 AM - 01:00 PM', 'Mon - Fri: 04:00 PM - 07:00 PM'],
    },
    availabilitySlots: {
      type: [
        {
          id: { type: String },
          day: { type: String, default: 'Today' },
          time: { type: String, default: '10:30 AM' },
          period: { type: String, enum: ['morning', 'afternoon', 'evening'], default: 'morning' },
          isBooked: { type: Boolean, default: false },
        },
      ],
      default: [
        { id: 'slot-1', day: 'Today', time: '10:30 AM - 11:00 AM', period: 'morning', isBooked: false },
        { id: 'slot-2', day: 'Today', time: '11:30 AM - 12:00 PM', period: 'morning', isBooked: false },
        { id: 'slot-3', day: 'Today', time: '04:30 PM - 05:00 PM', period: 'afternoon', isBooked: false },
        { id: 'slot-4', day: 'Today', time: '05:30 PM - 06:00 PM', period: 'evening', isBooked: false },
        { id: 'slot-5', day: 'Tomorrow', time: '10:00 AM - 10:30 AM', period: 'morning', isBooked: false },
        { id: 'slot-6', day: 'Tomorrow', time: '04:00 PM - 04:30 PM', period: 'afternoon', isBooked: false },
      ],
    },

    // Admin Specific
    designation: {
      type: String,
      trim: true,
      default: 'Primary Health Center Officer',
    },

    // Pharmacy / Healthcare Center Specific
    facilityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
      default: null,
    },
    facilityName: {
      type: String,
      trim: true,
      default: '',
    },
    facilityAddress: {
      type: String,
      trim: true,
      default: '',
    },
    facilityPhone: {
      type: String,
      trim: true,
      default: '',
    },
    facilityHours: {
      type: String,
      trim: true,
      default: '08:00 AM - 09:30 PM (Daily)',
    },
    facilityLocation: {
      lat: { type: Number, default: 28.805 },
      lng: { type: Number, default: 79.028 },
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
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('passwordHash')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

// Generate JWT token
userSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    {
      id: this._id,
      role: this.role,
      name: this.name,
      identifier: this.identifier,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpire }
  );
};

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
