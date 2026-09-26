import asyncHandler from '../utils/asyncHandler.js';
import PreventiveTip from '../models/PreventiveTip.model.js';
import RiskProfile from '../models/RiskProfile.model.js';
import SymptomAnalysis from '../models/SymptomAnalysis.model.js';
import { generatePreventiveTips, getIndianSeasonContext } from '../services/aiTipGeneration.js';
import mongoose from 'mongoose';

// In-Memory storage fallback if MongoDB is not connected
export const inMemoryPreventiveTips = new Map(); // patientId -> [{ ...tip }]

/**
 * @desc    Get current preventive health tips (cached 24h or newly generated)
 * @route   GET /api/preventive-tips
 * @access  Private (Patient / All authenticated users)
 */
export const getPreventiveTips = asyncHandler(async (req, res) => {
  const patientId = req.user._id || req.user.id || 'patient-default';
  const preferredLanguage = (req.query.lang || req.user.preferredLanguage || 'en').toLowerCase().substring(0, 2);
  const forceRefresh = req.query.refresh === 'true';

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const now = new Date();
  const cutoffTime = new Date(now.getTime() - ONE_DAY_MS);

  // 1. Check if DB is connected
  const isDbConnected = mongoose.connection.readyState === 1;

  if (isDbConnected && !forceRefresh) {
    try {
      const existingTips = await PreventiveTip.find({
        patientId,
        language: preferredLanguage,
        generatedAt: { $gte: cutoffTime },
      })
        .sort({ generatedAt: -1 })
        .limit(3);

      if (existingTips && existingTips.length >= 2) {
        return res.status(200).json({
          success: true,
          cached: true,
          season: getIndianSeasonContext().season,
          tips: existingTips,
        });
      }
    } catch (dbErr) {
      console.warn('[PreventiveTips Controller] Cache check DB warning:', dbErr.message);
    }
  } else if (!isDbConnected && !forceRefresh) {
    const memoryKey = `${patientId}_${preferredLanguage}`;
    const memEntry = inMemoryPreventiveTips.get(memoryKey);
    if (memEntry && memEntry.generatedAt >= cutoffTime && memEntry.tips.length > 0) {
      return res.status(200).json({
        success: true,
        cached: true,
        season: getIndianSeasonContext().season,
        tips: memEntry.tips,
      });
    }
  }

  // 2. Fetch context from RiskProfile & SymptomAnalysis
  let riskProfile = null;
  let recentSymptoms = [];

  if (isDbConnected) {
    try {
      riskProfile = await RiskProfile.findOne({ patientId });
    } catch (e) {}

    try {
      recentSymptoms = await SymptomAnalysis.find({ patientId })
        .sort({ createdAt: -1 })
        .limit(3);
    } catch (e) {}
  }

  // 3. Generate tips via AI / Rule engine
  const generated = await generatePreventiveTips({
    patient: req.user,
    riskProfile,
    recentSymptoms,
    preferredLanguage,
  });

  // 4. Persist newly generated tips
  let savedTips = [];
  if (isDbConnected) {
    try {
      const docsToInsert = generated.map((t) => ({
        patientId,
        tipText: t.tipText,
        category: t.category,
        actionableAdvice: t.actionableAdvice,
        icon: t.icon,
        language: preferredLanguage,
        source: t.source,
        generatedAt: new Date(),
      }));

      savedTips = await PreventiveTip.insertMany(docsToInsert);
    } catch (saveErr) {
      console.warn('[PreventiveTips Controller] DB insert warning:', saveErr.message);
      savedTips = generated.map((t, idx) => ({
        _id: `tip-mem-${Date.now()}-${idx}`,
        ...t,
        generatedAt: new Date(),
      }));
    }
  } else {
    savedTips = generated.map((t, idx) => ({
      _id: `tip-mem-${Date.now()}-${idx}`,
      ...t,
      generatedAt: new Date(),
    }));
    const memoryKey = `${patientId}_${preferredLanguage}`;
    inMemoryPreventiveTips.set(memoryKey, {
      generatedAt: new Date(),
      tips: savedTips,
    });
  }

  return res.status(200).json({
    success: true,
    cached: false,
    season: getIndianSeasonContext().season,
    tips: savedTips,
  });
});

/**
 * @desc    Force refresh preventive health tips with latest patient vitals & AI
 * @route   POST /api/preventive-tips/refresh
 * @access  Private
 */
export const refreshPreventiveTips = asyncHandler(async (req, res) => {
  req.query.refresh = 'true';
  return getPreventiveTips(req, res);
});

export default {
  getPreventiveTips,
  refreshPreventiveTips,
  inMemoryPreventiveTips,
};
