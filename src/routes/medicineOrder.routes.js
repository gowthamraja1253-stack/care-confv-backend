import { Router } from 'express';
import {
  createMedicineOrder,
  getPatientOrders,
  getPharmacyOrders,
  updateOrderStatus,
} from '../controllers/medicineOrder.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = Router();

// POST /api/medicine-orders - Create order from prescription to a medical shop
router.post('/', protect, createMedicineOrder);

// GET /api/medicine-orders/patient - View logged-in patient's orders
router.get('/patient', protect, getPatientOrders);

// GET /api/medicine-orders/pharmacy - View pharmacy orders
router.get('/pharmacy', protect, getPharmacyOrders);

// PATCH /api/medicine-orders/:id/status - Update order status
router.patch('/:id/status', protect, updateOrderStatus);

export default router;
