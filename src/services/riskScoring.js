import mongoose from 'mongoose';
import User from '../models/User.model.js';
import SymptomAnalysis from '../models/SymptomAnalysis.model.js';
import RiskProfile from '../models/RiskProfile.model.js';

// In-memory fallback cache for development when MongoDB is disconnected
const inMemoryRiskProfiles = new Map();

/**
 * Pure calculation function for Risk Profile
 * @param {Object} user - User document { age, gender, chronicFlags }
 * @param {Array} analyses - Array of recent SymptomAnalysis documents
 * @returns {Object} { score, level, riskType, explanation, factors }
 */
export const calculateRiskFromData = (user = {}, analyses = []) => {
  const age = Number(user.age) || 35;
  const chronicFlags = Array.isArray(user.chronicFlags) ? user.chronicFlags : [];
  const flagsLower = chronicFlags.map((f) => f.toLowerCase());

  let baseScore = 0;
  const factors = [];
  let dominantRiskType = 'general';

  // 1. AGE FACTOR
  let ageScore = 5;
  let ageDesc = 'Young adult baseline';
  if (age > 60) {
    ageScore = 30;
    ageDesc = 'Senior demographic vulnerability';
  } else if (age >= 46) {
    ageScore = 20;
    ageDesc = 'Mature age bracket consideration';
  } else if (age >= 30) {
    ageScore = 12;
    ageDesc = 'Standard adult baseline';
  }
  baseScore += ageScore;
  factors.push({
    name: `Age Factor (${age} yrs)`,
    contribution: ageScore,
    description: ageDesc,
  });

  // 2. CHRONIC CONDITIONS FACTOR
  let chronicScore = 0;
  if (flagsLower.some((f) => f.includes('diabet'))) {
    chronicScore += 25;
    dominantRiskType = 'diabetes';
    factors.push({
      name: 'Diabetes Mellitus Flag',
      contribution: 25,
      description: 'Elevated metabolic and glycemic monitoring risk',
    });
  }

  if (flagsLower.some((f) => f.includes('hyper') || f.includes('blood pressure') || f.includes('bp'))) {
    chronicScore += 25;
    if (dominantRiskType === 'general') dominantRiskType = 'hypertension';
    factors.push({
      name: 'Hypertension Alert Flag',
      contribution: 25,
      description: 'Cardiovascular pressure & stroke risk factor',
    });
  }

  if (flagsLower.some((f) => f.includes('heart') || f.includes('cardiac'))) {
    chronicScore += 30;
    dominantRiskType = 'cardiovascular';
    factors.push({
      name: 'Heart Disease Condition',
      contribution: 30,
      description: 'High priority cardiovascular observation required',
    });
  }

  if (flagsLower.some((f) => f.includes('asthma') || f.includes('respirat') || f.includes('copd'))) {
    chronicScore += 20;
    if (dominantRiskType === 'general') dominantRiskType = 'respiratory';
    factors.push({
      name: 'Respiratory Condition (Asthma/COPD)',
      contribution: 20,
      description: 'Bronchial sensitivity and seasonal flare risk',
    });
  }

  if (flagsLower.some((f) => f.includes('maternal') || f.includes('pregnan'))) {
    chronicScore += 20;
    dominantRiskType = 'maternal';
    factors.push({
      name: 'Maternal Healthcare Flag',
      contribution: 20,
      description: 'Antenatal observation and maternal health priority',
    });
  }

  // Other miscellaneous chronic conditions
  const otherFlags = chronicFlags.filter((f) => {
    const l = f.toLowerCase();
    return (
      !l.includes('diabet') &&
      !l.includes('hyper') &&
      !l.includes('bp') &&
      !l.includes('heart') &&
      !l.includes('cardiac') &&
      !l.includes('asthma') &&
      !l.includes('respirat') &&
      !l.includes('maternal') &&
      !l.includes('pregnan')
    );
  });

  if (otherFlags.length > 0) {
    const additional = Math.min(20, otherFlags.length * 10);
    chronicScore += additional;
    factors.push({
      name: `Other Chronic Alerts (${otherFlags.join(', ')})`,
      contribution: additional,
      description: 'Cumulative impact of logged medical alerts',
    });
  }

  baseScore += chronicScore;

  // 3. SYMPTOM ANALYSIS HISTORY FACTOR (last 3-5 assessments)
  if (Array.isArray(analyses) && analyses.length > 0) {
    const recentAnalyses = analyses.slice(0, 5);
    let symptomHistoryScore = 0;

    const hasEmergency = recentAnalyses.some((a) => a.recommendedAction === 'emergency');
    const hasDoctorConsult = recentAnalyses.some((a) => a.recommendedAction === 'consult-doctor');
    const hasClinicVisit = recentAnalyses.some((a) => a.recommendedAction === 'visit-clinic');

    if (hasEmergency) {
      symptomHistoryScore += 25;
      factors.push({
        name: 'Recent Emergency Triage History',
        contribution: 25,
        description: 'Critical symptom episode reported in recent history',
      });
    } else if (hasDoctorConsult) {
      symptomHistoryScore += 16;
      factors.push({
        name: 'Active Acute Symptom Triage',
        contribution: 16,
        description: 'Doctor consultation recommended in recent symptom checks',
      });
    } else if (hasClinicVisit) {
      symptomHistoryScore += 10;
      factors.push({
        name: 'Subacute Clinic Visit Recommended',
        contribution: 10,
        description: 'Persistent symptom episode undergoing observation',
      });
    }

    // Average severity contribution (1-10 mapped to 0-15)
    const avgSeverity =
      recentAnalyses.reduce((sum, a) => sum + (Number(a.severityScore) || 3), 0) /
      recentAnalyses.length;
    const severityBonus = Math.round((avgSeverity / 10) * 12);
    if (severityBonus > 0) {
      symptomHistoryScore += severityBonus;
      factors.push({
        name: `Avg Symptom Severity (${avgSeverity.toFixed(1)}/10)`,
        contribution: severityBonus,
        description: 'Weighted clinical intensity of reported symptom episodes',
      });
    }

    baseScore += symptomHistoryScore;
  }

  // Normalize final score between 5 and 100
  const finalScore = Math.max(8, Math.min(100, Math.round(baseScore)));

  // Risk Level Tiering
  let level = 'low';
  if (finalScore >= 70) {
    level = 'high';
  } else if (finalScore >= 36) {
    level = 'medium';
  }

  // Generate clear one-line explanation
  let explanation = '';
  if (level === 'high') {
    explanation = `High health risk detected due to ${dominantRiskType} indicators and recent symptom severity. Regular medical monitoring strongly recommended.`;
  } else if (level === 'medium') {
    explanation = `Moderate health risk reflecting age (${age}y) and ${chronicFlags.length > 0 ? chronicFlags.slice(0, 2).join(', ') : 'recent symptom activity'}. Routine health checks advised.`;
  } else {
    explanation = `Low baseline health risk. Healthy vital trends observed with manageable mild symptoms.`;
  }

  return {
    score: finalScore,
    level,
    riskType: dominantRiskType,
    explanation,
    factors,
  };
};

