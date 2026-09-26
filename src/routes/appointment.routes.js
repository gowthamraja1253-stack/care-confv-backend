import { Router } from 'express';
import {
  getDoctors,
  bookAppointment,
  getUpcomingAppointments,
  getPatientAppointments,
  getDoctorQueue,
  updateAppointmentStatus,
  getAppointmentById,
} from '../controllers/appointment.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

// GET /api/appointments/doctors - Browse doctors by specialization & available slots
router.get('/doctors', protect, getDoctors);

// POST /api/appointments - Book a new appointment
router.post('/', protect, bookAppointment);

// GET /api/appointments/upcoming - Next upcoming appointment
router.get('/upcoming', protect, getUpcomingAppointments);

// GET /api/appointments/patient - Patient's appointment history
router.get('/patient', protect, getPatientAppointments);

// GET /api/appointments/doctor-queue - Doctor's appointment queue
router.get('/doctor-queue', protect, getDoctorQueue);

// PATCH /api/appointments/:id/status - Update appointment status (confirm, complete, cancel)
router.patch('/:id/status', protect, updateAppointmentStatus);

// GET /api/appointments/:id - Get single appointment & room metadata
router.get('/:id', protect, getAppointmentById);

export default router;
