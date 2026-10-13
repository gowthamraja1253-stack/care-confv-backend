import EmergencyEvent from '../models/EmergencyEvent.model.js';
import User from '../models/User.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import { runHybridEmergencyTriage, createAndEscalateEmergencyEvent } from '../services/emergencyEscalation.service.js';
import mongoose from 'mongoose';

/**
 * @desc    Triage symptoms and evaluate emergency escalation
 * @route   POST /api/emergency-events/triage
 * @access  Private
 */
export const triageAndEscalate = asyncHandler(async (req, res) => {
  const { symptoms, severity, notes, assignedDoctorId } = req.body;
  const patientId = req.user?._id;

  if (!patientId) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }

  const triageResult = await runHybridEmergencyTriage(symptoms, severity, notes);

  let emergencyEvent = null;
  if (triageResult.requiresEscalation || triageResult.riskLevel === 'EMERGENCY') {
    emergencyEvent = await createAndEscalateEmergencyEvent({
      patientId,
      symptoms,
      riskLevel: triageResult.riskLevel,
      reasons: triageResult.reasons,
      requiresEscalation: triageResult.requiresEscalation,
      assignedDoctorId,
    });
  }

  res.status(200).json({
    success: true,
    triage: triageResult,
    emergencyEvent,
  });
});

/**
 * @desc    Get active emergency event for logged-in patient or doctor queue
 * @route   GET /api/emergency-events/active
 * @access  Private
 */
export const getActiveEmergencyEvent = asyncHandler(async (req, res) => {
  const patientId = req.user?._id;

  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(patientId)) {
    const query = req.user.role === 'doctor'
      ? { status: { $in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] } }
      : { patientId, status: { $in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] } };

    const event = await EmergencyEvent.findOne(query)
      .sort({ createdAt: -1 })
      .populate('patientId', 'name phone village emergencyContacts emergencyContact bloodGroup');

    return res.status(200).json({
      success: true,
      event: event || null,
    });
  }

  res.status(200).json({ success: true, event: null });
});

/**
 * @desc    Get all emergency events (for doctors/admin or patient history)
 * @route   GET /api/emergency-events
 * @access  Private
 */
export const getEmergencyEvents = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const isDoctor = req.user.role === 'doctor' || req.user.role === 'admin';

  if (mongoose.connection.readyState === 1) {
    const filter = isDoctor ? {} : { patientId: userId };
    const events = await EmergencyEvent.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('patientId', 'name phone village bloodGroup allergies emergencyContacts');

    return res.status(200).json({
      success: true,
      count: events.length,
      events,
    });
  }

  res.status(200).json({ success: true, count: 0, events: [] });
});

/**
 * @desc    Update status: OPEN -> ACKNOWLEDGED -> IN_PROGRESS -> RESOLVED
 * @route   PATCH /api/emergency-events/:id/status
 * @access  Private
 */
export const updateEmergencyStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, doctorNotes } = req.body;

  const validStatuses = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
    });
  }

  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
    const event = await EmergencyEvent.findById(id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Emergency event not found' });
    }

    event.status = status;
    if (doctorNotes) event.doctorNotes = doctorNotes;
    if (status === 'RESOLVED') event.resolvedAt = new Date();

    event.timeline.push({
      status,
      changedBy: req.user?.name || req.user?.role || 'Doctor',
      note: doctorNotes || `Status updated to ${status}`,
      timestamp: new Date(),
    });

    await event.save();

    return res.status(200).json({
      success: true,
      message: `Emergency status updated to ${status}`,
      event,
    });
  }

  res.status(404).json({ success: false, message: 'Emergency event not found or database offline' });
});

export default {
  triageAndEscalate,
  getActiveEmergencyEvent,
  getEmergencyEvents,
  updateEmergencyStatus,
};
