import { Router } from 'express';
import { getIceConfiguration } from '../services/webrtc.service.js';
import { optionalAuth } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * @route   GET /api/webrtc/ice-servers
 * @desc    Get production-safe ICE & TURN servers with short-lived credentials
 * @access  Public / Optional Auth (Supports guests & authenticated users)
 */
router.get('/ice-servers', optionalAuth, (req, res) => {
  const userId = req.user?.id || req.user?._id || 'guest';
  const iceConfig = getIceConfiguration(userId);

  res.json({
    success: true,
    data: iceConfig,
  });
});

export default router;
