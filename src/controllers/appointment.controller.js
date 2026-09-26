import asyncHandler from '../utils/asyncHandler.js';
import Appointment from '../models/Appointment.model.js';
import User from '../models/User.model.js';
import HealthRecord from '../models/HealthRecord.model.js';
import config from '../config/env.js';
import mongoose from 'mongoose';
import { createConsultationNoteFromAppointment } from './healthRecord.controller.js';

// Curated verified doctors for rural teleconsultation
const DEFAULT_DOCTORS = [
  {
    _id: 'doc-001',
    name: 'Dr. Ananya Sharma',
    qualification: 'MBBS, MD (General Medicine)',
    specialization: 'General Physician',
    experienceYears: 12,
    languages: ['Hindi', 'English'],
    hospital: 'District Community Health Centre',
    rating: 4.9,
    consultationsCount: 1420,
    avatarColor: '#6D28D9',
    availabilitySlots: [
      { id: 'slot-101', day: 'Today', time: '10:30 AM - 11:00 AM', period: 'morning', isBooked: false },
      { id: 'slot-102', day: 'Today', time: '11:30 AM - 12:00 PM', period: 'morning', isBooked: false },
      { id: 'slot-103', day: 'Today', time: '04:30 PM - 05:00 PM', period: 'afternoon', isBooked: false },
      { id: 'slot-104', day: 'Tomorrow', time: '09:30 AM - 10:00 AM', period: 'morning', isBooked: false },
      { id: 'slot-105', day: 'Tomorrow', time: '05:00 PM - 05:30 PM', period: 'evening', isBooked: false },
    ],
  },
  {
    _id: 'doc-002',
    name: 'Dr. Rajesh Patel',
    qualification: 'MBBS, DCH (Pediatrics)',
    specialization: 'Pediatrics',
    experienceYears: 9,
    languages: ['Hindi', 'Gujarati', 'English'],
    hospital: 'Maternal & Child Health Unit',
    rating: 4.8,
    consultationsCount: 980,
    avatarColor: '#0284C7',
    availabilitySlots: [
      { id: 'slot-201', day: 'Today', time: '11:00 AM - 11:30 AM', period: 'morning', isBooked: false },
      { id: 'slot-202', day: 'Today', time: '03:30 PM - 04:00 PM', period: 'afternoon', isBooked: false },
      { id: 'slot-203', day: 'Tomorrow', time: '10:00 AM - 10:30 AM', period: 'morning', isBooked: false },
    ],
  },
  {
    _id: 'doc-003',
    name: 'Dr. Sunita Rao',
    qualification: 'MBBS, MD, DM (Cardiology)',
    specialization: 'Cardiology',
    experienceYears: 16,
    languages: ['Telugu', 'Hindi', 'English'],
    hospital: 'District Multi-Speciality Hospital',
    rating: 4.95,
    consultationsCount: 2150,
    avatarColor: '#DC2626',
    availabilitySlots: [
      { id: 'slot-301', day: 'Today', time: '02:00 PM - 02:30 PM', period: 'afternoon', isBooked: false },
      { id: 'slot-302', day: 'Today', time: '05:30 PM - 06:00 PM', period: 'evening', isBooked: false },
      { id: 'slot-303', day: 'Tomorrow', time: '11:00 AM - 11:30 AM', period: 'morning', isBooked: false },
    ],
  },
  {
    _id: 'doc-004',
    name: 'Dr. Meenakshi Sundaram',
    qualification: 'MBBS, MS (Obstetrics & Gynecology)',
    specialization: 'Gynecology & Maternal Care',
    experienceYears: 14,
    languages: ['Tamil', 'English', 'Hindi'],
    hospital: 'Women & Child Wellness Centre',
    rating: 4.9,
    consultationsCount: 1820,
    avatarColor: '#D946EF',
    availabilitySlots: [
      { id: 'slot-401', day: 'Today', time: '10:00 AM - 10:30 AM', period: 'morning', isBooked: false },
      { id: 'slot-402', day: 'Today', time: '04:00 PM - 04:30 PM', period: 'afternoon', isBooked: false },
      { id: 'slot-403', day: 'Tomorrow', time: '03:00 PM - 03:30 PM', period: 'afternoon', isBooked: false },
    ],
  },
  {
    _id: 'doc-005',
    name: 'Dr. Arvind Verma',
    qualification: 'MBBS, MS (Orthopedics)',
    specialization: 'Orthopedics',
    experienceYears: 11,
    languages: ['Hindi', 'English'],
    hospital: 'Taluk General Hospital',
    rating: 4.75,
    consultationsCount: 890,
    avatarColor: '#D97706',
    availabilitySlots: [
      { id: 'slot-501', day: 'Today', time: '01:30 PM - 02:00 PM', period: 'afternoon', isBooked: false },
      { id: 'slot-502', day: 'Tomorrow', time: '10:30 AM - 11:00 AM', period: 'morning', isBooked: false },
    ],
  },
  {
    _id: 'doc-006',
    name: 'Dr. Priya Nambiar',
    qualification: 'MBBS, MD (Dermatology)',
    specialization: 'Dermatology',
    experienceYears: 8,
    languages: ['Malayalam', 'Tamil', 'English', 'Hindi'],
    hospital: 'Tele-Dermatology Mission Centre',
    rating: 4.85,
    consultationsCount: 760,
    avatarColor: '#059669',
    availabilitySlots: [
      { id: 'slot-601', day: 'Today', time: '03:00 PM - 03:30 PM', period: 'afternoon', isBooked: false },
      { id: 'slot-602', day: 'Tomorrow', time: '02:00 PM - 02:30 PM', period: 'afternoon', isBooked: false },
    ],
  },
];

