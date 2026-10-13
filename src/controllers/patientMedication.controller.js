import PatientMedication from '../models/PatientMedication.model.js';
import MedicationDose from '../models/MedicationDose.model.js';
import RefillRequest from '../models/RefillRequest.model.js';
import User from '../models/User.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import mongoose from 'mongoose';

/**
 * Helper to calculate adherence % for a list of doses
 */
export const calculateAdherence = (doses) => {
  if (!doses || doses.length === 0) return 100;
  // Expected doses are all doses that are TAKEN, MISSED, or SKIPPED, or PENDING that are in the past
  const now = new Date();
  const pastOrRecorded = doses.filter(
    (d) => d.status === 'TAKEN' || d.status === 'MISSED' || d.status === 'SKIPPED' || new Date(d.scheduledAt) <= now
  );

  if (pastOrRecorded.length === 0) return 100;

  const takenCount = pastOrRecorded.filter((d) => d.status === 'TAKEN').length;
  return Math.round((takenCount / pastOrRecorded.length) * 100);
};

/**
 * Seed sample active medications for a patient if none exist yet
 */
export const seedSampleMedicationsForPatient = async (patientId) => {
  if (!mongoose.connection.readyState === 1 || !mongoose.Types.ObjectId.isValid(patientId)) return [];

  const existing = await PatientMedication.countDocuments({ patientId });
  if (existing > 0) return [];

  const sampleMeds = [
    {
      patientId,
      medicineName: 'Metformin 500mg',
      dosage: '500mg (1 Tablet)',
      frequency: 'Twice Daily (After Meals)',
      schedule: ['08:30 AM', '08:30 PM'],
      prescribedQuantity: 60,
      remainingQuantity: 18,
      refillThreshold: 10,
      prescribingDoctor: 'Dr. Ananya Sharma',
      activeStatus: true,
      instructions: 'Take 1 tablet after breakfast and 1 tablet after dinner with warm water.',
    },
    {
      patientId,
      medicineName: 'Amlodipine 5mg',
      dosage: '5mg (1 Tablet)',
      frequency: 'Once Daily (Morning)',
      schedule: ['09:00 AM'],
      prescribedQuantity: 30,
      remainingQuantity: 4,
      refillThreshold: 5,
      prescribingDoctor: 'Dr. Ananya Sharma',
      activeStatus: true,
      instructions: 'Take 1 tablet every morning at 9 AM. Monitor blood pressure weekly.',
    },
    {
      patientId,
      medicineName: 'Paracetamol 500mg',
      dosage: '500mg (1 Tablet)',
      frequency: 'As Needed (SOS)',
      schedule: ['02:00 PM'],
      prescribedQuantity: 15,
      remainingQuantity: 12,
      refillThreshold: 3,
      prescribingDoctor: 'Dr. Rajesh Patel',
      activeStatus: true,
      instructions: 'Take for fever or body ache above 99.5 F. Minimum 6 hours gap.',
    },
  ];

  const created = await PatientMedication.insertMany(sampleMeds);

  // Seed sample dose records for adherence computation
  const now = new Date();
  const sampleDoses = [];

  for (const med of created) {
    // Generate doses for past 7 days
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const scheduledDate = new Date(now);
      scheduledDate.setDate(scheduledDate.getDate() - dayOffset);

      med.schedule.forEach((timeStr, idx) => {
        const [timePart, modifier] = timeStr.split(' ');
        let [hours, minutes] = timePart.split(':').map(Number);
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;

        const doseTime = new Date(scheduledDate);
        doseTime.setHours(hours, minutes, 0, 0);

        // Make today evening pending, earlier doses mostly taken
        let status = 'TAKEN';
        let takenAt = new Date(doseTime);
        if (dayOffset === 0 && doseTime > now) {
          status = 'PENDING';
          takenAt = null;
        } else if (dayOffset === 2 && med.medicineName.includes('Amlodipine')) {
          status = 'MISSED';
          takenAt = null;
        }

        sampleDoses.push({
          medicationId: med._id,
          patientId,
          scheduledAt: doseTime,
          takenAt,
          status,
          syncId: `seed-${med._id}-${dayOffset}-${idx}`,
        });
      });
    }
  }

  await MedicationDose.insertMany(sampleDoses);

  // Seed 1 refill request for low-stock Amlodipine
  const lowStockMed = created.find((m) => m.medicineName.includes('Amlodipine'));
  if (lowStockMed) {
    await RefillRequest.create({
      medicationId: lowStockMed._id,
      patientId,
      medicineName: lowStockMed.medicineName,
      currentRemaining: lowStockMed.remainingQuantity,
      requestedQuantity: 30,
      reason: 'Only 4 tablets remaining, needs regular BP maintenance refill',
      status: 'REQUESTED',
    });
  }

  return created;
};

