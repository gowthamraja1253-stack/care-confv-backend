import { Router } from 'express';
import {
  getNearbyFacilities,
  getFacilityById,
  seedFacilities,
} from '../controllers/facility.controller.js';

const router = Router();

// GET /api/facilities - Get facilities with proximity sorting and type filtering
router.get('/', getNearbyFacilities);

// POST /api/facilities/seed - Seed sample facilities
router.post('/seed', seedFacilities);

// GET /api/facilities/:id - Get single facility details
router.get('/:id', getFacilityById);

export default router;
