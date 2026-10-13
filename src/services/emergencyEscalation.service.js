import EmergencyEvent from '../models/EmergencyEvent.model.js';
import User from '../models/User.model.js';
import { getIO } from './socket.js';
import config from '../config/env.js';
import { groqChatCompletion } from '../utils/groqClient.js';
import mongoose from 'mongoose';

/**
 * Deterministic Emergency Symptom Patterns
 */
export const DETERMINISTIC_EMERGENCY_RULES = [
  {
    pattern: /chest\s*pain|angina|heart\s*attack|crushing\s*chest/i,
    category: 'Cardiovascular Emergency',
    reason: 'Severe chest pain / possible acute coronary syndrome detected',
  },
  {
    pattern: /difficulty\s*breath|shortness\s*of\s*breath|gasping|cannot\s*breathe|respiratory\s*arrest/i,
    category: 'Respiratory Emergency',
    reason: 'Severe breathing difficulty or respiratory compromise detected',
  },
  {
    pattern: /unconscious|loss\s*of\s*consciousness|fainted|unresponsive|passed\s*out/i,
    category: 'Neurological / Consciousness Emergency',
    reason: 'Loss of consciousness / unresponsiveness reported',
  },
  {
    pattern: /seizure|convulsion|epilep|fit/i,
    category: 'Neurological Emergency',
    reason: 'Active seizure or acute convulsion reported',
  },
  {
    pattern: /severe\s*bleed|heavy\s*bleed|hemorrhage|arterial\s*bleed|coughing\s*blood/i,
    category: 'Hemorrhagic Emergency',
    reason: 'Severe or uncontrollable bleeding detected',
  },
  {
    pattern: /stroke|facial\s*droop|slurred\s*speech|one-sided\s*weakness|hemiplegia|paralysis/i,
    category: 'Cerebrovascular Emergency',
    reason: 'Stroke-like symptoms (FAST warning signs: face droop, slurred speech, sudden weakness)',
  },
  {
    pattern: /severe\s*allergic|anaphylax|swollen\s*throat|swollen\s*tongue|throat\s*closing/i,
    category: 'Anaphylaxis Emergency',
    reason: 'Severe allergic reaction with possible airway obstruction',
  },
  {
    pattern: /serious\s*trauma|head\s*injury|skull\s*fracture|open\s*fracture|major\s*accident/i,
    category: 'Trauma Emergency',
    reason: 'Serious traumatic physical injury or head trauma reported',
  },
  {
    pattern: /self-harm|suicid|harming\s*myself|end\s*my\s*life/i,
    category: 'Psychiatric / Self-Harm Emergency',
    reason: 'Self-harm or acute psychological crisis emergency detected',
  },
];

/**
 * Deterministic Rule Evaluation
 */
export const evaluateDeterministicRules = (symptoms = [], severity = 'mild', notes = '') => {
  const combinedText = [
    ...(Array.isArray(symptoms) ? symptoms : [String(symptoms)]),
    notes || '',
  ].join(' ');

  const triggeredReasons = [];
  let isSevere = severity?.toLowerCase() === 'severe';

  for (const rule of DETERMINISTIC_EMERGENCY_RULES) {
    if (rule.pattern.test(combinedText)) {
      triggeredReasons.push(rule.reason);
    }
  }

  if (triggeredReasons.length > 0) {
    return {
      isEmergency: true,
      riskLevel: 'EMERGENCY',
      reasons: triggeredReasons,
      requiresEscalation: true,
      source: 'deterministic-rules',
    };
  }

  return {
    isEmergency: false,
    riskLevel: isSevere ? 'HIGH' : 'MODERATE',
    reasons: [],
    requiresEscalation: false,
    source: 'deterministic-rules',
  };
};

/**
 * AI-Assisted Risk Classification
 */
