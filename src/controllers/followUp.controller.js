import FollowUp from '../models/FollowUp.model.js';
import User from '../models/User.model.js';
import Appointment from '../models/Appointment.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import mongoose from 'mongoose';

/**
 * Seed sample follow-ups for testing if empty
 */
export const seedSampleFollowUps = async (patientId, doctorId) => {
  if (!mongoose.connection.readyState === 1) return [];
  const existing = await FollowUp.countDocuments({ patientId });
  if (existing > 0) return [];

  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const pastDue = new Date(now);
  pastDue.setDate(pastDue.getDate() - 3);

  const sample = [
    {
      patientId,
      doctorId: doctorId || patientId,
      dueDate: nextWeek,
      reason: 'Review blood pressure readings and response to Amlodipine 5mg',
      instructions: 'Record BP morning and evening for 7 days. Bring log book.',
      status: 'UPCOMING',
      notes: 'Initial consultation BP was 142/90.',
    },
    {
      patientId,
      doctorId: doctorId || patientId,
      dueDate: pastDue,
      reason: 'Check fasting blood sugar and HbA1c review',
      instructions: 'Fasting 10-12 hours prior to lab test.',
      status: 'MISSED',
      notes: 'Patient missed scheduled clinic visit on Friday.',
    },
  ];

  return await FollowUp.insertMany(sample);
};

/**
 * @desc    Create a follow-up for a patient
 * @route   POST /api/follow-ups
 * @access  Private (Doctor)
 */
export const createFollowUp = asyncHandler(async (req, res) => {
  const {
    patientId,
    consultationId,
    dueDate,
    followUpDays,
    reason,
    instructions,
    notes,
  } = req.body;

  const doctorId = req.user?._id;

  if (!patientId || (!dueDate && !followUpDays) || !reason) {
    return res.status(400).json({
      success: false,
      message: 'Please provide patientId, reason, and either dueDate or followUpDays (e.g. 7 or 30)',
    });
  }

  let calculatedDueDate = dueDate ? new Date(dueDate) : new Date();
  if (followUpDays) {
    calculatedDueDate = new Date();
    calculatedDueDate.setDate(calculatedDueDate.getDate() + Number(followUpDays));
  }

  if (mongoose.connection.readyState === 1) {
    const followUp = await FollowUp.create({
      patientId,
      doctorId,
      consultationId: consultationId || null,
      dueDate: calculatedDueDate,
      reason: reason.trim(),
      instructions: instructions ? instructions.trim() : '',
      status: 'UPCOMING',
      notes: notes ? notes.trim() : '',
    });

    return res.status(201).json({
      success: true,
      message: 'Follow-up scheduled successfully',
      followUp,
    });
  }

  res.status(404).json({ success: false, message: 'Database offline' });
});

/**
 * @desc    Get follow-ups (filterable by status: upcoming, missed, completed, all)
 * @route   GET /api/follow-ups
 * @access  Private
 */
export const getFollowUps = asyncHandler(async (req, res) => {
  const { status, patientId } = req.query;
  const userId = req.user?._id;
  const isDoctor = req.user.role === 'doctor';

  if (mongoose.connection.readyState === 1) {
    const effectivePatientId = patientId || (!isDoctor ? userId : null);
    if (effectivePatientId) {
      await seedSampleFollowUps(effectivePatientId, userId);
    }

    const filter = {};
    if (effectivePatientId) filter.patientId = effectivePatientId;
    if (isDoctor && !patientId) filter.doctorId = userId;

    const now = new Date();

    // Auto-update past upcoming follow-ups to MISSED or DUE
    await FollowUp.updateMany(
      {
        status: 'UPCOMING',
        dueDate: { $lt: now },
      },
      {
        $set: { status: 'MISSED' },
      }
    );

    if (status && status !== 'ALL') {
      filter.status = status.toUpperCase();
    }

    const followUps = await FollowUp.find(filter)
      .sort({ dueDate: 1 })
      .populate('patientId', 'name phone village bloodGroup')
      .populate('doctorId', 'name specialization');

    const upcoming = followUps.filter((f) => f.status === 'UPCOMING');
    const missed = followUps.filter((f) => f.status === 'MISSED');
    const completed = followUps.filter((f) => f.status === 'COMPLETED');

    return res.status(200).json({
      success: true,
      count: followUps.length,
      followUps,
      counts: {
        upcoming: upcoming.length,
        missed: missed.length,
        completed: completed.length,
      },
    });
  }

  res.status(200).json({ success: true, count: 0, followUps: [], counts: { upcoming: 0, missed: 0, completed: 0 } });
});

/**
 * @desc    Mark follow-up completed or cancel
 * @route   PATCH /api/follow-ups/:id/status
 * @access  Private
 */
export const updateFollowUpStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const validStatuses = ['UPCOMING', 'DUE', 'MISSED', 'COMPLETED', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
    });
  }

  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
    const followUp = await FollowUp.findById(id);
    if (!followUp) {
      return res.status(404).json({ success: false, message: 'Follow-up record not found' });
    }

    followUp.status = status;
    if (notes) followUp.notes = notes;
    if (status === 'COMPLETED') followUp.completedAt = new Date();

    await followUp.save();

    return res.status(200).json({
      success: true,
      message: `Follow-up marked as ${status}`,
      followUp,
    });
  }

  res.status(404).json({ success: false, message: 'Database offline' });
});

export default {
  createFollowUp,
  getFollowUps,
  updateFollowUpStatus,
};
