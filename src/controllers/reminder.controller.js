import asyncHandler from '../utils/asyncHandler.js';
import PatientMedication from '../models/PatientMedication.model.js';
import MedicationDose from '../models/MedicationDose.model.js';
import { seedSampleMedicationsForPatient } from './patientMedication.controller.js';
import mongoose from 'mongoose';

/**
 * @desc    Get active prescription reminders for logged in user
 * @route   GET /api/reminders/active
 * @access  Private
 */
export const getActiveReminders = asyncHandler(async (req, res) => {
  const { empty } = req.query;
  const patientId = req.user?._id;

  // Support empty state testing via ?empty=true
  if (empty === 'true') {
    return res.status(200).json({
      success: true,
      count: 0,
      reminders: [],
    });
  }

  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(patientId)) {
    // Seed if empty so user has actual records immediately
    await seedSampleMedicationsForPatient(patientId);

    const meds = await PatientMedication.find({
      patientId,
      activeStatus: true,
    }).sort({ createdAt: -1 });

    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayDoses = await MedicationDose.find({
      patientId,
      scheduledAt: { $gte: startOfToday },
    });

    const reminders = meds.map((med) => {
      const isLowStock = med.remainingQuantity <= med.refillThreshold;
      const todayMedDoses = todayDoses.filter((d) => String(d.medicationId) === String(med._id));
      const isTakenToday = todayMedDoses.some((d) => d.status === 'TAKEN');

      return {
        _id: String(med._id),
        medicationId: String(med._id),
        medicineName: med.medicineName,
        dosage: med.dosage,
        instructions: med.instructions || `${med.dosage} • ${med.frequency}`,
        scheduledTime: med.schedule?.[0] ? `${med.schedule[0]} Today` : 'Scheduled Today',
        doctor: `Prescribed by ${med.prescribingDoctor || 'Doctor'}`,
        doctorName: med.prescribingDoctor || 'Doctor',
        remainingQuantity: med.remainingQuantity,
        refillThreshold: med.refillThreshold,
        refillWarning: isLowStock ? `Stock low: ${med.remainingQuantity} doses left` : null,
        isUrgentRefill: isLowStock,
        isTaken: isTakenToday,
        createdAt: med.createdAt,
      };
    });

    return res.status(200).json({
      success: true,
      count: reminders.length,
      reminders,
    });
  }

  // Fallback if DB not ready
  const fallbackReminders = [
    {
      _id: 'rem-001',
      medicationId: 'rem-001',
      medicineName: 'Metformin 500mg',
      instructions: '1 Tablet • After Dinner',
      scheduledTime: '08:30 PM Tonight',
      doctor: 'Prescribed by Dr. Ananya Sharma',
      remainingQuantity: 18,
      refillThreshold: 10,
      refillWarning: null,
      isUrgentRefill: false,
      isTaken: false,
      createdAt: new Date().toISOString(),
    },
  ];

  res.status(200).json({
    success: true,
    count: fallbackReminders.length,
    reminders: fallbackReminders,
  });
});

export default { getActiveReminders };
