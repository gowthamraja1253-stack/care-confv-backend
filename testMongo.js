import mongoose from 'mongoose';

const uri = "mongodb+srv://rshivaakash2138_db_user:Shivucodes21@cluster0.drmdefz.mongodb.net/rural_health_link?retryWrites=true&w=majority";

mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 })
  .then(() => {
    console.log("Connected successfully");
    process.exit(0);
  })
  .catch(err => {
    console.error("Connection failed:", err.message);
    process.exit(1);
  });
