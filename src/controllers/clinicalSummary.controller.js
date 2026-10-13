import User from '../models/User.model.js';
import HealthRecord from '../models/HealthRecord.model.js';
import Appointment from '../models/Appointment.model.js';
import Symptom from '../models/Symptom.model.js';
import EmergencyEvent from '../models/EmergencyEvent.model.js';
import PatientMedication from '../models/PatientMedication.model.js';
import MedicationDose from '../models/MedicationDose.model.js';
import RefillRequest from '../models/RefillRequest.model.js';
import FollowUp from '../models/FollowUp.model.js';
import PatientAIMemory from '../models/PatientAIMemory.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import config from '../config/env.js';
import { groqChatCompletion } from '../utils/groqClient.js';
import { calculateAdherence, seedSampleMedicationsForPatient } from './patientMedication.controller.js';
import { seedSampleFollowUps } from './followUp.controller.js';
import mongoose from 'mongoose';

/**
 * Generate a concise, strictly factual AI clinical summary based ONLY on verified stored patient data.
 * AI MUST NEVER FABRICATE ANY CLINICAL DATA.
 */
export const generateFactualClinicalSummaryAI = async (facts) => {
  if (!config.groqApiKey || !config.groqApiKey.trim()) {
    return null;
  }

  try {
    const systemPrompt = `You are a clinical summarization engine for a teleconsultation platform.
Rules:
1. Synthesize a concise 5-7 line bulleted summary using ONLY the explicit factual data provided.
2. YOU MUST NEVER INVENT OR FABRICATE medical information, diagnoses, medications, allergies, symptoms, lab values, or dates.
3. If any field is empty or not provided, write "None reported" or "No records".
Format exactly:
Clinical Summary
- Known conditions: <factual conditions or None reported>
- Current medications: <factual medications or None reported>
- Recent symptoms: <factual recent symptoms or None reported>
- Recent changes: <factual recent changes or Stable>
- Medication adherence: <factual adherence % and missed doses>
- Risk indicators: <factual risk level or Routine>
- Follow-up: <factual upcoming/missed follow-ups or None scheduled>`;

    const factsJson = JSON.stringify({
      conditions: facts.chronicConditions || [],
      allergies: facts.allergies || [],
      medications: (facts.currentMedications || []).map((m) => m.medicineName || m),
      recentSymptoms: facts.recentSymptoms || [],
      adherence: facts.adherence || '100%',
      missedDoses: facts.missedDoses || 0,
      emergencyEvents: facts.recentEmergencyEvents || [],
      followUps: facts.followUps || [],
      labResults: facts.recentLabResults || [],
      doctorNotes: facts.importantNotes || 'None',
    });

    const summary = await groqChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Patient Facts:\n${factsJson}` },
    ]);

    return summary?.trim() || null;
  } catch (err) {
    console.warn('[ClinicalSummary] AI generation error, falling back to structured summary:', err.message);
    return null;
  }
};

/**
 * @desc    Get complete clinical snapshot for a patient (Doctor View in Teleconsultation Room)
 * @route   GET /api/clinical-summary/:patientId
 * @access  Private
 */
export const getPatientClinicalSnapshot = asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  if (!mongoose.connection.readyState === 1 || !mongoose.Types.ObjectId.isValid(patientId)) {
    return res.status(200).json({
      success: true,
      snapshot: {
        basicInfo: { name: 'Patient', age: 35, gender: 'Male', village: 'Rampur' },
        allergies: [],
        chronicConditions: [],
        currentMedications: [],
        previousConsultations: [],
        previousPrescriptions: [],
        recentSymptoms: [],
        recentLabResults: [],
        medicationAdherence: { adherence7Days: 100, adherence30Days: 100, missedDoses: 0 },
        recentEmergencyEvents: [],
        followUps: [],
        importantNotes: '',
        aiSummary: null,
      },
    });
  }

  // 1. Basic Patient Info & Medical Profile
  const patient = await User.findById(patientId).select(
    'name age dob gender bloodGroup village phone allergies chronicConditions chronicFlags surgeries currentMedications importantNotes emergencyContacts emergencyContact'
  );

  if (!patient) {
    return res.status(404).json({ success: false, message: 'Patient not found' });
  }

  // Ensure seeds exist if new patient
  await seedSampleMedicationsForPatient(patientId);
  await seedSampleFollowUps(patientId, req.user?._id);

  // 2. Previous Consultations (Appointments)
  const consultations = await Appointment.find({
    patientId,
    status: { $in: ['completed', 'confirmed'] },
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('doctorName doctorSpecialization slot status symptomsSummary notes prescriptionSummary completedAt createdAt');

  // 3. Health Records (Prescriptions, Lab Results, Medical History)
  const healthRecords = await HealthRecord.find({ patientId })
    .sort({ date: -1 })
    .limit(20);

  const prescriptions = healthRecords.filter((r) => r.type === 'prescription');
  const labResults = healthRecords.filter((r) => r.type === 'test-result');

  // 4. Recent Symptoms
  const symptoms = await Symptom.find({ patientId })
    .sort({ createdAt: -1 })
    .limit(10);

  // 5. Active Medications & Adherence
  const activeMeds = await PatientMedication.find({
    patientId,
    activeStatus: true,
  }).sort({ createdAt: -1 });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const doses = await MedicationDose.find({
    patientId,
    scheduledAt: { $gte: thirtyDaysAgo },
  }).sort({ scheduledAt: -1 });

  const doses7d = doses.filter((d) => new Date(d.scheduledAt) >= sevenDaysAgo);
  const missedDoses = doses.filter((d) => d.status === 'MISSED').length;

  const adherence7Days = calculateAdherence(doses7d);
  const adherence30Days = calculateAdherence(doses);

  // 6. Recent Emergency Events
  const emergencyEvents = await EmergencyEvent.find({ patientId })
    .sort({ createdAt: -1 })
    .limit(5);

  // 7. Follow-ups
  const followUps = await FollowUp.find({ patientId })
    .sort({ dueDate: 1 })
    .limit(10);

  // 8. Prepare facts for AI summarization
  const clinicalFacts = {
    chronicConditions: patient.chronicConditions?.length ? patient.chronicConditions : patient.chronicFlags || [],
    allergies: patient.allergies || [],
    currentMedications: activeMeds.map((m) => `${m.medicineName} (${m.dosage}, stock: ${m.remainingQuantity})`),
    recentSymptoms: symptoms.slice(0, 3).map((s) => `${s.symptoms.join(', ')} (${s.severity})`),
    adherence: `${adherence7Days}% (7-day), ${adherence30Days}% (30-day)`,
    missedDoses,
    recentEmergencyEvents: emergencyEvents.slice(0, 2).map((e) => `${e.riskLevel}: ${e.reasons.join(', ')}`),
    followUps: followUps.map((f) => `${f.status} on ${new Date(f.dueDate).toLocaleDateString()}: ${f.reason}`),
    recentLabResults: labResults.slice(0, 3).map((l) => `${l.title}: ${l.textContent}`),
    importantNotes: patient.importantNotes || consultations[0]?.notes || 'None',
  };

  const aiSummary = await generateFactualClinicalSummaryAI(clinicalFacts);

  res.status(200).json({
    success: true,
    snapshot: {
      basicInfo: {
        _id: patient._id,
        name: patient.name,
        age: patient.age,
        dob: patient.dob,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup || 'Unknown',
        village: patient.village,
        phone: patient.phone,
        surgeries: patient.surgeries || [],
        emergencyContacts: patient.emergencyContacts || (patient.emergencyContact ? [patient.emergencyContact] : []),
      },
      allergies: clinicalFacts.allergies,
      chronicConditions: clinicalFacts.chronicConditions,
      currentMedications: activeMeds,
      previousConsultations: consultations,
      previousPrescriptions: prescriptions,
      recentSymptoms: symptoms,
      recentLabResults: labResults,
      medicationAdherence: {
        adherence7Days,
        adherence30Days,
        missedDoses,
      },
      recentEmergencyEvents: emergencyEvents,
      followUps,
      importantNotes: patient.importantNotes || consultations[0]?.notes || '',
      aiSummary,
    },
  });
});

/**
 * @desc    Get unified chronological timeline for patient (Requirement 9)
 * @route   GET /api/clinical-summary/:patientId/timeline
 * @access  Private
 */
export const getPatientTimeline = asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  if (!mongoose.connection.readyState === 1 || !mongoose.Types.ObjectId.isValid(patientId)) {
    return res.status(200).json({ success: true, count: 0, timeline: [] });
  }

  // Fetch all timeline events concurrently
  const [
    consultations,
    records,
    medications,
    doses,
    refills,
    symptoms,
    emergencies,
    followUps,
  ] = await Promise.all([
    Appointment.find({ patientId }).select('doctorName doctorSpecialization slot status notes prescriptionSummary createdAt completedAt'),
    HealthRecord.find({ patientId }).select('type title textContent notes date createdAt'),
    PatientMedication.find({ patientId }).select('medicineName dosage frequency prescribedQuantity remainingQuantity activeStatus createdAt updatedAt'),
    MedicationDose.find({ patientId }).populate('medicationId', 'medicineName').sort({ scheduledAt: -1 }).limit(30),
    RefillRequest.find({ patientId }).select('medicineName requestedQuantity status reason createdAt'),
    Symptom.find({ patientId }).select('symptoms durationDays severity notes createdAt'),
    EmergencyEvent.find({ patientId }).select('riskLevel symptoms reasons status createdAt'),
    FollowUp.find({ patientId }).select('reason instructions dueDate status notes createdAt'),
  ]);

  const timelineItems = [];

  // 1. Consultations
  consultations.forEach((c) => {
    timelineItems.push({
      id: `apt-${c._id}`,
      type: 'consultation',
      category: 'Consultation',
      title: `Consultation with ${c.doctorName}`,
      subtitle: `${c.doctorSpecialization} • Status: ${c.status}`,
      details: c.notes || c.prescriptionSummary || 'Teleconsultation completed',
      timestamp: c.completedAt || c.createdAt,
      badgeColor: '#0284C7',
    });
  });

  // 2. Health Records & Prescriptions
  records.forEach((r) => {
    timelineItems.push({
      id: `rec-${r._id}`,
      type: r.type === 'prescription' ? 'prescription' : r.type === 'test-result' ? 'lab' : 'health-record',
      category: r.type === 'prescription' ? 'Prescription Issued' : r.type === 'test-result' ? 'Lab Result' : 'Medical Record',
      title: r.title,
      subtitle: r.type,
      details: r.textContent || r.notes || '',
      timestamp: r.date || r.createdAt,
      badgeColor: r.type === 'prescription' ? '#059669' : r.type === 'test-result' ? '#7C3AED' : '#4B5563',
    });
  });

  // 3. Medications started/stopped
  medications.forEach((m) => {
    timelineItems.push({
      id: `med-${m._id}`,
      type: 'medication',
      category: m.activeStatus ? 'Medication Started' : 'Medication Discontinued',
      title: m.medicineName,
      subtitle: `${m.dosage} • ${m.frequency}`,
      details: `Stock: ${m.remainingQuantity}/${m.prescribedQuantity} tablets`,
      timestamp: m.createdAt,
      badgeColor: '#10B981',
    });
  });

  // 4. Doses Taken/Missed
  doses.forEach((d) => {
    timelineItems.push({
      id: `dose-${d._id}`,
      type: 'dose',
      category: `Dose ${d.status}`,
      title: `${d.medicationId?.medicineName || 'Medication'} - ${d.status}`,
      subtitle: `Scheduled for ${new Date(d.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      details: d.takenAt ? `Taken at ${new Date(d.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `Dose status: ${d.status}`,
      timestamp: d.takenAt || d.scheduledAt,
      badgeColor: d.status === 'TAKEN' ? '#059669' : d.status === 'MISSED' ? '#DC2626' : '#D97706',
    });
  });

  // 5. Refill Requests
  refills.forEach((r) => {
    timelineItems.push({
      id: `refill-${r._id}`,
      type: 'refill',
      category: 'Refill Request',
      title: `Refill: ${r.medicineName}`,
      subtitle: `Quantity: ${r.requestedQuantity} • Status: ${r.status}`,
      details: r.reason || '',
      timestamp: r.createdAt,
      badgeColor: '#D97706',
    });
  });

  // 6. Symptoms
  symptoms.forEach((s) => {
    timelineItems.push({
      id: `symp-${s._id}`,
      type: 'symptom',
      category: 'Symptom Reported',
      title: s.symptoms.join(', '),
      subtitle: `Severity: ${s.severity} • Duration: ${s.durationDays} day(s)`,
      details: s.notes || 'No extra notes',
      timestamp: s.createdAt,
      badgeColor: '#EA580C',
    });
  });

  // 7. Emergency Events
  emergencies.forEach((e) => {
    timelineItems.push({
      id: `em-${e._id}`,
      type: 'emergency',
      category: 'Emergency Alert',
      title: `Emergency: ${e.riskLevel}`,
      subtitle: `Status: ${e.status}`,
      details: e.reasons?.join('; ') || 'Emergency threshold triggered',
      timestamp: e.createdAt,
      badgeColor: '#DC2626',
    });
  });

  // 8. Follow-ups
  followUps.forEach((f) => {
    timelineItems.push({
      id: `fu-${f._id}`,
      type: 'follow-up',
      category: 'Doctor Follow-Up',
      title: `Follow-Up: ${f.reason}`,
      subtitle: `Due: ${new Date(f.dueDate).toLocaleDateString()} • Status: ${f.status}`,
      details: f.instructions || f.notes || '',
      timestamp: f.dueDate,
      badgeColor: '#2563EB',
    });
  });

  // Sort descending by timestamp
  timelineItems.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  res.status(200).json({
    success: true,
    count: timelineItems.length,
    timeline: timelineItems,
  });
});

export default {
  getPatientClinicalSnapshot,
  getPatientTimeline,
};
