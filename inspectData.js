import mongoose from 'mongoose';
import { connectDB } from './src/config/db.js';
import User from './src/models/User.model.js';
import HealthRecord from './src/models/HealthRecord.model.js';

const inspectData = async () => {
  try {
    await connectDB();
    console.log("DB connected");

    const patient = await User.findOne({ role: 'patient' });
    if (!patient) {
      console.log("No patient found");
      process.exit(1);
    }
    console.log("Found patient:", patient._id, patient.firstName);

    const records = await HealthRecord.find({ patientId: patient._id }).sort({ date: -1 });
    console.log(`Found ${records.length} records`);

    if (records.length > 0) {
      console.log("Sample record 0 vitals:", records[0].vitals);
      console.log("Sample record 0 labResults:", records[0].labResults);
      console.log("Sample record 0:", JSON.stringify(records[0], null, 2).substring(0, 500));
    }
    
    // Check if any record has labResults
    const recordsWithLabs = records.filter(r => r.labResults && r.labResults.length > 0);
    console.log(`Records with labResults: ${recordsWithLabs.length}`);
    
    // Check if any record has vitals
    const recordsWithVitals = records.filter(r => r.vitals);
    console.log(`Records with vitals: ${recordsWithVitals.length}`);

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

inspectData();
