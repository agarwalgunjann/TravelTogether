const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const tripRoutes = require('./routes/tripRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Model for Seeder
const Trip = require('./models/Trip');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
connectDB().then(() => {
  seedInitialData();
});

// Seed Initial Data (Only if database is empty)
async function seedInitialData() {
  const count = await Trip.countDocuments();
  if (count === 0) {
    const initialTrips = []; // Keep empty as requested by user edits
    await Trip.insertMany(initialTrips);
    console.log('🌱 Seeded initial trip data (Database was empty)');
  }
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/notifications', notificationRoutes);

// Root
app.get('/', (req, res) => {
  res.json({ status: 'TravelConnect API is running smoothly', environment: process.env.NODE_ENV || 'development' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server launched on port ${PORT}`);
});
