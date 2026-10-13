import PatientAIMemory from '../models/PatientAIMemory.model.js';
import User from '../models/User.model.js';
import HealthRecord from '../models/HealthRecord.model.js';
import Appointment from '../models/Appointment.model.js';
import EmergencyEvent from '../models/EmergencyEvent.model.js';
import mongoose from 'mongoose';

/**
 * Save an AI memory entry for a patient
 */
export const savePatientMemory = async ({
  patientId,
  memoryType,
  content,
  source = 'consultation',
  sourceId = '',
  importance = 5,
  metadata = {},
}) => {
  if (!patientId || !content) return null;

  try {
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(patientId)) {
      const memory = await PatientAIMemory.create({
        patientId,
        memoryType,
        content: content.trim(),
        source,
        sourceId: sourceId ? String(sourceId) : '',
        importance: Math.min(10, Math.max(1, Number(importance) || 5)),
        metadata,
      });
      return memory;
    }
  } catch (err) {
    console.warn('[AIMemory] Save failed:', err.message);
  }
  return null;
};

/**
 * Save a structured consultation summary to AI memory after a completed appointment
 */
export const saveConsultationSummaryMemory = async (appointment) => {
  if (!appointment || !appointment.patientId) return null;

  const notes = appointment.notes || appointment.prescriptionSummary || '';
  const symptoms = appointment.symptomsSummary || '';
  const doctor = appointment.doctorName || 'Doctor';

  const summary = [
    `Consultation with ${doctor} on ${new Date(appointment.completedAt || Date.now()).toLocaleDateString()}:`,
    symptoms ? `Chief Complaints: ${symptoms}.` : null,
    notes ? `Clinical Assessment & Prescription: ${notes}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return await savePatientMemory({
    patientId: appointment.patientId,
    memoryType: 'consultation_summary',
    content: summary,
    source: 'consultation',
    sourceId: appointment._id || appointment.id,
    importance: 8,
    metadata: {
      doctorId: appointment.doctorId,
      doctorName: appointment.doctorName,
      completedAt: appointment.completedAt,
    },
  });
};

/**
 * Retrieve prioritized, relevant clinical context for AI assistance.
 * Adheres strictly to medical source-of-truth priority:
 * Patient Profile -> Health Records -> Prescriptions -> Consultations -> Labs -> Emergency Events -> AI Memory
 *
 * Does NOT dump entire history; extracts only query-relevant facts up to maxItems.
 */
export const getRelevantPatientContextForAI = async (patientId, queryText = '', maxItems = 5) => {
  const context = {
    patientProfile: null,
    allergies: [],
    chronicConditions: [],
    currentMedications: [],
    relevantRecords: [],
    recentEmergencies: [],
    auxiliaryAIMemories: [],
  };

  if (!patientId) return context;

  try {
    // 1. Patient Profile (TOP PRIORITY SOURCE OF TRUTH)
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(patientId)) {
      const user = await User.findById(patientId).select(
        'name age dob gender bloodGroup allergies chronicConditions chronicFlags surgeries currentMedications importantNotes'
      );
      if (user) {
        context.patientProfile = {
          name: user.name,
          age: user.age,
          gender: user.gender,
          bloodGroup: user.bloodGroup,
          surgeries: user.surgeries || [],
          importantNotes: user.importantNotes || '',
        };
        context.allergies = user.allergies || [];
        context.chronicConditions = user.chronicConditions?.length ? user.chronicConditions : user.chronicFlags || [];
        context.currentMedications = user.currentMedications || [];
      }

      // 2. Verified Health Records & Prescriptions
      const records = await HealthRecord.find({ patientId })
        .sort({ date: -1 })
        .limit(10)
        .select('type title textContent notes date');

      // Filter by relevance keywords if query provided
      const queryLower = (queryText || '').toLowerCase();
      const keywords = queryLower.split(/\s+/).filter((w) => w.length > 2);

      let matchedRecords = records;
      if (keywords.length > 0) {
        matchedRecords = records.filter((r) => {
          const str = `${r.title} ${r.textContent} ${r.notes}`.toLowerCase();
          return keywords.some((kw) => str.includes(kw));
        });
        if (matchedRecords.length === 0) {
          matchedRecords = records.slice(0, 3);
        }
      } else {
        matchedRecords = records.slice(0, 3);
      }
      context.relevantRecords = matchedRecords.slice(0, 4);

      // 3. Active Emergency Events
      const emergencies = await EmergencyEvent.find({ patientId })
        .sort({ createdAt: -1 })
        .limit(2)
        .select('riskLevel symptoms reasons status createdAt');
      context.recentEmergencies = emergencies;

      // 4. Auxiliary AI Memory (lowest priority, strictly supportive)
      const memoryQuery = { patientId };
      if (keywords.length > 0) {
        memoryQuery.$or = [
          { content: { $regex: keywords.join('|'), $options: 'i' } },
          { memoryType: { $in: ['allergy', 'chronic_condition', 'consultation_summary'] } },
        ];
      }
      const memories = await PatientAIMemory.find(memoryQuery)
        .sort({ importance: -1, createdAt: -1 })
        .limit(maxItems)
        .select('memoryType content source importance createdAt');

      context.auxiliaryAIMemories = memories;
    }
  } catch (err) {
    console.warn('[AIMemory] Context retrieval failed:', err.message);
  }

  return context;
};

/**
 * Format retrieved medical context as a compact prompt string for LLM injection
 */
export const formatContextForPrompt = (context) => {
  const parts = [];

  if (context.patientProfile) {
    parts.push(
      `Patient Profile: Age ${context.patientProfile.age || 'N/A'}, Gender ${context.patientProfile.gender || 'N/A'}, Blood Group: ${context.patientProfile.bloodGroup || 'Unknown'}`
    );
  }
  if (context.allergies?.length) {
    parts.push(`Known Allergies: ${context.allergies.join(', ')}`);
  }
  if (context.chronicConditions?.length) {
    parts.push(`Known Chronic Conditions: ${context.chronicConditions.join(', ')}`);
  }
  if (context.currentMedications?.length) {
    parts.push(`Active Medications: ${context.currentMedications.join(', ')}`);
  }
  if (context.recentEmergencies?.length) {
    const em = context.recentEmergencies[0];
    parts.push(`Recent Emergency Alert: ${em.riskLevel} (${em.reasons?.join('; ') || 'Threshold triggered'}) - Status: ${em.status}`);
  }
  if (context.relevantRecords?.length) {
    parts.push(
      `Verified Health Records: ` +
        context.relevantRecords
          .map((r) => `[${r.type}] ${r.title}: ${r.textContent?.slice(0, 120) || ''}`)
          .join(' | ')
    );
  }
  if (context.auxiliaryAIMemories?.length) {
    parts.push(
      `Past Clinical Context (Auxiliary): ` +
        context.auxiliaryAIMemories.map((m) => m.content).join('; ')
    );
  }

  return parts.join('\n');
};

export default {
  savePatientMemory,
  saveConsultationSummaryMemory,
  getRelevantPatientContextForAI,
  formatContextForPrompt,
};
