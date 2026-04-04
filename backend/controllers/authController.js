const bcrypt = require('bcryptjs');
const axios = require('axios');

const jwt = require('jsonwebtoken');
const User = require('../models/User');



const SECRET = process.env.JWT_SECRET || 'travelconnect_secret_2024';

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email address' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const user = new User({ name: name.trim(), email: email.toLowerCase(), password: hash });
    await user.save();

    const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, SECRET, { expiresIn: '7d' });
    console.log(`✅ [DB] New User Created: ${user.email} (${user.name})`);
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('❌ Registration Exception:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: "The e-mail address and/or password you specified are not correct." });


    // Explicit check for Google-only accounts
    if (user.googleId && !user.password) {
      return res.status(401).json({
        error: "The e-mail address and/or password you specified are not correct."
      });
    }


    const match = await bcrypt.compare(password, user.password);

    if (!match) return res.status(401).json({ error: "The e-mail address and/or password you specified are not correct." });


    const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
};
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
  try {
    const { token: accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'Google access token missing' });

    // Verify token and fetch user info from Google
    const googleRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const { name, email, sub: googleId } = googleRes.data;

    if (!email) return res.status(400).json({ error: 'Google account must have an email associated' });

    // Find or create user
    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      if (!user.googleId) { user.googleId = googleId; await user.save(); }
    } else {
      // Generate a secure 8-digit password
      const tempPassword = Math.floor(10000000 + Math.random() * 90000000).toString();
      const hashedPassword = await bcrypt.hash(tempPassword, 12);

      user = new User({ 
        name, 
        email: email.toLowerCase(), 
        googleId,
        password: hashedPassword 
      });
      await user.save();

      // Trigger Webhook to send the generated password email via Power Automate
      if (process.env.POWER_AUTOMATE_GOOGLE_WEBHOOK) {
        try {
          await axios.post(process.env.POWER_AUTOMATE_GOOGLE_WEBHOOK, {
            email: user.email,
            name: user.name,
            generatedPassword: tempPassword
          });
          console.log(`⚡ [POWER AUTOMATE] Welcome email webhook triggered for ${user.email}`);
        } catch (webhookErr) {
          console.error("⚠️ Power Automate Google Login Webhook Error:", webhookErr.message);
        }
      } else {
        console.log(`⚠️ [DEV MODE] POWER_AUTOMATE_GOOGLE_WEBHOOK missing. Generated Pass: ${tempPassword}`);
      }
    }




    const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('❌ Google Auth Error:', err);
    res.status(401).json({ error: 'Google authentication failed' });
  }
};

const crypto = require('crypto');

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'The user with this account does not exist' });
    }


    if (user.googleId && !user.password) {
      return res.status(400).json({ error: "You signed up using Google. Please use 'Continue with Google' to log in" });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetUrl = `http://localhost:3001/?resetToken=${resetToken}`;

    // Send payload to Power Automate Webhook
    if (process.env.POWER_AUTOMATE_WEBHOOK) {
      await axios.post(process.env.POWER_AUTOMATE_WEBHOOK, {
        email: user.email,
        resetUrl: resetUrl,
        name: user.name
      });
      console.log(`⚡ [POWER AUTOMATE] Webhook triggered for ${user.email}`);
    } else {
      console.log(`⚠️ [DEV MODE] POWER_AUTOMATE_WEBHOOK missing in .env! Demolink: ${resetUrl}`);
    }

    res.json({ message: 'If the email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('❌ Forgot Password Webhook Error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
};



exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Invalid token or password too short' });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Password reset token is invalid or has expired' });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password has been successfuly reset. You may now log in.' });
  } catch (err) {
    console.error('❌ Reset Password Error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
};


