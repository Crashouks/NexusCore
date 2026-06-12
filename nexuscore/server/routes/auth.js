const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    {
      userId: user.user_id,
      username: user.username,
      role: user.role,
      cloudPlan: user.cloud_plan,
      cloudPlanExpires: user.cloud_plan_expires,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required', code: 'VALIDATION_ERROR' });
    }
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (username, email, password, cloud_plan) VALUES (?, ?, ?, 'free')`,
      [username, email, hash]
    );
    const [users] = await pool.query('SELECT * FROM users WHERE user_id=?', [result.insertId]);
    const token = signToken(users[0]);
    res.status(201).json({ token, user: { userId: users[0].user_id, username: users[0].username, role: users[0].role, cloudPlan: users[0].cloud_plan } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username or email already exists', code: 'DUPLICATE' });
    }
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [users] = await pool.query('SELECT * FROM users WHERE email=?', [email]);
    if (!users.length) {
      return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }
    const user = users[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }
    const token = signToken(user);
    res.json({
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        role: user.role,
        cloudPlan: user.cloud_plan,
        cloudPlanExpires: user.cloud_plan_expires,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

module.exports = router;
