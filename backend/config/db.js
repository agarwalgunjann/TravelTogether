const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ DATABASE LIVE: Connected to ${conn.connection.name} Cluster`);
  } catch (err) {
    console.error('❌ DATABASE FATAL ERROR:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
