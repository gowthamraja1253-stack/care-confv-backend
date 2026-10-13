import { Router } from 'express';
import {
  getPatientClinicalSnapshot,
  getPatientTimeline,
} from '../controllers/clinicalSummary.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.use(protect);

router.route('/:patientId').get(getPatientClinicalSnapshot);
router.route('/:patientId/timeline').get(getPatientTimeline);

export default router;
