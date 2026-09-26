import { Router } from 'express';
import {
  createHealthRecord,
  getPatientHealthRecords,
  getPatientsList,
  getHealthRecordById,
  deleteHealthRecord,
  explainHealthRecord,
} from '../controllers/healthRecord.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { uploadHealthRecordFile } from '../middleware/upload.middleware.js';
import { aiRateLimiter } from '../middleware/security.middleware.js';

const router = Router();

// GET /api/health-records/patients - Get list of patients for doctors
router.get('/patients', protect, getPatientsList);

// GET /api/health-records/patient - Get patient's health records with tab filter
router.get('/patient', protect, getPatientHealthRecords);

// POST /api/health-records - Create a health record with optional file attachment
router.post('/', protect, uploadHealthRecordFile.single('file'), createHealthRecord);

// POST /api/health-records/:id/explain - Plain-language AI explanation of prescription or test report
router.post('/:id/explain', protect, aiRateLimiter, explainHealthRecord);

// GET /api/health-records/:id - Get specific health record details
router.get('/:id', protect, getHealthRecordById);

// DELETE /api/health-records/:id - Delete a health record
router.delete('/:id', protect, deleteHealthRecord);

export default router;
