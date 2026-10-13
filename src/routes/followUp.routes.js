import { Router } from 'express';
import {
  createFollowUp,
  getFollowUps,
  updateFollowUpStatus,
} from '../controllers/followUp.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.use(protect);

router.route('/')
  .get(getFollowUps)
  .post(createFollowUp);

router.route('/:id/status')
  .patch(updateFollowUpStatus);

export default router;
