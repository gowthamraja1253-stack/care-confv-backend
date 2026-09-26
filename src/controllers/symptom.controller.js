import Symptom from '../models/Symptom.model.js';
import SymptomAnalysis from '../models/SymptomAnalysis.model.js';
import EmergencyAlert from '../models/EmergencyAlert.model.js';
import { analyzeSymptoms, chatSymptomTriage } from '../services/aiSymptomAnalysis.js';
import { computeAndSaveRiskProfile } from '../services/riskScoring.js';
import { inMemoryAlerts } from './emergencyAlert.controller.js';
import asyncHandler from '../utils/asyncHandler.js';
import mongoose from 'mongoose';

// In-memory fallback cache for development/demo when MongoDB is disconnected
const inMemorySymptoms = [];
const inMemoryAnalyses = [];

/**
 * @desc    Create a new symptom assessment submission
 * @route   POST /api/symptoms
 * @access  Private
 */
export const createSymptom = asyncHandler(async (req, res) => {
  const { symptoms, durationDays, severity, notes } = req.body;
  const patientId = req.user?._id;

  if (!patientId) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, patient identity missing',
    });
  }

  // Validate symptoms array
  if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please provide at least one symptom',
    });
  }

  // Validate durationDays
  const parsedDuration = Number(durationDays);
  if (isNaN(parsedDuration) || parsedDuration < 1) {
    return res.status(400).json({
      success: false,
      message: 'Duration must be a positive number of days (at least 1)',
    });
  }

  // Validate severity enum
  const validSeverities = ['mild', 'moderate', 'severe'];
  const normalizedSeverity = (severity || 'mild').toLowerCase().trim();
  if (!validSeverities.includes(normalizedSeverity)) {
    return res.status(400).json({
      success: false,
      message: `Invalid severity '${severity}'. Allowed values: mild, moderate, severe`,
    });
  }

  const isDbConnected = mongoose.connection.readyState === 1;

  if (isDbConnected) {
    const newSymptom = await Symptom.create({
      patientId,
      symptoms: symptoms.map((s) => String(s).trim()).filter(Boolean),
      durationDays: parsedDuration,
      severity: normalizedSeverity,
      notes: notes ? String(notes).trim() : '',
      createdAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: 'Symptom assessment submitted successfully',
      symptom: newSymptom,
    });
  } else {
    // In-memory fallback
    const fallbackSymptom = {
      _id: 'symp-' + Date.now(),
      patientId: patientId.toString(),
      symptoms: symptoms.map((s) => String(s).trim()).filter(Boolean),
      durationDays: parsedDuration,
      severity: normalizedSeverity,
      notes: notes ? String(notes).trim() : '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    inMemorySymptoms.unshift(fallbackSymptom);

    return res.status(201).json({
      success: true,
      message: 'Symptom assessment submitted successfully (in-memory mode)',
      symptom: fallbackSymptom,
    });
  }
});

/**
 * @desc    Get past symptom submissions for the logged-in patient
 * @route   GET /api/symptoms
 * @access  Private
 */
export const getPatientSymptoms = asyncHandler(async (req, res) => {
  const patientId = req.user?._id;

  if (!patientId) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, patient identity missing',
    });
  }

  const isDbConnected = mongoose.connection.readyState === 1;

  if (isDbConnected) {
    const symptoms = await Symptom.find({ patientId })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      count: symptoms.length,
      symptoms,
    });
  } else {
    // Filter from memory store
    const userSymptoms = inMemorySymptoms.filter(
      (s) => s.patientId === patientId.toString()
    );

    // If empty in development memory store, provide helpful sample records
    if (userSymptoms.length === 0) {
      const sampleSymptoms = [
        {
          _id: 'symp-sample-1',
          patientId: patientId.toString(),
          symptoms: ['Fever', 'Dry Cough', 'Headache'],
          durationDays: 3,
          severity: 'moderate',
          notes: 'Fever peaks in the evening, taking paracetamol.',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        },
        {
          _id: 'symp-sample-2',
          patientId: patientId.toString(),
          symptoms: ['Joint Pain', 'Fatigue'],
          durationDays: 7,
          severity: 'mild',
          notes: 'Knee stiffness in early morning.',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString(),
        }
      ];
      return res.status(200).json({
        success: true,
        count: sampleSymptoms.length,
        symptoms: sampleSymptoms,
      });
    }

    return res.status(200).json({
      success: true,
      count: userSymptoms.length,
      symptoms: userSymptoms,
    });
  }
});

/**
 * @desc    Get single symptom submission details by ID
 * @route   GET /api/symptoms/:id
 * @access  Private
 */
