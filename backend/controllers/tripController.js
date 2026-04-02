const Trip = require('../models/Trip');
const Notification = require('../models/Notification');

const CONFLICT_MSG = "You're already heading out on another adventure during these dates! 🗺️";


const hasDateConflict = async (userName, startDate, endDate, excludeTripId = null) => {
  const startStr = startDate;
  const endStr = endDate || startDate;

  const userTrips = await Trip.find({ friends: userName });

  return userTrips.some(t => {
    if (excludeTripId && t._id.toString() === excludeTripId.toString()) return false;
    const tStart = new Date(t.date);
    const tEnd = new Date(t.endDate || t.date);
    const requestStart = new Date(startStr);
    const requestEnd = new Date(endStr);
    return requestStart <= tEnd && requestEnd >= tStart;
  });
};

exports.getTrips = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      query = {
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { destination: { $regex: search, $options: 'i' } }
        ]
      };
    }
    const results = await Trip.find(query).sort({ date: 1 });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
};

exports.createTrip = async (req, res) => {
  try {
    const { title, destination, date, endDate, description, image, maxPeople, budget } = req.body;

    if (!title || title.trim().length < 3) return res.status(400).json({ error: 'Title must be at least 3 characters' });
    if (!destination || destination.trim().length < 2) return res.status(400).json({ error: 'Destination is required' });
    if (!date) return res.status(400).json({ error: 'Start date is required' });
    if (new Date(date) < new Date().setHours(0,0,0,0)) return res.status(400).json({ error: 'Start date cannot be in the past' });
    if (endDate && new Date(endDate) < new Date(date)) return res.status(400).json({ error: 'End date must be after start date' });
    if (!description || description.trim().length < 10) return res.status(400).json({ error: 'Description must be at least 10 characters' });

    if (await hasDateConflict(req.user.name, date, endDate)) {
      return res.status(409).json({ error: CONFLICT_MSG });
    }

    const trip = new Trip({
      title: title.trim(),
      destination: destination.trim(),
      date,
      endDate: endDate || date,
      description: description.trim(),
      image: image || 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?auto=format&fit=crop&w=1400&q=80',
      maxPeople: parseInt(maxPeople) || 10,
      budget: budget || 'To be discussed',
      organizer: req.user.name,
      organizerEmail: req.user.email,
      friends: [req.user.name],
      messages: [{ 
        sender: 'System', 
        text: `${req.user.name} launched this expedition! 🚀`, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }]
    });

    await trip.save();
    console.log(`📡 [DB] New Trip "${trip.title}" saved to Atlas by ${req.user.name}`);
    res.status(201).json(trip);
  } catch (err) {
    res.status(500).json({ error: 'Could not create trip' });
  }
};

exports.deleteTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (trip.organizer !== req.user.name) return res.status(403).json({ error: 'Only organizer can delete' });
    
    // Check if trip starts in less than 24 hours
    const tripStart = new Date(trip.date);
    const now = new Date();
    const diffHours = (tripStart - now) / (1000 * 60 * 60);
    
    if (diffHours < 24) {
      return res.status(400).json({ 
        error: "Cannot cancel trip within 24 hours of departure. It's time to pack! 🎒" 
      });
    }

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const membersToNotify = trip.friends.filter(f => f !== req.user.name);

    if (membersToNotify.length > 0) {
      const notes = membersToNotify.map(m => ({
        to: m,
        from: req.user.name,
        type: 'TRIP_CANCELLED',
        tripTitle: trip.title,
        message: `"${trip.title}" has been cancelled.`,
        time
      }));
      await Notification.insertMany(notes);
    }

    await Trip.deleteOne({ _id: req.params.id });
    res.json({ success: true, notified: membersToNotify.length });
  } catch (err) {
    res.status(500).json({ error: 'Deletion failed' });
  }
};

exports.joinTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (trip.friends.includes(req.user.name)) return res.status(409).json({ error: 'Already joined' });
    if (trip.friends.length >= trip.maxPeople) return res.status(409).json({ error: 'Trip is full' });

    if (await hasDateConflict(req.user.name, trip.date, trip.endDate)) {
      return res.status(409).json({ error: CONFLICT_MSG });
    }

    trip.friends.push(req.user.name);
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    trip.messages.push({ sender: 'System', text: `🤝 ${req.user.name} joined the expedition!`, time });
    await trip.save();

    const note = new Notification({
      to: trip.organizer,
      from: req.user.name,
      type: 'JOIN',
      tripId: trip._id,
      tripTitle: trip.title,
      time
    });
    await note.save();

    res.json({ success: true, trip });
  } catch (err) {
    res.status(500).json({ error: 'Joining failed' });
  }
};

exports.leaveTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (trip.organizer === req.user.name) return res.status(400).json({ error: 'Organizer cannot leave' });

    trip.friends = trip.friends.filter(f => f !== req.user.name);
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    trip.messages.push({ sender: 'System', text: `${req.user.name} left.`, time });
    await trip.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Leave failed' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Not found' });
    if (!trip.friends.includes(req.user.name)) return res.status(403).json({ error: 'Join first' });
    res.json(trip.messages);
  } catch (err) {
    res.status(500).json({ error: 'Fetch failed' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Empty message' });

    const trip = await Trip.findById(req.params.id);
    if (!trip || !trip.friends.includes(req.user.name)) return res.status(403).json({ error: 'Access denied' });

    trip.messages.push({
      sender: req.user.name,
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    await trip.save();
    res.status(201).json(trip.messages[trip.messages.length - 1]);
  } catch (err) {
    res.status(500).json({ error: 'Post failed' });
  }
};

exports.addChecklistItem = async (req, res) => {
  try {
    const { item } = req.body;
    const trip = await Trip.findById(req.params.id);
    if (!trip || !trip.friends.includes(req.user.name)) return res.status(403).json({ error: 'Forbidden' });

    trip.checklist.push({ item: item.trim(), addedBy: req.user.name });
    await trip.save();
    res.status(201).json(trip.checklist[trip.checklist.length - 1]);
  } catch (err) {
    res.status(500).json({ error: 'Add failed' });
  }
};

exports.toggleChecklistItem = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    
    const item = trip.checklist.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    item.completed = !item.completed;
    await trip.save();
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
};
