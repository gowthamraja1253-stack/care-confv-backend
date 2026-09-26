import asyncHandler from '../utils/asyncHandler.js';

/**
 * @desc    Get active prescription reminders for logged in user
 * @route   GET /api/reminders/active
 * @access  Private
 */
export const getActiveReminders = asyncHandler(async (req, res) => {
  const { empty } = req.query;

  // Support empty state testing via ?empty=true
  if (empty === 'true') {
    return res.status(200).json({
      success: true,
      count: 0,
      reminders: [],
    });
  }

  // Sample active prescription reminder data
  const reminders = [
    {
      _id: 'rem-001',
      medicineName: 'Metformin 500mg',
      instructions: '1 Tablet • After Dinner',
      scheduledTime: '08:30 PM Tonight',
      doctor: 'Prescribed by Dr. Ananya Sharma',
      refillWarning: 'Stock low: 3 doses left',
      isUrgentRefill: true,
      isTaken: false,
      createdAt: new Date().toISOString(),
    },
  ];

  res.status(200).json({
    success: true,
    count: reminders.length,
    reminders,
  });
});

export default { getActiveReminders };
