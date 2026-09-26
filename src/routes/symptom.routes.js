import { Router } from 'express';
import {
  createSymptom,
  getPatientSymptoms,
  getSymptomById,
  analyzeSymptomById,
  getSymptomAnalysisById,
  chatWithDoctorAi,
} from '../controllers/symptom.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { aiRateLimiter } from '../middleware/security.middleware.js';

const router = Router();

// All symptom routes require authentication
router.use(protect);

// POST /api/symptoms/chat - Conversational AI voice & chat triage assistant (Rate limited)
router.route('/chat')
  .post(aiRateLimiter, chatWithDoctorAi);

// POST /api/symptoms - submit symptom assessment
// GET /api/symptoms - get patient past submissions
router.route('/')
  .post(createSymptom)
  .get(getPatientSymptoms);

// GET /api/symptoms/:id - get single submission details
router.route('/:id')
  .get(getSymptomById);

// POST /api/symptoms/:id/analyze - run AI analysis (Rate limited)
router.route('/:id/analyze')
  .post(aiRateLimiter, analyzeSymptomById);

// GET /api/symptoms/:id/analysis - get AI analysis
router.route('/:id/analysis')
  .get(getSymptomAnalysisById);

export default router;
