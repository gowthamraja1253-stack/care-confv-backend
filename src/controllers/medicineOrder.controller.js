import asyncHandler from '../utils/asyncHandler.js';
import MedicineOrder from '../models/MedicineOrder.model.js';
import Facility from '../models/Facility.model.js';
import User from '../models/User.model.js';
import mongoose from 'mongoose';
import { notifyNewMedicineOrder, notifyOrderStatusUpdate } from '../services/socket.js';

// In-Memory store fallback
const inMemoryOrders = [];

/**
 * @desc    Create a new medicine order from prescription to a nearby pharmacy
 * @route   POST /api/medicine-orders
 * @access  Private (Patient / All)
 */
export const createMedicineOrder = asyncHandler(async (req, res) => {
  const {
    pharmacyId,
    prescriptionId,
    prescriptionTitle = '',
    doctorName = '',
    medicines = [],
    deliveryType = 'pickup',
    deliveryAddress = '',
    contactPhone = '',
    notes = '',
  } = req.body;

  const user = req.user || {};
  const patientId = user._id || user.id || 'patient-default';
  const patientName = user.name || 'Patient';
  const patientPhone = contactPhone || user.phone || '9876543210';
  const patientVillage = user.village || 'Rampur Village';

  if (!pharmacyId) {
    return res.status(400).json({
      success: false,
      message: 'Please select a nearby pharmacy / medical shop',
    });
  }

  if (!Array.isArray(medicines) || medicines.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one medicine item is required for the order',
    });
  }

  let pharmacyName = 'Nearby Medical Center';
  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(pharmacyId)) {
    try {
      const facility = await Facility.findById(pharmacyId);
      if (facility) {
        pharmacyName = facility.name;
      }
    } catch (e) {}
  }

  // Generate unique order ID: e.g. ORD-847291
  const uniqueSuffix = Math.floor(100000 + Math.random() * 900000);
  const orderId = `ORD-${uniqueSuffix}`;

  // Estimate total price: fallback ₹25 per item if 0
  const totalPrice = medicines.reduce((sum, item) => {
    const itemPrice = item.price && item.price > 0 ? Number(item.price) : 25;
    const qty = item.quantity && item.quantity > 0 ? Number(item.quantity) : 1;
    return sum + itemPrice * qty;
  }, 0);

  const orderData = {
    orderId,
    patientId: mongoose.Types.ObjectId.isValid(patientId) ? new mongoose.Types.ObjectId(patientId) : patientId,
    patientName,
    patientPhone,
    patientVillage,
    pharmacyId: mongoose.Types.ObjectId.isValid(pharmacyId) ? new mongoose.Types.ObjectId(pharmacyId) : pharmacyId,
    pharmacyName,
    prescriptionId: prescriptionId && mongoose.Types.ObjectId.isValid(prescriptionId) ? new mongoose.Types.ObjectId(prescriptionId) : null,
    prescriptionTitle,
    doctorName,
    medicines,
    deliveryType,
    deliveryAddress: deliveryAddress || patientVillage,
    status: 'pending',
    totalEstimatedPrice: totalPrice,
    notes,
  };

  let savedOrder = null;

  if (mongoose.connection.readyState === 1) {
    try {
      savedOrder = await MedicineOrder.create(orderData);
      await savedOrder.populate('pharmacyId', 'name address phone location');
    } catch (dbErr) {
      console.warn('[MedicineOrder] DB create error, falling back to in-memory store:', dbErr.message);
    }
  }

  if (!savedOrder) {
    savedOrder = {
      _id: `order-mem-${Date.now()}`,
      ...orderData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    inMemoryOrders.unshift(savedOrder);
  }

  // Real-time socket notification to pharmacy
  notifyNewMedicineOrder(savedOrder);

  res.status(201).json({
    success: true,
    message: 'Medicine order sent successfully to nearby pharmacy',
    order: savedOrder,
  });
});

