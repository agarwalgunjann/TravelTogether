const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  const header = req.headers['authorization'];
  const SECRET = process.env.JWT_SECRET || 'travelconnect_secret_2024';

  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Malformed token' });

  try {
    const decoded = jwt.verify(token, SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }

    req.user = { id: user._id, name: user.name, email: user.email };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Session expired, please sign in again' });
  }
};

module.exports = auth;