// In-Memory Appointment Storage for offline/test fallback
const inMemoryAppointments = [
  {
    _id: 'apt-001',
    patientId: 'patient-default',
    doctorId: 'doc-001',
    patientName: 'Kavita Devi',
    patientAge: 32,
    patientGender: 'Female',
    patientVillage: 'Rampur Village',
    patientPhone: '+91 98765 43210',
    doctorName: 'Dr. Ananya Sharma',
    doctorSpecialization: 'General Physician',
    doctorQualification: 'MBBS, MD (General Medicine)',
    hospital: 'District Community Health Centre',
    slot: {
      slotId: 'slot-101',
      day: 'Today',
      time: '10:30 AM - 11:00 AM',
      slotLabel: 'Today, 10:30 AM - 11:00 AM',
      date: new Date().toISOString().split('T')[0],
    },
    status: 'confirmed',
    mode: 'video',
    tokenNumber: 'TK-08',
    symptomsSummary: 'Persistent mild fever and dry cough for 3 days',
    roomId: 'room-apt-001',
    notes: 'Paracetamol 500mg (1-0-1) for 3 days. Adequate oral hydration and steam inhalation.',
    prescriptionSummary: 'Tab Paracetamol 500mg (1-0-1) x 3 days\nTab Cetirizine 10mg (0-0-1) x 3 days at bedtime\nSteam inhalation twice daily with warm saline gargles.',
    chatHistory: [
      {
        id: 'msg-1',
        sender: 'Dr. Ananya Sharma',
        senderRole: 'doctor',
        text: 'Namaste Kavita ji, welcome to the teleconsultation. How can I help you today?',
        translatedText: 'नमस्ते कविता जी, टेली-परामर्श में आपका स्वागत है। आज मैं आपकी क्या मदद कर सकती हूँ?',
        timestamp: '10:31 AM',
      },
      {
        id: 'msg-2',
        sender: 'Kavita Devi',
        senderRole: 'patient',
        text: 'Doctor, I have had a mild fever (99.4 F) and a dry cough since Tuesday.',
        translatedText: 'डॉक्टर, मुझे मंगलवार से हल्का बुखार (99.4 F) और सूखी खांसी है।',
        timestamp: '10:32 AM',
      },
      {
        id: 'msg-3',
        sender: 'Dr. Ananya Sharma',
        senderRole: 'doctor',
        text: 'Understood. I am sending a digital e-prescription. Please take Paracetamol after food and do steam inhalation.',
        translatedText: 'समझ गई। मैं ई-प्रिस्क्रिप्शन भेज रही हूँ। कृपया भोजन के बाद पैरासिटामोल लें और भाप लें।',
        timestamp: '10:35 AM',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'apt-002',
    patientId: 'patient-default',
    doctorId: 'doc-002',
    patientName: 'Ramesh Patel',
    patientAge: 45,
    patientGender: 'Male',
    patientVillage: 'Bhimpur Block 3',
    patientPhone: '+91 98765 12345',
    doctorName: 'Dr. Rajesh Patel',
    doctorSpecialization: 'Pediatrics & General Care',
    doctorQualification: 'MBBS, DCH',
    hospital: 'Maternal & Child Health Unit',
    slot: {
      slotId: 'slot-201',
      day: 'Yesterday',
      time: '03:30 PM - 04:00 PM',
      slotLabel: 'Yesterday, 03:30 PM - 04:00 PM',
      date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    },
    status: 'completed',
    mode: 'video',
    tokenNumber: 'TK-14',
    symptomsSummary: 'Seasonal allergy, throat irritation, and mild headache',
    notes: 'Prescribed anti-histamine and hydration therapy. Follow up if symptoms persist after 5 days.',
    prescriptionSummary: 'Tab Levocetirizine 5mg (0-0-1) at night x 5 days\nVitamin C 500mg chewable daily x 10 days\nAdequate hydration with warm water.',
    chatHistory: [
      {
        id: 'msg-01',
        sender: 'Dr. Rajesh Patel',
        senderRole: 'doctor',
        text: 'Hello Ramesh ji, please describe the throat irritation.',
        translatedText: 'नमस्ते रमेश जी, कृपया गले की परेशानी के बारे में बताएं।',
        timestamp: '03:32 PM',
      },
      {
        id: 'msg-02',
        sender: 'Ramesh Patel',
        senderRole: 'patient',
        text: 'It gets worse during early morning and late night.',
        translatedText: 'सुबह और देर रात में यह बढ़ जाता है।',
        timestamp: '03:33 PM',
      },
      {
        id: 'msg-03',
        sender: 'Dr. Rajesh Patel',
        senderRole: 'doctor',
        text: 'Looks like allergic rhinitis. I have generated your e-prescription.',
        translatedText: 'यह एलर्जिक राइनाइटिस जैसा लगता है। मैंने आपका ई-प्रिस्क्रिप्शन जनरेट कर दिया है।',
        timestamp: '03:37 PM',
      },
    ],
    completedAt: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

/**
 * @desc    Get all available doctors with specialization & slots
 * @route   GET /api/appointments/doctors
 * @access  Private
 */
export const getDoctors = asyncHandler(async (req, res) => {
  const { specialization } = req.query;

  let doctors = [...DEFAULT_DOCTORS];

  if (mongoose.connection.readyState === 1) {
    try {
      const dbDoctors = await User.find({ role: 'doctor' }).select(
        '_id name specialization qualification hospital availability availabilitySlots preferredLanguage'
      );
      if (dbDoctors && dbDoctors.length > 0) {
        // Merge registered DB doctors with default list
        const dbFormatted = dbDoctors.map((doc) => ({
          _id: doc._id.toString(),
          name: doc.name.startsWith('Dr.') ? doc.name : `Dr. ${doc.name}`,
          qualification: doc.qualification || 'MBBS',
          specialization: doc.specialization || 'General Physician',
          experienceYears: 10,
          languages: [doc.preferredLanguage || 'Hindi', 'English'],
          hospital: doc.hospital || 'Primary Health Centre (PHC)',
          rating: 4.9,
          consultationsCount: 500,
          avatarColor: '#6D28D9',
          availabilitySlots:
            doc.availabilitySlots && doc.availabilitySlots.length > 0
              ? doc.availabilitySlots
              : DEFAULT_DOCTORS[0].availabilitySlots,
        }));

        // Deduplicate
        const existingIds = new Set(dbFormatted.map((d) => d._id));
        doctors = [...dbFormatted, ...DEFAULT_DOCTORS.filter((d) => !existingIds.has(d._id))];
      }
    } catch (err) {
      console.warn('[Appointment] Using offline doctors fallback:', err.message);
    }
  }

  if (specialization && specialization !== 'all' && specialization !== 'All') {
    doctors = doctors.filter((doc) =>
      doc.specialization.toLowerCase().includes(specialization.toLowerCase())
    );
  }

  res.status(200).json({
    success: true,
    count: doctors.length,
    doctors,
  });
});

/**
 * @desc    Book a new doctor appointment
 * @route   POST /api/appointments
 * @access  Private
 */
export const bookAppointment = asyncHandler(async (req, res) => {
  const {
    doctorId,
    doctorName,
    doctorSpecialization,
    doctorQualification,
    hospital,
    slot,
    mode = 'video',
    symptomsSummary = '',
    notes = '',
  } = req.body;

  const patient = req.user || {};
  const patientId = patient._id || patient.id || 'patient-user';
  const patientName = patient.name || 'Patient';
  const patientAge = patient.age || 35;
  const patientGender = patient.gender || 'Male';
  const patientVillage = patient.village || 'Rampur Village';
  const patientPhone = patient.phone || patient.identifier || '+91 98765 43210';

  const tokenNumber = 'TK-' + Math.floor(10 + Math.random() * 90);
  const roomId = 'room-' + Math.random().toString(36).substring(2, 10);

  const newAppointmentData = {
    patientId,
    doctorId: doctorId || 'doc-001',
    patientName,
    patientAge,
    patientGender,
    patientVillage,
    patientPhone,
    doctorName: doctorName || 'Dr. Ananya Sharma',
    doctorSpecialization: doctorSpecialization || 'General Physician',
    doctorQualification: doctorQualification || 'MBBS, MD',
    hospital: hospital || 'District Community Health Centre',
    slot: {
      slotId: slot?.id || slot?.slotId || 'slot-auto',
      day: slot?.day || 'Today',
      time: slot?.time || '10:30 AM - 11:00 AM',
      slotLabel: slot?.slotLabel || `${slot?.day || 'Today'}, ${slot?.time || '10:30 AM'}`,
      date: slot?.date || new Date().toISOString().split('T')[0],
    },
    status: 'confirmed',
    mode: mode === 'chat' ? 'chat' : 'video',
    tokenNumber,
    symptomsSummary: symptomsSummary.trim(),
    roomId,
    notes: notes.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let savedAppointment = null;

  if (mongoose.connection.readyState === 1) {
    try {
      const isMongoId =
        mongoose.Types.ObjectId.isValid(patientId) && mongoose.Types.ObjectId.isValid(doctorId);

      if (isMongoId) {
        savedAppointment = await Appointment.create({
          ...newAppointmentData,
          patientId: new mongoose.Types.ObjectId(patientId),
          doctorId: new mongoose.Types.ObjectId(doctorId),
        });
      }
    } catch (dbErr) {
      console.warn('[Appointment] DB create error, falling back to in-memory store:', dbErr.message);
    }
  }

  if (!savedAppointment) {
    savedAppointment = {
      _id: 'apt-' + Date.now(),
      ...newAppointmentData,
    };
    inMemoryAppointments.unshift(savedAppointment);
  }

  res.status(201).json({
    success: true,
    message: 'Appointment booked successfully',
    appointment: savedAppointment,
  });
});

/**
 * @desc    Get upcoming appointments for logged-in user
 * @route   GET /api/appointments/upcoming
 * @access  Private
 */
export const getUpcomingAppointments = asyncHandler(async (req, res) => {
  const { empty } = req.query;

  if (empty === 'true') {
    return res.status(200).json({
      success: true,
      count: 0,
      appointments: [],
    });
  }

  const userId = req.user?._id || req.user?.id || 'patient-user';
  const role = req.user?.role || 'patient';

  let appointments = [];

  if (mongoose.connection.readyState === 1) {
    try {
      const query = { status: { $in: ['confirmed', 'pending'] } };
      if (role === 'doctor') {
        if (mongoose.Types.ObjectId.isValid(userId)) {
          query.doctorId = new mongoose.Types.ObjectId(userId);
        }
      } else {
        if (mongoose.Types.ObjectId.isValid(userId)) {
          query.patientId = new mongoose.Types.ObjectId(userId);
        }
      }

      appointments = await Appointment.find(query).sort({ createdAt: -1 }).limit(5);
    } catch (dbErr) {
      console.warn('[Appointment] DB find upcoming error, using in-memory store:', dbErr.message);
    }
  }

  if (!appointments || appointments.length === 0) {
    appointments = inMemoryAppointments.filter((a) =>
      ['confirmed', 'pending'].includes(a.status)
    );
  }

  res.status(200).json({
    success: true,
    count: appointments.length,
    appointments,
  });
});

/**
 * @desc    Get patient appointment history
 * @route   GET /api/appointments/patient
 * @access  Private
 */
export const getPatientAppointments = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id;

  let appointments = [];

  if (mongoose.connection.readyState === 1) {
    try {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        appointments = await Appointment.find({ patientId: new mongoose.Types.ObjectId(userId) }).sort({
          createdAt: -1,
        });
      }
    } catch (err) {
      console.warn('[Appointment] Error fetching patient appointments:', err.message);
    }
  }

  if (!appointments || appointments.length === 0) {
    appointments = inMemoryAppointments;
  }

  res.status(200).json({
    success: true,
    count: appointments.length,
    appointments,
  });
});

/**
 * @desc    Get live appointment queue for doctor
 * @route   GET /api/appointments/doctor-queue
 * @access  Private
 */
export const getDoctorQueue = asyncHandler(async (req, res) => {
  const { status } = req.query;

  let appointments = [];

  if (mongoose.connection.readyState === 1) {
    try {
      const filter = {};
      if (status) {
        filter.status = status;
      }
      appointments = await Appointment.find(filter).sort({ createdAt: 1 });
    } catch (err) {
      console.warn('[Appointment] Error fetching doctor queue from DB:', err.message);
    }
  }

  if (!appointments || appointments.length === 0) {
    appointments = status
      ? inMemoryAppointments.filter((a) => a.status === status)
      : inMemoryAppointments;
  }

  res.status(200).json({
    success: true,
    count: appointments.length,
    queue: appointments,
  });
});

/**
 * @desc    Update appointment status (confirm, complete, cancel)
 * @route   PATCH /api/appointments/:id/status
 * @access  Private
 */
export const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes, prescriptionSummary, chatHistory } = req.body;

  const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Allowed: ${validStatuses.join(', ')}`,
    });
  }

  let updated = null;

  if (mongoose.connection.readyState === 1) {
    try {
      if (mongoose.Types.ObjectId.isValid(id)) {
        const updateData = {};
        if (status) updateData.status = status;
        if (status === 'completed') updateData.completedAt = new Date();
        if (notes) updateData.notes = notes;
        if (prescriptionSummary) updateData.prescriptionSummary = prescriptionSummary;
        if (Array.isArray(chatHistory)) updateData.chatHistory = chatHistory;

        updated = await Appointment.findByIdAndUpdate(id, updateData, { new: true });
      }
    } catch (err) {
      console.warn('[Appointment] Error updating status in DB:', err.message);
    }
  }

  if (!updated) {
    const memItem = inMemoryAppointments.find((a) => a._id === id || a.id === id);
    if (memItem) {
      if (status) memItem.status = status;
      if (status === 'completed') memItem.completedAt = new Date().toISOString();
      if (notes) memItem.notes = notes;
      if (prescriptionSummary) memItem.prescriptionSummary = prescriptionSummary;
      if (Array.isArray(chatHistory)) memItem.chatHistory = chatHistory;
      updated = memItem;
    }
  }

  if (!updated) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found',
    });
  }

  // If appointment is marked completed, automatically create a consultation-note HealthRecord
  let consultationRecord = null;
  if (status === 'completed') {
    try {
      consultationRecord = await createConsultationNoteFromAppointment(updated);
    } catch (recErr) {
      console.warn('[Appointment] Auto-creating health record error:', recErr.message);
    }
  }

  res.status(200).json({
    success: true,
    message: `Appointment status updated to ${status}`,
    appointment: updated,
    healthRecord: consultationRecord,
  });
});

/**
 * @desc    Get single appointment details
 * @route   GET /api/appointments/:id
 * @access  Private
 */
export const getAppointmentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let appointment = null;

  try {
    if (mongoose.Types.ObjectId.isValid(id)) {
      appointment = await Appointment.findById(id);
    }
  } catch (err) {
    console.warn('[Appointment] DB get appointment error:', err.message);
  }

  if (!appointment) {
    appointment = inMemoryAppointments.find((a) => a._id === id || a.id === id);
  }

  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found',
    });
  }

  res.status(200).json({
    success: true,
    appointment,
  });
});

export default {
  getDoctors,
  bookAppointment,
  getUpcomingAppointments,
  getPatientAppointments,
  getDoctorQueue,
  updateAppointmentStatus,
  getAppointmentById,
};
