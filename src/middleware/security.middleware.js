import config from '../config/env.js';

/**
 * Production Security Middleware
 * Features:
 * 1. HTTPS Enforcement: Redirects HTTP to HTTPS in production
 * 2. Secure Response Headers: HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy
 * 3. In-Memory Sliding-Window Rate Limiting for Auth, AI, and General API endpoints
 */

// In-memory rate limit store: key -> { count, resetTime }
const rateLimitStore = new Map();

// Periodic cleanup of expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * HTTPS Enforcement Middleware
 */
export const enforceHttps = (req, res, next) => {
  if (config.nodeEnv === 'production') {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    const host = req.headers.host || '';
    if (!isHttps && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
      return res.redirect(301, `https://${host}${req.url}`);
    }
  }
  next();
};

/**
 * Secure HTTP Response Headers Middleware
 */
export const secureHeaders = (req, res, next) => {
  // Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Clickjacking protection
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // Legacy XSS protection for older mobile browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Strict referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions Policy: allow camera, microphone for WebRTC teleconsultation in secure context
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)');

  // Enforce HSTS in production or over HTTPS
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (isHttps || config.nodeEnv === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
};

/**
 * Factory for creating sliding-window rate limiters
 * @param {object} options - { windowMs, maxRequests, message }
 */
export const createRateLimiter = ({
  windowMs = 60 * 1000,
  maxRequests = 100,
  message = 'Too many requests from this IP, please try again later.',
}) => {
  return (req, res, next) => {
    // Determine client identifier (respecting proxy headers if configured)
    const clientIp =
      req.ip ||
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const key = `${req.baseUrl || req.path}:${clientIp}`;
    const now = Date.now();

    let record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (record.count > maxRequests) {
      res.setHeader('Retry-After', resetSeconds);
      return res.status(429).json({
        success: false,
        message,
        retryAfterSeconds: resetSeconds,
      });
    }

    next();
  };
};

// Specialized limiters for critical paths
export const authRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 30,          // 30 auth requests per 5 minutes
  message: 'Too many authentication attempts. Please wait a few minutes before trying again.',
});

export const aiRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 50,          // 50 AI queries per 5 minutes (protects Groq/Sarvam quota)
  message: 'AI consultation rate limit reached for this session. Please wait a few moments.',
});

export const generalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,      // 1 minute
  maxRequests: 350,         // 350 requests per minute
  message: 'Network rate limit exceeded. Please wait a moment.',
});

export default {
  enforceHttps,
  secureHeaders,
  createRateLimiter,
  authRateLimiter,
  aiRateLimiter,
  generalRateLimiter,
};
