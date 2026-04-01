const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  to: { type: String, required: true },
  from: { type: String },
  type: { type: String, enum: ['JOIN', 'TRIP_CANCELLED'], required: true },
  tripId: { type: String },
  tripTitle: { type: String },
  message: { type: String },
  read: { type: Boolean, default: false },
  time: { type: String }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

notificationSchema.virtual('id').get(function() { return this._id.toHexString(); }); 


module.exports = mongoose.model('Notification', notificationSchema);
