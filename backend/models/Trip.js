const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  title: { type: String, required: true },
  destination: { type: String, required: true },
  date: { type: String, required: true },
  endDate: { type: String },
  organizer: { type: String, required: true },
  organizerEmail: { type: String, required: true },
  friends: [{ type: String }],
  image: { type: String },
  description: { type: String, required: true },
  status: { type: String, default: 'Open' },
  maxPeople: { type: Number, default: 10 },
  budget: { type: String },
  messages: [{
    sender: String,
    text: String,
    time: String
  }],
  checklist: [{
    item: String,
    completed: { type: Boolean, default: false },
    addedBy: String
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

tripSchema.virtual('id').get(function() { return this._id.toHexString(); }); 
// Map subdoc ids too
tripSchema.path('checklist').schema.set('toJSON', { virtuals: true });
tripSchema.path('checklist').schema.set('toObject', { virtuals: true });
tripSchema.path('checklist').schema.virtual('id').get(function() { return this._id.toHexString(); });


module.exports = mongoose.model('Trip', tripSchema);
