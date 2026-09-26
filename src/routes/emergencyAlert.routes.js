import { Router } from 'express';
import {
  getActiveAlert,
  notifyEmergencyContact,
  resolveAlert,
} from '../controllers/emergencyAlert.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

// All emergency alert routes require authentication
router.use(protect);

// GET /api/emergency-alerts/active - get current active emergency alert
router.route('/active')
  .get(getActiveAlert);

// POST /api/emergency-alerts/:id/notify-contact - notify emergency contact
router.route('/:id/notify-contact')
  .post(notifyEmergencyContact);

// POST /api/emergency-alerts/:id/resolve - resolve emergency alert
router.route('/:id/resolve')
  .post(resolveAlert);

export default router;
