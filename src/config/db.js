import mongoose from 'mongoose';
import config from './env.js';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 3000, // Timeout fast if local DB isn't started
    });

    console.log(`[MongoDB] Connected to database: ${conn.connection.name} @ ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.warn(`[MongoDB Warning] Database connection failed: ${error.message}`);
    console.warn(`[MongoDB Warning] Server will continue running, DB state will report 'disconnected'.`);
  }
};

export const getDbStatus = () => {
  const stateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return stateMap[mongoose.connection.readyState] || 'disconnected';
};

export default { connectDB, getDbStatus };
