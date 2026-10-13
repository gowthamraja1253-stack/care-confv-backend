import request from 'http';
import app from './src/index.js';
import { connectDB } from './src/config/db.js';
import mongoose from 'mongoose';

const testLogin = async () => {
  // wait for db to actually connect
  await connectDB();
  console.log("DB ReadyState:", mongoose.connection.readyState);
  
  const server = app.listen(5005, async () => {
    console.log("Server listening on 5005");

    try {
      const options = {
        hostname: 'localhost',
        port: 5005,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      const req = request.request(options, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log(`Status: ${res.statusCode}`);
          console.log(`Body: ${data}`);
          server.close();
          process.exit(0);
        });
      });

      req.on('error', e => {
        console.error(`Problem with request: ${e.message}`);
        server.close();
        process.exit(1);
      });

      req.write(JSON.stringify({ identifier: 'test@test.com', password: 'password123' }));
      req.end();
      
    } catch (e) {
      console.log(e);
      process.exit(1);
    }
  });
};

// delay a bit to let index.js's connectDB fail/finish if needed
setTimeout(testLogin, 2000);
