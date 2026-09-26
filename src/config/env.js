import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from both server root and project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rural_health_link',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || 'rural_health_link_jwt_secret_super_key_2026',
  jwtExpire: process.env.JWT_EXPIRE || '7d',
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
  stunServers: process.env.STUN_SERVERS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302',
  turnServerUrls: process.env.TURN_SERVER_URLS || process.env.TURN_URL || '',
  turnSecret: process.env.TURN_SECRET || '',
  turnUsername: process.env.TURN_USERNAME || '',
  turnCredential: process.env.TURN_CREDENTIAL || '',
  turnTtlSeconds: parseInt(process.env.TURN_TTL_SECONDS || '86400', 10),
  libretranslateUrl: process.env.LIBRETRANSLATE_URL || '',
  trustProxy: process.env.TRUST_PROXY || '1',
  httpsEnabled: process.env.HTTPS_ENABLED === 'true',
  sslKeyPath: process.env.SSL_KEY_PATH || '',
  sslCertPath: process.env.SSL_CERT_PATH || '',
  allowedOrigins: process.env.ALLOWED_ORIGINS || '',
};

export default config;