export const getSymptomById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isDbConnected = mongoose.connection.readyState === 1;

  if (isDbConnected && mongoose.isValidObjectId(id)) {
    const symptom = await Symptom.findById(id).populate('patientId', 'name phone village');
    if (!symptom) {
      return res.status(404).json({
        success: false,
        message: 'Symptom assessment not found',
      });
    }
    return res.status(200).json({
      success: true,
      symptom,
    });
  } else {
    const symptom = inMemorySymptoms.find((s) => s._id === id);
    if (!symptom) {
      return res.status(404).json({
        success: false,
        message: 'Symptom assessment not found',
      });
    }
    return res.status(200).json({
      success: true,
      symptom,
    });
  }
});

/**
 * @desc    Run AI clinical analysis on a symptom record
 * @route   POST /api/symptoms/:id/analyze
 * @access  Private
 */
export const analyzeSymptomById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const patientId = req.user?._id;

  if (!patientId) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  const isDbConnected = mongoose.connection.readyState === 1;
  let symptomDoc = null;

  if (isDbConnected && mongoose.isValidObjectId(id)) {
    symptomDoc = await Symptom.findById(id);
  } else {
    symptomDoc = inMemorySymptoms.find((s) => s._id === id);
  }

  if (!symptomDoc) {
    return res.status(404).json({
      success: false,
      message: 'Symptom assessment not found for analysis',
    });
  }

  // Check existing analysis
  let existingAnalysis = null;
  if (isDbConnected && mongoose.isValidObjectId(id)) {
    existingAnalysis = await SymptomAnalysis.findOne({ symptomId: id });
  } else {
    existingAnalysis = inMemoryAnalyses.find((a) => a.symptomId === id);
  }

  // If already analyzed recently, return existing analysis
  if (existingAnalysis) {
    return res.status(200).json({
      success: true,
      message: 'Existing symptom analysis retrieved',
      analysis: existingAnalysis,
    });
  }

  // Run AI analysis (Groq or rule-based fallback)
  const analysisResult = await analyzeSymptoms(symptomDoc);

  if (isDbConnected && mongoose.isValidObjectId(id)) {
    const savedAnalysis = await SymptomAnalysis.create({
      symptomId: symptomDoc._id,
      patientId: symptomDoc.patientId,
      possibleConditions: analysisResult.possibleConditions,
      severityScore: analysisResult.severityScore,
      recommendedAction: analysisResult.recommendedAction,
      explanation: analysisResult.explanation,
      source: analysisResult.source,
      createdAt: new Date(),
    });

    let emergencyAlert = null;
    const isEmergency =
      analysisResult.recommendedAction === 'emergency' || analysisResult.severityScore >= 8;

    if (isEmergency) {
      try {
        emergencyAlert = await EmergencyAlert.create({
          patientId: symptomDoc.patientId,
          symptomId: symptomDoc._id,
          status: 'triggered',
          severityScore: analysisResult.severityScore,
          reason: analysisResult.explanation || 'Emergency symptom threshold reached',
          createdAt: new Date(),
        });
      } catch (alertErr) {
        console.warn('[Emergency Alert] Failed to save alert:', alertErr.message);
      }
    }

    // Automatically recompute patient risk profile
    try {
      await computeAndSaveRiskProfile(symptomDoc.patientId, `AI symptom check: ${analysisResult.recommendedAction}`);
    } catch (riskErr) {
      console.warn('[Risk Scoring] Failed to update risk profile:', riskErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Symptom analysis generated successfully',
      analysis: savedAnalysis,
      emergencyAlert,
    });
  } else {
    const fallbackAnalysis = {
      _id: 'analysis-' + Date.now(),
      symptomId: id,
      patientId: patientId.toString(),
      possibleConditions: analysisResult.possibleConditions,
      severityScore: analysisResult.severityScore,
      recommendedAction: analysisResult.recommendedAction,
      explanation: analysisResult.explanation,
      source: analysisResult.source,
      createdAt: new Date().toISOString(),
    };
    inMemoryAnalyses.unshift(fallbackAnalysis);

    let fallbackAlert = null;
    const isEmergency =
      analysisResult.recommendedAction === 'emergency' || analysisResult.severityScore >= 8;

    if (isEmergency) {
      fallbackAlert = {
        _id: 'alert-' + Date.now(),
        patientId: String(patientId),
        symptomId: id,
        status: 'triggered',
        severityScore: analysisResult.severityScore,
        reason: analysisResult.explanation || 'Emergency symptom threshold reached',
        emergencyContactNotified: false,
        notifiedAt: null,
        createdAt: new Date().toISOString(),
      };
      inMemoryAlerts.unshift(fallbackAlert);
    }

    // Recompute in-memory risk
    try {
      await computeAndSaveRiskProfile(patientId, `AI symptom check: ${analysisResult.recommendedAction}`);
    } catch (riskErr) {
      console.warn('[Risk Scoring] Failed to update risk profile in memory:', riskErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Symptom analysis generated successfully (in-memory mode)',
      analysis: fallbackAnalysis,
      emergencyAlert: fallbackAlert,
    });
  }
});

