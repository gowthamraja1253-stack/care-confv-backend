import { Router } from 'express';
import {
  triageAndEscalate,
  getActiveEmergencyEvent,
  getEmergencyEvents,
  updateEmergencyStatus,
} from '../controllers/emergencyEvent.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.use(protect);

router.route('/triage').post(triageAndEscalate);
router.route('/active').get(getActiveEmergencyEvent);
router.route('/').get(getEmergencyEvents);
router.route('/:id/status').patch(updateEmergencyStatus);

export default router;
