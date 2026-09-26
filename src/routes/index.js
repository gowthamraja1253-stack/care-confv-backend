import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import appointmentRoutes from './appointment.routes.js';
import reminderRoutes from './reminder.routes.js';
import symptomRoutes from './symptom.routes.js';
import riskRoutes from './risk.routes.js';
import emergencyAlertRoutes from './emergencyAlert.routes.js';
import healthRecordRoutes from './healthRecord.routes.js';
import facilityRoutes from './facility.routes.js';
import medicineRoutes from './medicine.routes.js';
import preventiveTipRoutes from './preventiveTip.routes.js';
import medicineOrderRoutes from './medicineOrder.routes.js';
import webrtcRoutes from './webrtc.routes.js';

const router = Router();

// Mount subroutes
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/reminders', reminderRoutes);
router.use('/symptoms', symptomRoutes);
router.use('/risk', riskRoutes);
router.use('/emergency-alerts', emergencyAlertRoutes);
router.use('/health-records', healthRecordRoutes);
router.use('/facilities', facilityRoutes);
router.use('/medicines', medicineRoutes);
router.use('/preventive-tips', preventiveTipRoutes);
router.use('/medicine-orders', medicineOrderRoutes);
router.use('/webrtc', webrtcRoutes);

export default router;
