import { Router } from 'express';
import { getRiskProfile, recalculateRisk } from '../controllers/risk.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

// All risk routes require authentication
router.use(protect);

// GET /api/risk - get current risk profile
router.route('/')
  .get(getRiskProfile);

// POST /api/risk/recalculate - recalculate risk
router.route('/recalculate')
  .post(recalculateRisk);

export default router;
