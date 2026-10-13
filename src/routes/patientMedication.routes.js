import { Router } from 'express';
import {
  getPatientMedications,
  recordMedicationDose,
  requestMedicationRefill,
  reviewRefillRequest,
  createPatientMedication,
} from '../controllers/patientMedication.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.use(protect);

router.route('/')
  .get(getPatientMedications)
  .post(createPatientMedication);

router.route('/:id/dose')
  .post(recordMedicationDose);

router.route('/:id/refill')
  .post(requestMedicationRefill);

router.route('/refills/:refillId')
  .patch(reviewRefillRequest);

export default router;