/**
 * @desc    Get all active medications with today's dose schedule and low-stock alerts
 * @route   GET /api/patient-medications
 * @access  Private
 */
export const getPatientMedications = asyncHandler(async (req, res) => {
  const targetPatientId = req.query.patientId || req.user?._id;

  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(targetPatientId)) {
    // Seed if empty
    await seedSampleMedicationsForPatient(targetPatientId);

    const medications = await PatientMedication.find({
      patientId: targetPatientId,
      activeStatus: true,
    }).sort({ createdAt: -1 });

    // Fetch doses for past 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const allDoses = await MedicationDose.find({
      patientId: targetPatientId,
      scheduledAt: { $gte: thirtyDaysAgo },
    }).sort({ scheduledAt: -1 });

    const doses7d = allDoses.filter((d) => new Date(d.scheduledAt) >= sevenDaysAgo);
    const dosesToday = allDoses.filter(
      (d) => new Date(d.scheduledAt) >= startOfToday && new Date(d.scheduledAt) <= endOfToday
    );

    // Compute adherence metrics
    const adherenceOverall = calculateAdherence(allDoses);
    const adherence7Days = calculateAdherence(doses7d);
    const adherenceToday = calculateAdherence(dosesToday);

    const missedDosesCount = allDoses.filter((d) => d.status === 'MISSED').length;
    const missedTodayCount = dosesToday.filter((d) => d.status === 'MISSED').length;

    // Enhance each medication with individual stats
    const enhancedMedications = medications.map((med) => {
      const medDoses = allDoses.filter((d) => String(d.medicationId) === String(med._id));
      const medDoses7d = doses7d.filter((d) => String(d.medicationId) === String(med._id));
      const medDosesToday = dosesToday.filter((d) => String(d.medicationId) === String(med._id));

      const isLowStock = med.remainingQuantity <= med.refillThreshold;

      return {
        ...med.toObject(),
        isLowStock,
        adherence30Days: calculateAdherence(medDoses),
        adherence7Days: calculateAdherence(medDoses7d),
        adherenceToday: calculateAdherence(medDosesToday),
        todayDoses: medDosesToday,
      };
    });

    // Check pending refill requests
    const refillRequests = await RefillRequest.find({
      patientId: targetPatientId,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: enhancedMedications.length,
      medications: enhancedMedications,
      adherence: {
        today: adherenceToday,
        last7Days: adherence7Days,
        last30Days: adherenceOverall,
        missedDosesCount,
        missedTodayCount,
      },
      refillRequests,
    });
  }

  res.status(200).json({
    success: true,
    count: 0,
    medications: [],
    adherence: { today: 100, last7Days: 100, last30Days: 100, missedDosesCount: 0 },
    refillRequests: [],
  });
});

/**
 * @desc    Confirm dose TAKEN (reduces stock by 1) or mark MISSED/SKIPPED
 * @route   POST /api/patient-medications/:id/dose
 * @access  Private
 */
export const recordMedicationDose = asyncHandler(async (req, res) => {
  const { id } = req.params; // medicationId
  const { scheduledAt, status = 'TAKEN', syncId, notes } = req.body;
  const patientId = req.user?._id;

  const validStatuses = ['PENDING', 'TAKEN', 'MISSED', 'SKIPPED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
    });
  }

  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
    // 1. Deduplication check via syncId (crucial for offline replay idempotency)
    if (syncId) {
      const existingDose = await MedicationDose.findOne({ syncId });
      if (existingDose) {
        return res.status(200).json({
          success: true,
          message: 'Dose already recorded (deduplicated)',
          dose: existingDose,
        });
      }
    }

    const medication = await PatientMedication.findById(id);
    if (!medication) {
      return res.status(404).json({ success: false, message: 'Medication record not found' });
    }

    // 2. IMPORTANT LOGIC: Stock decreases ONLY when status is TAKEN!
    if (status === 'TAKEN') {
      medication.remainingQuantity = Math.max(0, medication.remainingQuantity - 1);
      await medication.save();
    }

    // 3. Create or update dose record
    const doseRecord = await MedicationDose.create({
      medicationId: medication._id,
      patientId: medication.patientId,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
      takenAt: status === 'TAKEN' ? new Date() : null,
      status,
      syncId: syncId || undefined,
      notes: notes || '',
    });

    const isLowStock = medication.remainingQuantity <= medication.refillThreshold;

    return res.status(201).json({
      success: true,
      message: `Dose recorded as ${status}. Stock remaining: ${medication.remainingQuantity}`,
      dose: doseRecord,
      remainingQuantity: medication.remainingQuantity,
      isLowStock,
    });
  }

  res.status(404).json({ success: false, message: 'Database not connected' });
});