/**
 * Compute and persist RiskProfile for a patient
 * @param {string|ObjectId} patientId
 * @param {string} reason
 * @returns {Promise<Object>} updated RiskProfile
 */
export const computeAndSaveRiskProfile = async (patientId, reason = 'Automated symptom update') => {
  if (!patientId) return null;

  const isDbConnected = mongoose.connection.readyState === 1;

  let user = null;
  let analyses = [];

  if (isDbConnected && mongoose.isValidObjectId(patientId)) {
    user = await User.findById(patientId);
    analyses = await SymptomAnalysis.find({ patientId }).sort({ createdAt: -1 }).limit(5);
  } else {
    // Mock user for in-memory mode
    user = {
      _id: patientId,
      age: 48,
      gender: 'Male',
      chronicFlags: ['Hypertension', 'Diabetes Type-2'],
    };
  }

  const computed = calculateRiskFromData(user || {}, analyses);

  const historyEntry = {
    score: computed.score,
    level: computed.level,
    riskType: computed.riskType,
    reason,
    date: new Date(),
  };

  if (isDbConnected && mongoose.isValidObjectId(patientId)) {
    const existing = await RiskProfile.findOne({ patientId });

    if (existing) {
      existing.score = computed.score;
      existing.level = computed.level;
      existing.riskType = computed.riskType;
      existing.explanation = computed.explanation;
      existing.factors = computed.factors;
      existing.lastUpdated = new Date();
      existing.history.unshift(historyEntry);
      // Keep at most 20 history entries
      if (existing.history.length > 20) {
        existing.history = existing.history.slice(0, 20);
      }
      await existing.save();
      return existing;
    } else {
      const newProfile = await RiskProfile.create({
        patientId,
        score: computed.score,
        level: computed.level,
        riskType: computed.riskType,
        explanation: computed.explanation,
        factors: computed.factors,
        history: [
          historyEntry,
          {
            score: Math.max(10, computed.score - 8),
            level: computed.score - 8 >= 70 ? 'high' : computed.score - 8 >= 36 ? 'medium' : 'low',
            riskType: computed.riskType,
            reason: 'Baseline intake assessment',
            date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
          },
        ],
        lastUpdated: new Date(),
      });
      return newProfile;
    }
  } else {
    // In-memory fallback
    const key = String(patientId);
    let profile = inMemoryRiskProfiles.get(key);

    if (profile) {
      profile.score = computed.score;
      profile.level = computed.level;
      profile.riskType = computed.riskType;
      profile.explanation = computed.explanation;
      profile.factors = computed.factors;
      profile.lastUpdated = new Date().toISOString();
      profile.history.unshift({
        ...historyEntry,
        date: new Date().toISOString(),
      });
      if (profile.history.length > 20) {
        profile.history = profile.history.slice(0, 20);
      }
    } else {
      profile = {
        _id: 'risk-' + Date.now(),
        patientId: key,
        score: computed.score,
        level: computed.level,
        riskType: computed.riskType,
        explanation: computed.explanation,
        factors: computed.factors,
        history: [
          {
            ...historyEntry,
            date: new Date().toISOString(),
          },
          {
            score: Math.max(10, computed.score - 6),
            level: computed.score - 6 >= 70 ? 'high' : computed.score - 6 >= 36 ? 'medium' : 'low',
            riskType: computed.riskType,
            reason: 'Initial village intake profile',
            date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
          },
          {
            score: Math.max(10, computed.score - 12),
            level: computed.score - 12 >= 70 ? 'high' : computed.score - 12 >= 36 ? 'medium' : 'low',
            riskType: computed.riskType,
            reason: 'Primary health record synchronization',
            date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
          },
        ],
        lastUpdated: new Date().toISOString(),
      };
      inMemoryRiskProfiles.set(key, profile);
    }

    return profile;
  }
};

export default {
  calculateRiskFromData,
  computeAndSaveRiskProfile,
};
