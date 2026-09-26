import asyncHandler from '../utils/asyncHandler.js';
import RiskProfile from '../models/RiskProfile.model.js';
import { computeAndSaveRiskProfile } from '../services/riskScoring.js';
import mongoose from 'mongoose';

/**
 * @desc    Get patient risk profile (calculates if not yet generated)
 * @route   GET /api/risk
 * @access  Private
 */
export const getRiskProfile = asyncHandler(async (req, res) => {
  const patientId = req.user?._id;

  if (!patientId) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, patient identity missing',
    });
  }

  const isDbConnected = mongoose.connection.readyState === 1;

  if (isDbConnected && mongoose.isValidObjectId(patientId)) {
    let profile = await RiskProfile.findOne({ patientId });

    if (!profile) {
      profile = await computeAndSaveRiskProfile(patientId, 'Initial risk score generation');
    }

    return res.status(200).json({
      success: true,
      riskProfile: profile,
    });
  } else {
    // In-memory mode
    const profile = await computeAndSaveRiskProfile(patientId, 'Initial risk calculation (in-memory)');
    return res.status(200).json({
      success: true,
      riskProfile: profile,
    });
  }
});

/**
 * @desc    Manually trigger risk score recalculation
 * @route   POST /api/risk/recalculate
 * @access  Private
 */
export const recalculateRisk = asyncHandler(async (req, res) => {
  const patientId = req.user?._id;

  if (!patientId) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  const updatedProfile = await computeAndSaveRiskProfile(patientId, 'Manual patient recalculation');

  return res.status(200).json({
    success: true,
    message: 'Health risk score recalculated successfully',
    riskProfile: updatedProfile,
  });
});

export default {
  getRiskProfile,
  recalculateRisk,
};
