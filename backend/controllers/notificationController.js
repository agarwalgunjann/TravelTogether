const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
  try {
    const items = await Notification.find({ to: req.user.name }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Fetch failed' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ to: req.user.name }, { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Read failed' });
  }
};
