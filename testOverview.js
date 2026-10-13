import request from 'http';
import app from './src/index.js';
import mongoose from 'mongoose';
import { connectDB } from './src/config/db.js';

// We need to bypass JWT auth for a quick test or just generate a token.
import User from './src/models/User.model.js';

const testOverview = async () => {
  await connectDB();
  console.log("DB ReadyState:", mongoose.connection.readyState);
  
  if (mongoose.connection.readyState !== 1) {
    console.error("DB Not connected");
    process.exit(1);
  }

  // Find a patient user
  const user = await User.findOne({ role: 'patient' });
  if (!user) {
    console.error("No patient found");
    process.exit(1);
  }
  
  const token = user.generateAuthToken();

  const server = app.listen(5009, async () => {
    console.log("Server listening on 5009");

    try {
      const options = {
        hostname: 'localhost',
        port: 5009,
        path: '/api/health-records/patient/overview',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      };
      
      const req = request.request(options, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log(`Status: ${res.statusCode}`);
          // truncate data because it can be huge
          console.log(`Body: ${data.substring(0, 500)}...`);
          server.close();
          process.exit(0);
        });
      });

      req.on('error', e => {
        console.error(`Problem with request: ${e.message}`);
        server.close();
        process.exit(1);
      });

      req.end();
      
    } catch (e) {
      console.log(e);
      process.exit(1);
    }
  });
};

setTimeout(testOverview, 2000);
