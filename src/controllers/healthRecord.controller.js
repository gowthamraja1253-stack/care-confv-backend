import asyncHandler from '../utils/asyncHandler.js';
import HealthRecord from '../models/HealthRecord.model.js';
import User from '../models/User.model.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { explainMedicalReport } from '../services/aiReportExplanation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-Memory fallback dataset with realistic sample records
export const inMemoryHealthRecords = [
  {
    _id: 'rec-001',
    patientId: 'patient-default',
    type: 'medical-history',
    title: 'Hypertension & Seasonal Allergy History',
    textContent:
      'Patient diagnosed with mild Stage-1 Essential Hypertension in Jan 2024. Advised low sodium diet and regular blood pressure monitoring. Known seasonal allergen: Paddy dust & pollen.',
    fileUrl: '',
    fileName: '',
    fileType: '',
    fileSize: 0,
    doctorId: 'doc-001',
    doctorName: 'Dr. Ananya Sharma',
    appointmentId: null,
    date: new Date(Date.now() - 14 * 86400000).toISOString(),
    tags: ['Chronic Care', 'Cardiology', 'Allergies'],
    notes: 'Next BP checkup recommended in 3 months. Maintain daily step count > 6000.',
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    _id: 'rec-002',
    patientId: 'patient-default',
    type: 'prescription',
    title: 'e-Prescription: Acute Viral Flu Treatment',
    textContent:
      'Rx:\n1. Tab Paracetamol 500mg - 1 tablet three times daily after food x 3 days\n2. Tab Cetirizine 10mg - 1 tablet at bedtime x 3 days\n3. ORS sachet - 1 packet dissolved in 1L clean drinking water throughout the day\n4. Steam inhalation twice daily.',
    fileUrl: '',
    fileName: 'prescription_dr_ananya_08.pdf',
    fileType: 'application/pdf',
    fileSize: 245000,
    doctorId: 'doc-001',
    doctorName: 'Dr. Ananya Sharma',
    appointmentId: 'apt-001',
    date: new Date(Date.now() - 2 * 86400000).toISOString(),
    tags: ['Fever', 'Teleconsultation', 'Prescription'],
    notes: 'Pharmacy verified at Rampur Village Sub-Centre.',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    _id: 'rec-003',
    patientId: 'patient-default',
    type: 'test-result',
    title: 'Complete Blood Count (CBC) & HbA1c Lab Report',
    textContent:
      'Haemoglobin: 13.8 g/dL (Normal: 13.0 - 17.0)\nWBC Count: 6,800 /uL (Normal: 4,000 - 11,000)\nPlatelets: 220,000 /uL (Normal: 150,000 - 450,000)\nFasting Blood Glucose: 98 mg/dL (Normal < 100)\nHbA1c: 5.6% (Normal < 5.7% - Non-Diabetic)',
    fileUrl: '',
    fileName: 'lab_cbc_report_rampur_phc.pdf',
    fileType: 'application/pdf',
    fileSize: 512000,
    doctorId: 'doc-002',
    doctorName: 'Primary Health Centre Lab',
    appointmentId: null,
    date: new Date(Date.now() - 7 * 86400000).toISOString(),
    tags: ['Blood Test', 'CBC', 'PHC Diagnostics', 'Routine'],
    notes: 'All hematological indices within normal clinical ranges.',
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    _id: 'rec-004',
    patientId: 'patient-default',
    type: 'consultation-note',
    title: 'Consultation Note: Pediatric & Allergic Rhinitis Review',
    textContent:
      'Clinical Assessment: Patient presented with 4-day history of clear rhinorrhea, sneezing paroxysms, and nocturnal dry cough.\n\nDiagnosis: Allergic Rhinitis with secondary mild pharyngeal irritation.\n\nAdvice:\n- Avoid exposure to early morning damp air & crop residue smoke\n- Continue warm saline gargles\n- Prescribed Levocetirizine and Vitamin C supplements.',
    fileUrl: '',
    fileName: '',
    fileType: '',
    fileSize: 0,
    doctorId: 'doc-002',
    doctorName: 'Dr. Rajesh Patel',
    appointmentId: 'apt-002',
    date: new Date(Date.now() - 1 * 86400000).toISOString(),
    tags: ['Teleconsultation', 'Pediatrics', 'Allergy'],
    notes: 'Follow-up via audio call if cough persists beyond 5 days.',
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

/**
 * Helper to auto-create a consultation note HealthRecord when an appointment completes
 */
export const createConsultationNoteFromAppointment = async (appointment) => {
  if (!appointment) return null;

  const patientId = appointment.patientId || 'patient-default';
  const doctorId = appointment.doctorId || null;
  const doctorName = appointment.doctorName || 'Consulting Physician';
  const appointmentId = appointment._id || appointment.id || null;

  const title = `Consultation Note: ${doctorName}`;
  const textContent = [
    `Patient: ${appointment.patientName || 'Patient'} (Age: ${appointment.patientAge || 'N/A'}, ${appointment.patientVillage || 'Village'})`,
    `Slot: ${appointment.slot?.slotLabel || appointment.slot?.time || 'Completed Slot'}`,
    appointment.symptomsSummary ? `Chief Complaints: ${appointment.symptomsSummary}` : null,
    appointment.notes ? `Doctor Assessment & Notes:\n${appointment.notes}` : null,
    appointment.prescriptionSummary ? `Prescribed Regimen:\n${appointment.prescriptionSummary}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  const notes = appointment.notes || 'Teleconsultation completed successfully.';
  const recordDate = appointment.completedAt ? new Date(appointment.completedAt) : new Date();

  // 1. Try DB insertion
  if (mongoose.connection.readyState === 1) {
    try {
      // Check if consultation note already exists for this appointment
      if (appointmentId && mongoose.Types.ObjectId.isValid(appointmentId)) {
        const existing = await HealthRecord.findOne({
          appointmentId: new mongoose.Types.ObjectId(appointmentId),
          type: 'consultation-note',
        });
        if (existing) {
          existing.textContent = textContent;
          existing.notes = notes;
          await existing.save();
          return existing;
        }

        const newRec = await HealthRecord.create({
          patientId: mongoose.Types.ObjectId.isValid(patientId)
            ? new mongoose.Types.ObjectId(patientId)
            : new mongoose.Types.ObjectId(),
          type: 'consultation-note',
          title,
          textContent,
          doctorId: doctorId && mongoose.Types.ObjectId.isValid(doctorId)
            ? new mongoose.Types.ObjectId(doctorId)
            : null,
          doctorName,
          appointmentId: new mongoose.Types.ObjectId(appointmentId),
          date: recordDate,
          tags: ['Teleconsultation', 'Doctor Notes', appointment.doctorSpecialization || 'General'],
          notes,
        });
        return newRec;
      }
    } catch (err) {
      console.warn('[HealthRecord] Error auto-creating note in DB:', err.message);
    }
  }

  // 2. In-Memory fallback insertion
  const existingMem = inMemoryHealthRecords.find(
    (r) => r.appointmentId === (appointment._id || appointment.id) && r.type === 'consultation-note'
  );
  if (existingMem) {
    existingMem.textContent = textContent;
    existingMem.notes = notes;
    return existingMem;
  }

  const memRec = {
    _id: 'rec-' + Date.now(),
    patientId: patientId.toString(),
    type: 'consultation-note',
    title,
    textContent,
    fileUrl: '',
    fileName: '',
    fileType: '',
    fileSize: 0,
    doctorId: doctorId ? doctorId.toString() : 'doc-001',
    doctorName,
    appointmentId: appointmentId ? appointmentId.toString() : null,
    date: recordDate.toISOString(),
    tags: ['Teleconsultation', 'Doctor Notes', appointment.doctorSpecialization || 'General'],
    notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  inMemoryHealthRecords.unshift(memRec);
  return memRec;
};

/**
 * @desc    Create a new health record (with optional file upload or text notes)
 * @route   POST /api/health-records
 * @access  Private
 */
export const createHealthRecord = asyncHandler(async (req, res) => {
  const {
    type,
    title,
    textContent = '',
    doctorId,
    doctorName = '',
    patientId: bodyPatientId,
    appointmentId,
    date,
    tags,
    notes = '',
  } = req.body;

  const user = req.user || {};
  const isDoctor = user.role === 'doctor' || user.role === 'admin';

  if (isDoctor && !bodyPatientId) {
    return res.status(400).json({
      success: false,
      message: 'Please select a patient for this health record',
    });
  }

  // If a doctor or admin is uploading, use the selected patient. If patient, use their own _id.
  const targetPatientId = (isDoctor && bodyPatientId)
    ? bodyPatientId
    : (user._id || user.id || 'patient-default');

  const validTypes = ['medical-history', 'prescription', 'test-result', 'consultation-note'];
  if (!type || !validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      message: `Invalid record type. Must be one of: ${validTypes.join(', ')}`,
    });
  }

  if (!title || !title.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Record title is required',
    });
  }

  let fileUrl = '';
  let fileName = '';
  let fileType = '';
  let fileSize = 0;

  if (req.file) {
    fileUrl = `/uploads/records/${req.file.filename}`;
    fileName = req.file.originalname;
    fileType = req.file.mimetype;
    fileSize = req.file.size;
  }

  // Parse tags if passed as JSON string or comma separated
  let parsedTags = [];
  if (Array.isArray(tags)) {
    parsedTags = tags;
  } else if (typeof tags === 'string' && tags.trim()) {
    try {
      parsedTags = JSON.parse(tags);
    } catch {
      parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);
    }
  }

  const finalDoctorName = isDoctor
    ? (user.name?.startsWith('Dr.') ? user.name : `Dr. ${user.name || 'Doctor'}`)
    : (doctorName ? doctorName.trim() : '');
  const finalDoctorId = isDoctor
    ? user._id
    : (doctorId && mongoose.Types.ObjectId.isValid(doctorId) ? new mongoose.Types.ObjectId(doctorId) : null);

  const isPatientMongoId = mongoose.Types.ObjectId.isValid(targetPatientId);

  const recordData = {
    patientId: isPatientMongoId ? new mongoose.Types.ObjectId(targetPatientId) : targetPatientId,
    type,
    title: title.trim(),
    textContent: textContent.trim(),
    fileUrl,
    fileName,
    fileType,
    fileSize,
    doctorId: finalDoctorId,
    doctorName: finalDoctorName,
    appointmentId: appointmentId && mongoose.Types.ObjectId.isValid(appointmentId) ? new mongoose.Types.ObjectId(appointmentId) : null,
    date: date ? new Date(date) : new Date(),
    tags: parsedTags,
    notes: notes.trim(),
  };

  let savedRecord = null;

  if (mongoose.connection.readyState === 1) {
    try {
      savedRecord = await HealthRecord.create({
        ...recordData,
        patientId: isPatientMongoId
          ? new mongoose.Types.ObjectId(targetPatientId)
          : new mongoose.Types.ObjectId(),
      });
      await savedRecord.populate('patientId', 'name village phone email');
    } catch (dbErr) {
      console.warn('[HealthRecord] DB create error, falling back to memory store:', dbErr.message);
    }
  }

  if (!savedRecord) {
    savedRecord = {
      _id: 'rec-' + Date.now(),
      ...recordData,
      date: recordData.date.toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    inMemoryHealthRecords.unshift(savedRecord);
  }

  res.status(201).json({
    success: true,
    message: 'Health record created successfully',
    record: savedRecord,
  });
});

/**
 * @desc    Get all health records for patient (with tab filtering and summary counts)
 * @route   GET /api/health-records/patient
 * @access  Private
 */
export const getPatientHealthRecords = asyncHandler(async (req, res) => {
  const { type, search, patientId: queryPatientId } = req.query;
  const user = req.user;
  const userId = user?._id || user?.id;
  const isDoctor = user?.role === 'doctor' || user?.role === 'admin';

  let records = [];

  if (mongoose.connection.readyState === 1) {
    try {
      const query = {};

      if (isDoctor) {
        // If doctor provided a specific patientId filter
        if (queryPatientId && mongoose.Types.ObjectId.isValid(queryPatientId)) {
          query.patientId = new mongoose.Types.ObjectId(queryPatientId);
        }
      } else {
        // Patients only see their own records
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
          query.patientId = new mongoose.Types.ObjectId(userId);
        }
      }

      if (type && type !== 'all') {
        query.type = type;
      }
      if (search && search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        query.$or = [{ title: regex }, { textContent: regex }, { doctorName: regex }, { tags: regex }];
      }

      const dbRecords = await HealthRecord.find(query)
        .populate('patientId', 'name village phone email')
        .sort({ date: -1, createdAt: -1 });

      records = dbRecords.map((r) => {
        const doc = r.toObject ? r.toObject() : r;
        return {
          ...doc,
          patientName: doc.patientId?.name || '',
          patientVillage: doc.patientId?.village || '',
        };
      });
    } catch (err) {
      console.warn('[HealthRecord] DB find error, using in-memory store:', err.message);
    }
  }

  if (!records || records.length === 0) {
    let memList = [...inMemoryHealthRecords];
    if (type && type !== 'all') {
      memList = memList.filter((r) => r.type === type);
    }
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      memList = memList.filter(
        (r) =>
          r.title?.toLowerCase().includes(s) ||
          r.textContent?.toLowerCase().includes(s) ||
          r.doctorName?.toLowerCase().includes(s) ||
          r.tags?.some((tag) => tag.toLowerCase().includes(s))
      );
    }
    records = memList;
  }

  // Calculate summary counts across all categories
  const allList = records;
  const counts = {
    all: allList.length,
    'medical-history': allList.filter((r) => r.type === 'medical-history').length,
    prescription: allList.filter((r) => r.type === 'prescription').length,
    'test-result': allList.filter((r) => r.type === 'test-result').length,
    'consultation-note': allList.filter((r) => r.type === 'consultation-note').length,
  };

  res.status(200).json({
    success: true,
    count: records.length,
    counts,
    records,
  });
});

/**
 * @desc    Get list of patients for doctors/workers
 * @route   GET /api/health-records/patients
 * @access  Private (Doctor/Admin)
 */
export const getPatientsList = asyncHandler(async (req, res) => {
  let patients = [];
  if (mongoose.connection.readyState === 1) {
    try {
      patients = await User.find({ role: 'patient' })
        .select('_id name phone email village age gender identifier')
        .sort({ name: 1 });
    } catch (err) {
      console.warn('[HealthRecord] Error getting patients list:', err.message);
    }
  }

  if (!patients || patients.length === 0) {
    patients = [
      { _id: '6aa01fd20e01b8350e9c06c5', name: 'Rameshwar Kumar', phone: '9876543210', village: 'Kalyanpur Health Hub', age: 42, gender: 'Male' },
      { _id: '6ab169c539dda989d66c5d63', name: 'Gengavarajan', phone: '9876543211', village: 'Retteri , Kolathur', age: 36, gender: 'Male' },
    ];
  }

  res.status(200).json({
    success: true,
    count: patients.length,
    patients,
  });
});


/**
 * @desc    Get single health record details
 * @route   GET /api/health-records/:id
 * @access  Private
 */
export const getHealthRecordById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let record = null;

  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
    try {
      record = await HealthRecord.findById(id);
    } catch (err) {
      console.warn('[HealthRecord] DB get error:', err.message);
    }
  }

  if (!record) {
    record = inMemoryHealthRecords.find((r) => r._id === id || r.id === id);
  }

  if (!record) {
    return res.status(404).json({
      success: false,
      message: 'Health record not found',
    });
  }

  // Authorization check: doctors/admins can view any record; patients can only view their own
  const isDoctorOrAdmin = req.user?.role === 'doctor' || req.user?.role === 'admin';
  const recordPatientId = record.patientId?._id ? record.patientId._id.toString() : (record.patientId?.toString() || '');
  const requestingUserId = (req.user?._id || req.user?.id || '').toString();

  if (!isDoctorOrAdmin && recordPatientId && requestingUserId && recordPatientId !== requestingUserId) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You are not authorized to view this patient health record',
    });
  }

  res.status(200).json({
    success: true,
    record,
  });
});

/**
 * @desc    Delete health record and remove uploaded file if present
 * @route   DELETE /api/health-records/:id
 * @access  Private
 */
export const deleteHealthRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // First fetch the record to verify ownership
  let recordToDelete = null;
  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
    try {
      recordToDelete = await HealthRecord.findById(id);
    } catch (err) {
      console.warn('[HealthRecord] DB find before delete error:', err.message);
    }
  }
  if (!recordToDelete) {
    recordToDelete = inMemoryHealthRecords.find((r) => r._id === id || r.id === id);
  }

  if (!recordToDelete) {
    return res.status(404).json({
      success: false,
      message: 'Health record not found',
    });
  }

  // Authorization check: doctors/admins can delete; patients can only delete their own records
  const isDoctorOrAdmin = req.user?.role === 'doctor' || req.user?.role === 'admin';
  const recordPatientId = recordToDelete.patientId?._id ? recordToDelete.patientId._id.toString() : (recordToDelete.patientId?.toString() || '');
  const requestingUserId = (req.user?._id || req.user?.id || '').toString();

  if (!isDoctorOrAdmin && recordPatientId && requestingUserId && recordPatientId !== requestingUserId) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You are not authorized to delete this patient health record',
    });
  }

  let deleted = null;

  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
    try {
      deleted = await HealthRecord.findByIdAndDelete(id);
    } catch (err) {
      console.warn('[HealthRecord] DB delete error:', err.message);
    }
  }

  const memIndex = inMemoryHealthRecords.findIndex((r) => r._id === id || r.id === id);
  if (memIndex !== -1) {
    deleted = inMemoryHealthRecords.splice(memIndex, 1)[0];
  }

  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: 'Health record not found',
    });
  }

  // If local file was uploaded, attempt to clean up file from storage
  if (deleted.fileUrl && deleted.fileUrl.startsWith('/uploads/records/')) {
    try {
      const filePath = path.resolve(__dirname, '../../', deleted.fileUrl.replace(/^\//, ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fileErr) {
      console.warn('[HealthRecord] Error cleaning up file:', fileErr.message);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Health record deleted successfully',
    recordId: id,
  });
});

/**
 * @desc    Generate AI plain-language explanation for prescription or test-result record
 * @route   POST /api/health-records/:id/explain
 * @access  Private
 */
export const explainHealthRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const preferredLanguage =
    req.body.preferredLanguage ||
    req.query.lang ||
    req.user?.preferredLanguage ||
    'en';
  const forceRefresh = req.body.forceRefresh === true || req.query.refresh === 'true';

  let record = null;

  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
    try {
      record = await HealthRecord.findById(id);
    } catch (err) {
      console.warn('[HealthRecord] DB find error in explain:', err.message);
    }
  }

  if (!record) {
    record = inMemoryHealthRecords.find((r) => r._id === id || r.id === id);
  }

  if (!record) {
    return res.status(404).json({
      success: false,
      message: 'Health record not found',
    });
  }

  const langCode = preferredLanguage.toLowerCase().substring(0, 2);

  // Check if explanation is already cached on the record for this language
  if (!forceRefresh && record.aiExplanation && record.aiExplanation.summary && record.aiExplanation.language === langCode) {
    return res.status(200).json({
      success: true,
      explanation: record.aiExplanation,
      cached: true,
    });
  }

  // Generate explanation via AI Service
  const explanation = await explainMedicalReport({
    recordType: record.type,
    title: record.title,
    textContent: record.textContent,
    notes: record.notes,
    preferredLanguage,
  });

  const aiExplanationData = {
    ...explanation,
    language: langCode,
    generatedAt: new Date(),
  };

  // Save to DB or in-memory
  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
    try {
      await HealthRecord.findByIdAndUpdate(id, { aiExplanation: aiExplanationData });
    } catch (dbErr) {
      console.warn('[HealthRecord] DB update aiExplanation error:', dbErr.message);
    }
  }

  record.aiExplanation = aiExplanationData;

  res.status(200).json({
    success: true,
    explanation: aiExplanationData,
    cached: false,
  });
});

export default {
  createHealthRecord,
  getPatientHealthRecords,
  getHealthRecordById,
  deleteHealthRecord,
  explainHealthRecord,
  createConsultationNoteFromAppointment,
};