/**
 * @desc    Get patient's active and past medicine orders
 * @route   GET /api/medicine-orders/patient
 * @access  Private (Patient)
 */
export const getPatientOrders = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id;

  let orders = [];

  if (mongoose.connection.readyState === 1 && userId && mongoose.Types.ObjectId.isValid(userId)) {
    try {
      orders = await MedicineOrder.find({ patientId: new mongoose.Types.ObjectId(userId) })
        .populate('pharmacyId', 'name address phone location')
        .sort({ createdAt: -1 });
    } catch (err) {
      console.warn('[MedicineOrder] DB find patient orders error:', err.message);
    }
  }

  if (!orders || orders.length === 0) {
    orders = inMemoryOrders.filter((o) => String(o.patientId) === String(userId));
  }

  res.status(200).json({
    success: true,
    count: orders.length,
    orders,
  });
});

/**
 * @desc    Get incoming prescription orders for pharmacy medical shop
 * @route   GET /api/medicine-orders/pharmacy
 * @access  Private (Pharmacy / Admin)
 */
export const getPharmacyOrders = asyncHandler(async (req, res) => {
  const { status, pharmacyId } = req.query;
  const user = req.user || {};

  let orders = [];

  if (mongoose.connection.readyState === 1) {
    try {
      const query = {};
      if (status && status !== 'all') {
        query.status = status;
      }
      if (pharmacyId && mongoose.Types.ObjectId.isValid(pharmacyId)) {
        query.pharmacyId = new mongoose.Types.ObjectId(pharmacyId);
      }

      orders = await MedicineOrder.find(query)
        .populate('patientId', 'name phone village')
        .populate('pharmacyId', 'name address phone')
        .sort({ createdAt: -1 });
    } catch (err) {
      console.warn('[MedicineOrder] DB find pharmacy orders error:', err.message);
    }
  }

  if (!orders || orders.length === 0) {
    orders = inMemoryOrders.filter((o) => (status && status !== 'all' ? o.status === status : true));
  }

  res.status(200).json({
    success: true,
    count: orders.length,
    orders,
  });
});

/**
 * @desc    Update order status (accept, ready, complete, cancel)
 * @route   PATCH /api/medicine-orders/:id/status
 * @access  Private (Pharmacy / Admin)
 */
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const validStatuses = ['pending', 'accepted', 'ready', 'completed', 'cancelled'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Allowed: ${validStatuses.join(', ')}`,
    });
  }

  let updatedOrder = null;

  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
    try {
      const updateFields = { status };
      if (status === 'accepted') updateFields.acceptedAt = new Date();
      if (status === 'ready') updateFields.readyAt = new Date();
      if (status === 'completed') updateFields.completedAt = new Date();
      if (notes) updateFields.notes = notes;

      updatedOrder = await MedicineOrder.findByIdAndUpdate(id, updateFields, { new: true })
        .populate('patientId', 'name phone village')
        .populate('pharmacyId', 'name address phone');
    } catch (err) {
      console.warn('[MedicineOrder] DB update status error:', err.message);
    }
  }

  if (!updatedOrder) {
    const memOrder = inMemoryOrders.find((o) => o._id === id || o.id === id || o.orderId === id);
    if (memOrder) {
      memOrder.status = status;
      if (status === 'accepted') memOrder.acceptedAt = new Date().toISOString();
      if (status === 'ready') memOrder.readyAt = new Date().toISOString();
      if (status === 'completed') memOrder.completedAt = new Date().toISOString();
      if (notes) memOrder.notes = notes;
      updatedOrder = memOrder;
    }
  }

  if (!updatedOrder) {
    return res.status(404).json({
      success: false,
      message: 'Medicine order not found',
    });
  }

  // Notify patient in real-time
  notifyOrderStatusUpdate(updatedOrder);

  res.status(200).json({
    success: true,
    message: `Order status updated to ${status}`,
    order: updatedOrder,
  });
});
