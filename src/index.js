import express from 'express';
import http from 'http';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config/env.js';
import { connectDB } from './config/db.js';
import apiRoutes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { initSocketServer } from './services/socket.js';

import zlib from 'zlib';
import { enforceHttps, secureHeaders, generalRateLimiter } from './middleware/security.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust reverse proxy headers (Nginx, Caddy, Cloudflare, Traefik, AWS ALB, etc.)
app.set('trust proxy', config.trustProxy === 'true' || config.trustProxy === '1' ? 1 : config.trustProxy);

// Create HTTP or Native HTTPS Server (Provider-Agnostic)
let serverInstance = null;
if (config.httpsEnabled && config.sslKeyPath && config.sslCertPath) {
  try {
    const key = fs.readFileSync(path.resolve(config.sslKeyPath));
    const cert = fs.readFileSync(path.resolve(config.sslCertPath));
    serverInstance = https.createServer({ key, cert }, app);
    console.log('[Server] Native HTTPS enabled with SSL certificate');
  } catch (sslErr) {
    console.warn('[Server] SSL certificate loading failed, falling back to HTTP:', sslErr.message);
    serverInstance = http.createServer(app);
  }
} else {
  serverInstance = http.createServer(app);
}
const httpServer = serverInstance;


// Production Security Middlewares (HTTPS Enforcement, Secure Headers & Rate Limiting)
app.use(enforceHttps);
app.use(secureHeaders);
app.use(generalRateLimiter);

// Request logging via morgan
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));

// Lightweight Gzip / Deflate Compression Middleware for Low-Bandwidth Networks
app.use((req, res, next) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (!acceptEncoding.includes('gzip')) {
    return next();
  }

  const originalSend = res.send;
  res.send = function (body) {
    if (typeof body === 'string' && body.length > 512) {
      res.set('Content-Encoding', 'gzip');
      zlib.gzip(Buffer.from(body), (err, compressed) => {
        if (err) {
          res.removeHeader('Content-Encoding');
          return originalSend.call(res, body);
        }
        res.set('Content-Length', compressed.length);
        return originalSend.call(res, compressed);
      });
    } else {
      return originalSend.call(res, body);
    }
  };
  next();
});

// Provider-Agnostic Dynamic CORS Configuration
const configuredOrigins = (config.allowedOrigins || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = [
  config.clientOrigin,
  'http://localhost:3000',
  'https://localhost:3000',
  'http://127.0.0.1:3000',
  'https://127.0.0.1:3000',
  ...configuredOrigins,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, origin);
    }
    const isMatched = allowedOrigins.some((allowed) => {
      if (allowed === '*') return true;
      if (allowed.startsWith('*.')) {
        const domain = allowed.slice(2);
        try {
          const url = new URL(origin);
          return url.hostname.endsWith(domain);
        } catch {
          return origin.endsWith(allowed.slice(1));
        }
      }
      return false;
    });
    if (isMatched) return callback(null, origin);
    if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:') || origin.startsWith('http://127.0.0.1:') || origin.startsWith('https://127.0.0.1:')) {
      return callback(null, origin);
    }
    if (config.nodeEnv === 'development') {
      return callback(null, origin);
    }
    callback(new Error(`CORS origin not allowed by policy: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded static files (Health records, PDFs, images)
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// API Routes
app.use('/api', apiRoutes);

// Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize Socket.IO with WebRTC Signaling & Real-Time Chat
initSocketServer(httpServer, allowedOrigins);

// Start Server & Connect Database
const startServer = async () => {
  await connectDB();

  httpServer.listen(config.port, () => {
    console.log(`[Server] Rural Health Link Express & Socket.IO server running on port ${config.port} (${config.nodeEnv})`);
  });
};

startServer();

export { app, httpServer };
export default app;
