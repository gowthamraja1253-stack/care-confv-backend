import { Router } from 'express';
import {
  searchMedicines,
  getNearbyStock,
  getPharmacyStock,
  getMyPharmacyStock,
  updatePharmacyStock,
  deletePharmacyStock,
  seedMedicinesAndStock,
} from '../controllers/medicine.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = Router();

// GET /api/medicines - Search / list medicines catalog
router.get('/', searchMedicines);

// GET /api/medicines/nearby-stock - Search direct nearby registered pharmacies with in-stock medicines
router.get('/nearby-stock', getNearbyStock);

// GET /api/medicines/stock - View pharmacy inventory stock records
router.get('/stock', getPharmacyStock);

// GET /api/medicines/my-stock - View currently logged-in pharmacy center's live inventory
router.get('/my-stock', protect, authorize('pharmacy', 'admin'), getMyPharmacyStock);

// POST /api/medicines/stock - Update stock in/out and quantity (Restricted to Pharmacy & Admin roles)
router.post('/stock', protect, authorize('pharmacy', 'admin'), updatePharmacyStock);

// DELETE /api/medicines/stock/:id - Delete item from center inventory
router.delete('/stock/:id', protect, authorize('pharmacy', 'admin'), deletePharmacyStock);

// POST /api/medicines/seed - Verify medicines catalog
router.post('/seed', seedMedicinesAndStock);

export default router;
