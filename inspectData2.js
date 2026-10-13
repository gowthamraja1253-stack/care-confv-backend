import mongoose from 'mongoose';
import { connectDB } from './src/config/db.js';
import HealthRecord from './src/models/HealthRecord.model.js';

const inspectData = async () => {
  try {
    await connectDB();
    const record = await HealthRecord.findOne().sort({ date: -1 });
    console.log(JSON.stringify(record, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

inspectData();