/**
 * @desc    Request a refill for a medication
 * @route   POST /api/patient-medications/:id/refill
 * @access  Private
 */
export const requestMedicationRefill = asyncHandler(async (req, res) => {
  const { id } = req.params; // medicationId
  const { requestedQuantity = 30, reason } = req.body;
  const patientId = req.user?._id;

  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
    const medication = await PatientMedication.findById(id);
    if (!medication) {
      return res.status(404).json({ success: false, message: 'Medication not found' });
    }

    // Check if pending refill request already exists
    const existingPending = await RefillRequest.findOne({
      medicationId: id,
      status: 'REQUESTED',
    });

    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: 'A refill request is already pending for this medication.',
        refillRequest: existingPending,
      });
    }

    const refill = await RefillRequest.create({
      medicationId: medication._id,
      patientId,
      medicineName: medication.medicineName,
      currentRemaining: medication.remainingQuantity,
      requestedQuantity: Number(requestedQuantity) || 30,
      reason: reason || `Stock low (${medication.remainingQuantity} remaining). Refill requested by patient.`,
      status: 'REQUESTED',
    });

    return res.status(201).json({
      success: true,
      message: 'Refill request submitted to your doctor and care team.',
      refillRequest: refill,
    });
  }

  res.status(404).json({ success: false, message: 'Database offline' });
});

/**
 * @desc    Doctor/care team review refill request (APPROVE, REJECT, FULFILL)
 * @route   PATCH /api/patient-medications/refills/:refillId
 * @access  Private
 */
export const reviewRefillRequest = asyncHandler(async (req, res) => {
  const { refillId } = req.params;
  const { status, notes } = req.body;
  const reviewerId = req.user?._id;

  const validStatuses = ['REQUESTED', 'APPROVED', 'REJECTED', 'FULFILLED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
    });
  }

  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(refillId)) {
    const refill = await RefillRequest.findById(refillId);
    if (!refill) {
      return res.status(404).json({ success: false, message: 'Refill request not found' });
    }

    refill.status = status;
    refill.reviewedBy = reviewerId;
    refill.reviewedAt = new Date();
    if (notes) refill.notes = notes;
    await refill.save();

    // If FULFILLED, replenish medication stock
    if (status === 'FULFILLED') {
      const medication = await PatientMedication.findById(refill.medicationId);
      if (medication) {
        medication.remainingQuantity += refill.requestedQuantity;
        await medication.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: `Refill request status updated to ${status}`,
      refillRequest: refill,
    });
  }

  res.status(404).json({ success: false, message: 'Database offline' });
});

/**
 * @desc    Add a new prescribed medication for a patient (Doctor)
 * @route   POST /api/patient-medications
 * @access  Private
 */
export const createPatientMedication = asyncHandler(async (req, res) => {
  const {
    patientId,
    prescriptionId,
    medicineName,
    dosage,
    frequency,
    schedule,
    prescribedQuantity = 30,
    remainingQuantity,
    refillThreshold = 5,
    instructions,
  } = req.body;

  const effectivePatientId = patientId || req.user?._id;

  if (!medicineName) {
    return res.status(400).json({ success: false, message: 'Medicine name is required' });
  }

  if (mongoose.connection.readyState === 1) {
    const newMed = await PatientMedication.create({
      patientId: effectivePatientId,
      prescriptionId: prescriptionId || null,
      medicineName: medicineName.trim(),
      dosage: dosage || '1 Tablet',
      frequency: frequency || 'Daily',
      schedule: Array.isArray(schedule) && schedule.length ? schedule : ['08:00 AM'],
      prescribedQuantity: Number(prescribedQuantity) || 30,
      remainingQuantity: remainingQuantity !== undefined ? Number(remainingQuantity) : Number(prescribedQuantity) || 30,
      refillThreshold: Number(refillThreshold) || 5,
      prescribingDoctor: req.user?.name || 'Doctor',
      activeStatus: true,
      instructions: instructions || '',
    });

    return res.status(201).json({
      success: true,
      message: 'Medication added successfully',
      medication: newMed,
    });
  }

  res.status(404).json({ success: false, message: 'Database offline' });
});

export default {
  getPatientMedications,
  recordMedicationDose,
  requestMedicationRefill,
  reviewRefillRequest,
  createPatientMedication,
};
