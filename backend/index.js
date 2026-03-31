const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 5000;
const SECRET = 'travelconnect_secret_2024';

app.use(cors());
app.use(express.json());

// ─── In-Memory Store ────────────────────────────────────────────────────
let users = [];
let notifications = [];
let trips = [
  {
    id: 1,
    title: 'Santorini Sunset Escape',
    destination: 'Santorini, Greece',
    date: '2025-08-15',
    endDate: '2025-08-22',
    organizer: 'Alex Johnson',
    organizerEmail: 'alex@demo.com',
    friends: ['Alex Johnson'],
    image: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1400&q=80',
    description: 'Experience the iconic whitewashed buildings, dramatic caldera views, and world-class Mediterranean cuisine. This trip combines luxury, culture, and breathtaking photography opportunities.',
    status: 'Planning',
    maxPeople: 8,
    budget: '$2,500 per person',
    messages: [
      { sender: 'System', text: 'Trip created! Start coordinating below.', time: '09:00' }
    ],
    checklist: [
      { id: 1, item: 'Book ferry from Athens', completed: false },
      { id: 2, item: 'Reserve caldera-view hotel', completed: true },
      { id: 3, item: 'Plan wine-tasting evening', completed: false }
    ]
  },
  {
    id: 2,
    title: 'Swiss Alps Winter Trek',
    destination: 'Zermatt, Switzerland',
    date: '2025-12-01',
    endDate: '2025-12-08',
    organizer: 'Maria Schmidt',
    organizerEmail: 'maria@demo.com',
    friends: ['Maria Schmidt'],
    image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1400&q=80',
    description: 'Conquer the Matterhorn trail and ski world-class slopes. This adventure includes guided glacier hikes, cozy mountain chalets, and fondue evenings with the crew.',
    status: 'Open',
    maxPeople: 6,
    budget: '$3,200 per person',
    messages: [],
    checklist: [
      { id: 1, item: 'Rent ski equipment', completed: false },
      { id: 2, item: 'Buy travel insurance', completed: false }
    ]
  },
  {
    id: 3,
    title: 'Kyoto Cherry Blossom Tour',
    destination: 'Kyoto, Japan',
    date: '2025-03-28',
    endDate: '2025-04-05',
    organizer: 'Yuki Tanaka',
    organizerEmail: 'yuki@demo.com',
    friends: ['Yuki Tanaka'],
    image: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=1400&q=80',
    description: 'Walk through the ancient temples and bamboo groves of Kyoto during peak sakura season. Includes tea ceremony classes, geisha district visits, and a bullet train day-trip to Osaka.',
    status: 'Open',
    maxPeople: 10,
    budget: '$2,800 per person',
    messages: [],
    checklist: [
      { id: 1, item: 'Book JR rail passes', completed: true },
      { id: 2, item: 'Reserve ryokan (traditional inn)', completed: false },
      { id: 3, item: 'Tea ceremony reservations', completed: false }
    ]
  }
];

// ─── Helpers ─────────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Malformed token' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please sign in again' });
  }
};

const hasDateConflict = (userName, startDate, endDate, excludeTripId = null) => {
  const start = new Date(startDate);
  const end = new Date(endDate || startDate);
  return trips.some(t => {
    if (t.id === excludeTripId) return false;
    if (!t.friends.includes(userName)) return false;
    const tStart = new Date(t.date);
    const tEnd = new Date(t.endDate || t.date);
    return start <= tEnd && end >= tStart;
  });
};

// Shared conflict error message (matches requirement spec)
const CONFLICT_MSG = 'User is already part of another trip during this time period.';

// ─── Root ─────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'TravelConnect API running', version: '2.0', port: PORT });
});

// ─── Auth ─────────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;

  // Validation
  if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email address' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const exists = users.find(u => u.email === email.toLowerCase());
  if (exists) return res.status(409).json({ error: 'Email already registered' });

  const hash = await bcrypt.hash(password, 12);
  const user = { id: Date.now(), name: name.trim(), email: email.toLowerCase(), password: hash, joinedAt: new Date().toISOString() };
  users.push(user);

  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = users.find(u => u.email === email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'No account found with that email' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Incorrect password' });

  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

// ─── Trips ────────────────────────────────────────────────────────────────
app.get('/api/trips', (req, res) => {
  const { search } = req.query;
  let result = trips;
  if (search) result = trips.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.destination.toLowerCase().includes(search.toLowerCase())
  );
  res.json(result);
});

app.post('/api/trips', auth, (req, res) => {
  const { title, destination, date, endDate, description, image, maxPeople, budget } = req.body;

  // Validation
  if (!title || title.trim().length < 3) return res.status(400).json({ error: 'Title must be at least 3 characters' });
  if (!destination || destination.trim().length < 2) return res.status(400).json({ error: 'Destination is required' });
  if (!date) return res.status(400).json({ error: 'Start date is required' });
  if (new Date(date) < new Date()) return res.status(400).json({ error: 'Start date cannot be in the past' });
  if (endDate && new Date(endDate) < new Date(date)) return res.status(400).json({ error: 'End date must be after start date' });
  if (!description || description.trim().length < 10) return res.status(400).json({ error: 'Description must be at least 10 characters' });

  // Conflict check for organizer
  if (hasDateConflict(req.user.name, date, endDate)) {
    return res.status(409).json({ error: CONFLICT_MSG });
  }

  const trip = {
    id: Date.now(),
    title: title.trim(),
    destination: destination.trim(),
    date,
    endDate: endDate || date,
    description: description.trim(),
    image: image || 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?auto=format&fit=crop&w=1400&q=80',
    maxPeople: parseInt(maxPeople) || 10,
    budget: budget || 'To be discussed',
    status: 'Open',
    organizer: req.user.name,
    organizerEmail: req.user.email,
    friends: [req.user.name],
    messages: [{ sender: 'System', text: `${req.user.name} launched this expedition! 🚀`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }],
    checklist: []
  };

  trips.push(trip);
  res.status(201).json(trip);
});

