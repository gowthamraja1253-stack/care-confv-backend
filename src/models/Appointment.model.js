import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
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
    patientName: {
      type: String,
      required: true,
      trim: true,
    },
    patientAge: {
      type: Number,
      default: 35,
    },
    patientGender: {
      type: String,
      default: 'Male',
    },
    patientVillage: {
      type: String,
      default: 'Rampur Village',
    },
    patientPhone: {
      type: String,
      default: '',
    },
    doctorName: {
      type: String,
      required: true,
      trim: true,
    },
    doctorSpecialization: {
      type: String,
      default: 'General Physician',
    },
    doctorQualification: {
      type: String,
      default: 'MBBS, MD',
    },
    hospital: {
      type: String,
      default: 'Primary Health Centre (PHC)',
    },
    slot: {
      slotId: { type: String, default: 'slot-1' },
      day: { type: String, default: 'Today' },
      time: { type: String, default: '10:30 AM - 11:00 AM' },
      slotLabel: { type: String, default: 'Today, 10:30 AM - 11:00 AM' },
      date: { type: String, default: () => new Date().toISOString().split('T')[0] },
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'confirmed',
      index: true,
    },
    mode: {
      type: String,
      enum: ['video', 'chat'],
      default: 'video',
    },
    tokenNumber: {
      type: String,
      default: () => 'TK-' + Math.floor(10 + Math.random() * 90),
    },
    symptomsSummary: {
      type: String,
      default: '',
      trim: true,
    },
    roomId: {
      type: String,
      default: () => 'room-' + Math.random().toString(36).substring(2, 10),
    },
    notes: {
      type: String,
      default: '',
    },
    prescriptionSummary: {
      type: String,
      default: '',
    },
    chatHistory: [
      {
        id: { type: String },
        sender: { type: String, default: '' },
        senderRole: { type: String, default: 'patient' },
        text: { type: String, default: '' },
        translatedText: { type: String, default: '' },
        timestamp: { type: String, default: '' },
      },
    ],
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Appointment = mongoose.model('Appointment', appointmentSchema);
export default Appointment;