export const evaluateAIClassification = async (symptoms = [], severity = 'mild', notes = '', deterministicResult = null) => {
  // If deterministic rules already found an EMERGENCY, AI cannot de-escalate it
  if (deterministicResult?.isEmergency) {
    return {
      riskLevel: 'EMERGENCY',
      reasons: deterministicResult.reasons,
      requiresEscalation: true,
      source: 'hybrid-deterministic-priority',
    };
  }

  // Attempt Groq LLM classification if configured
  if (config.groqApiKey && config.groqApiKey.trim()) {
    try {
      const prompt = `You are a clinical emergency triage evaluator.
Assess the patient symptoms and notes.
Return ONLY valid JSON:
{
  "riskLevel": "LOW" | "MODERATE" | "HIGH" | "EMERGENCY",
  "reasons": ["short clinical reason 1", "reason 2"],
  "requiresEscalation": true | false
}

Rules:
- "EMERGENCY": life-threatening, acute airway/breathing/circulatory distress, severe trauma, stroke, poisoning, suicidal intent. requiresEscalation must be true.
- "HIGH": severe pain, high fever with breathlessness, high dehydration risk, needing urgent doctor consult today.
- "MODERATE": standard clinical consult needed within 24-48 hours.
- "LOW": mild self-limiting complaints.
Do not recommend medications.`;

      const userContent = `Symptoms: ${Array.isArray(symptoms) ? symptoms.join(', ') : symptoms}\nSeverity: ${severity}\nNotes: ${notes || 'None'}`;

      const aiResponse = await groqChatCompletion([
        { role: 'system', content: prompt },
        { role: 'user', content: userContent },
      ]);

      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const validLevels = ['LOW', 'MODERATE', 'HIGH', 'EMERGENCY'];
        const riskLevel = validLevels.includes(parsed.riskLevel) ? parsed.riskLevel : 'MODERATE';
        const requiresEscalation = Boolean(parsed.requiresEscalation || riskLevel === 'EMERGENCY');

        return {
          riskLevel,
          reasons: Array.isArray(parsed.reasons) ? parsed.reasons : ['AI triage clinical classification'],
          requiresEscalation,
          source: 'groq-ai',
        };
      }
    } catch (err) {
      console.warn('[EmergencyEscalation] Groq AI classification failed:', err.message);
    }
  }

  // Fallback to deterministic assessment
  return {
    riskLevel: deterministicResult?.riskLevel || 'MODERATE',
    reasons: deterministicResult?.reasons?.length ? deterministicResult.reasons : ['Standard clinical assessment based on reported symptom severity'],
    requiresEscalation: Boolean(deterministicResult?.requiresEscalation),
    source: 'deterministic-fallback',
  };
};

/**
 * Full Hybrid Evaluation
 */
export const runHybridEmergencyTriage = async (symptoms = [], severity = 'mild', notes = '') => {
  const deterministicResult = evaluateDeterministicRules(symptoms, severity, notes);
  return await evaluateAIClassification(symptoms, severity, notes, deterministicResult);
};

/**
 * Create Emergency Event & Dispatch Escalation Notifications
 */
export const createAndEscalateEmergencyEvent = async ({
  patientId,
  symptoms = [],
  riskLevel = 'EMERGENCY',
  reasons = [],
  requiresEscalation = true,
  assignedDoctorId = null,
}) => {
  if (!patientId) return null;

  let emergencyEvent = null;
  let patientUser = null;

  try {
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(patientId)) {
      patientUser = await User.findById(patientId);

      const contactsToNotify = [];
      if (patientUser?.emergencyContacts?.length) {
        patientUser.emergencyContacts.forEach((c) => {
          contactsToNotify.push({
            name: c.name,
            relationship: c.relationship,
            phone: c.phone,
            priority: c.priority || 1,
            notifiedAt: new Date(),
          });
        });
      } else if (patientUser?.emergencyContact) {
        contactsToNotify.push({
          name: patientUser.emergencyContact.name,
          relationship: patientUser.emergencyContact.relation || 'Family',
          phone: patientUser.emergencyContact.phone,
          priority: 1,
          notifiedAt: new Date(),
        });
      }

      emergencyEvent = await EmergencyEvent.create({
        patientId,
        symptoms: Array.isArray(symptoms) ? symptoms : [String(symptoms)],
        riskLevel,
        reasons,
        requiresEscalation,
        status: 'OPEN',
        assignedDoctorId: assignedDoctorId || null,
        emergencyContactsNotified: contactsToNotify,
        timeline: [
          {
            status: 'OPEN',
            changedBy: 'Automated Hybrid Emergency Triage System',
            note: reasons.join('; ') || 'Emergency threshold triggered',
            timestamp: new Date(),
          },
        ],
      });
    }
  } catch (err) {
    console.warn('[EmergencyEscalation] Failed to save EmergencyEvent:', err.message);
  }

  // Socket.IO Escalation Broadcast
  const io = getIO();
  if (io && emergencyEvent) {
    const payload = {
      eventId: emergencyEvent._id,
      patientId,
      patientName: patientUser?.name || 'Emergency Patient',
      patientPhone: patientUser?.phone || '',
      village: patientUser?.village || '',
      riskLevel,
      reasons,
      requiresEscalation,
      status: emergencyEvent.status,
      timestamp: new Date().toISOString(),
      disclaimer: 'Hospital and emergency contact alerted. Dial 108 / 112 immediately in life-threatening scenarios.',
    };

    // 1. Notify Assigned Doctor or all active doctors
    if (assignedDoctorId) {
      io.to(`doctor-${assignedDoctorId}`).emit('emergency-escalation', payload);
    }
    io.emit('emergency-escalation', payload);

    // 2. Notify Patient's room
    io.to(`patient-${patientId}`).emit('emergency-warning', payload);
    io.emit('emergency-warning', payload);
  }

  return emergencyEvent;
};

export default {
  DETERMINISTIC_EMERGENCY_RULES,
  evaluateDeterministicRules,
  evaluateAIClassification,
  runHybridEmergencyTriage,
  createAndEscalateEmergencyEvent,
};