app.delete('/api/trips/:id', auth, (req, res) => {
  const idx = trips.findIndex(t => t.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Trip not found' });

  const trip = trips[idx];
  if (trip.organizer !== req.user.name) return res.status(403).json({ error: 'Only the organizer can delete this trip' });

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ─── Notify every member (except the organizer) that the trip was cancelled ──
  const membersToNotify = trip.friends.filter(f => f !== req.user.name);
  membersToNotify.forEach(memberName => {
    notifications.push({
      id: Date.now() + Math.random(), // ensure unique ids
      to: memberName,
      from: req.user.name,
      type: 'TRIP_CANCELLED',
      tripId: trip.id,
      tripTitle: trip.title,
      message: `"${trip.title}" has been cancelled by the organizer. This trip no longer exists.`,
      read: false,
      time
    });
  });

  trips.splice(idx, 1);
  res.json({ success: true, notified: membersToNotify.length });
});

// ─── Join Trip ────────────────────────────────────────────────────────────
app.post('/api/trips/:id/join', auth, (req, res) => {
  const trip = trips.find(t => t.id === parseInt(req.params.id));
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (trip.friends.includes(req.user.name)) return res.status(409).json({ error: 'You have already joined this trip' });
  if (trip.friends.length >= trip.maxPeople) return res.status(409).json({ error: 'This trip is full' });

  if (hasDateConflict(req.user.name, trip.date, trip.endDate)) {
    return res.status(409).json({ error: CONFLICT_MSG });
  }

  trip.friends.push(req.user.name);
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  trip.messages.push({ sender: 'System', text: `🤝 ${req.user.name} joined the expedition!`, time });

  notifications.push({
    id: Date.now(),
    to: trip.organizer,
    from: req.user.name,
    type: 'JOIN',
    tripId: trip.id,
    tripTitle: trip.title,
    read: false,
    time
  });

  res.json({ success: true, trip });
});

app.post('/api/trips/:id/leave', auth, (req, res) => {
  const trip = trips.find(t => t.id === parseInt(req.params.id));
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (trip.organizer === req.user.name) return res.status(400).json({ error: 'Organizer cannot leave. Delete the trip instead.' });
  if (!trip.friends.includes(req.user.name)) return res.status(400).json({ error: 'You are not in this trip' });

  trip.friends = trip.friends.filter(f => f !== req.user.name);
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  trip.messages.push({ sender: 'System', text: `${req.user.name} left the trip.`, time });
  res.json({ success: true });
});

// ─── Messages ─────────────────────────────────────────────────────────────
app.get('/api/trips/:id/messages', auth, (req, res) => {
  const trip = trips.find(t => t.id === parseInt(req.params.id));
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (!trip.friends.includes(req.user.name)) return res.status(403).json({ error: 'You must join this trip to see the chat' });
  res.json(trip.messages);
});

app.post('/api/trips/:id/messages', auth, (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Message cannot be empty' });

  const trip = trips.find(t => t.id === parseInt(req.params.id));
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (!trip.friends.includes(req.user.name)) return res.status(403).json({ error: 'Join the trip first' });

  const msg = {
    sender: req.user.name,
    text: text.trim(),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  trip.messages.push(msg);
  res.status(201).json(msg);
});

// ─── Checklist ────────────────────────────────────────────────────────────
app.post('/api/trips/:id/checklist', auth, (req, res) => {
  const { item } = req.body;
  if (!item || !item.trim()) return res.status(400).json({ error: 'Item text required' });

  const trip = trips.find(t => t.id === parseInt(req.params.id));
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (!trip.friends.includes(req.user.name)) return res.status(403).json({ error: 'Join the trip first' });

  const newItem = { id: Date.now(), item: item.trim(), completed: false, addedBy: req.user.name };
  trip.checklist.push(newItem);
  res.status(201).json(newItem);
});

app.patch('/api/trips/:id/checklist/:itemId', auth, (req, res) => {
  const trip = trips.find(t => t.id === parseInt(req.params.id));
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (!trip.friends.includes(req.user.name)) return res.status(403).json({ error: 'Join the trip first' });

  const item = trip.checklist.find(i => i.id === parseInt(req.params.itemId));
  if (!item) return res.status(404).json({ error: 'Checklist item not found' });

  item.completed = !item.completed;
  res.json(item);
});

// ─── Notifications ────────────────────────────────────────────────────────
app.get('/api/notifications', auth, (req, res) => {
  const mine = notifications.filter(n => n.to === req.user.name);
  res.json(mine);
});

app.post('/api/notifications/read', auth, (req, res) => {
  notifications = notifications.map(n =>
    n.to === req.user.name ? { ...n, read: true } : n
  );
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`✅ TravelConnect backend running on port ${PORT}`));
