import { Router } from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  getPreventiveTips,
  refreshPreventiveTips,
} from '../controllers/preventiveTip.controller.js';

const router = Router();

// GET /api/preventive-tips - Fetch today's personalized tips
router.get('/', protect, getPreventiveTips);

// POST /api/preventive-tips/refresh - Force regenerate with latest clinical & seasonal parameters
router.post('/refresh', protect, refreshPreventiveTips);

export default router;