/**
 * @desc    Get existing analysis for a symptom record
 * @route   GET /api/symptoms/:id/analysis
 * @access  Private
 */
export const getSymptomAnalysisById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isDbConnected = mongoose.connection.readyState === 1;

  if (isDbConnected && mongoose.isValidObjectId(id)) {
    const analysis = await SymptomAnalysis.findOne({ symptomId: id });
    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: 'No analysis found for this symptom record',
      });
    }
    return res.status(200).json({
      success: true,
      analysis,
    });
  } else {
    const analysis = inMemoryAnalyses.find((a) => a.symptomId === id);
    if (!analysis) {
      // If not yet analyzed in dev memory mode, generate on the fly
      const symptomDoc = inMemorySymptoms.find((s) => s._id === id);
      if (symptomDoc) {
        const generated = await analyzeSymptoms(symptomDoc);
        const fallbackAnalysis = {
          _id: 'analysis-' + Date.now(),
          symptomId: id,
          patientId: symptomDoc.patientId,
          possibleConditions: generated.possibleConditions,
          severityScore: generated.severityScore,
          recommendedAction: generated.recommendedAction,
          explanation: generated.explanation,
          source: generated.source,
          createdAt: new Date().toISOString(),
        };
        inMemoryAnalyses.unshift(fallbackAnalysis);
        return res.status(200).json({
          success: true,
          analysis: fallbackAnalysis,
        });
      }
      return res.status(404).json({
        success: false,
        message: 'No analysis found for this symptom record',
      });
    }
    return res.status(200).json({
      success: true,
      analysis,
    });
  }
});

/**
 * @desc    Conversational AI Symptom Checker & Voice Triage Assistant
 * @route   POST /api/symptoms/chat
 * @access  Private
 */
export const chatWithDoctorAi = asyncHandler(async (req, res) => {
  const { messages, saveRecord } = req.body;
  const user = req.user;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please provide conversation messages array',
    });
  }

  const patientProfile = {
    name: user?.name || 'Patient',
    age: user?.age || 35,
    gender: user?.gender || 'Unspecified',
    village: user?.village || 'Rural Health Center',
    chronicFlags: user?.chronicFlags || [],
    preferredLanguage: user?.preferredLanguage || 'English',
  };

  const triageResult = await chatSymptomTriage({
    messages,
    patientProfile,
  });

  let savedSymptom = null;
  let savedAnalysis = null;

  if (saveRecord && user?._id) {
    const isDbConnected = mongoose.connection.readyState === 1;
    const userMessages = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join('; ');
    const severityMap = {
      emergency: 'severe',
      'consult-doctor': 'moderate',
      'visit-clinic': 'moderate',
      'self-care': 'mild',
    };
    const severity = severityMap[triageResult.triageLevel] || 'mild';

    if (isDbConnected) {
      try {
        savedSymptom = await Symptom.create({
          patientId: user._id,
          symptoms: triageResult.possibleConditions || ['Voice AI Symptom Checkup'],
          durationDays: 2,
          severity,
          notes: userMessages.slice(0, 500),
          createdAt: new Date(),
        });

        savedAnalysis = await SymptomAnalysis.create({
          symptomId: savedSymptom._id,
          patientId: user._id,
          possibleConditions: triageResult.possibleConditions,
          severityScore: triageResult.severityScore,
          recommendedAction: triageResult.recommendedAction,
          explanation: triageResult.reply.slice(0, 500),
          source: triageResult.source || 'ai-voice-chat',
        });

        computeAndSaveRiskProfile(user._id).catch((err) =>
          console.warn('[AI Triage] Error updating risk profile:', err.message)
        );
      } catch (dbErr) {
        console.warn('[AI Triage] DB save symptom error:', dbErr.message);
      }
    }
  }

  res.status(200).json({
    success: true,
    ...triageResult,
    savedRecordId: savedSymptom?._id || null,
  });
});

export default {
  createSymptom,
  getPatientSymptoms,
  getSymptomById,
  analyzeSymptomById,
  getSymptomAnalysisById,
  chatWithDoctorAi,
};


