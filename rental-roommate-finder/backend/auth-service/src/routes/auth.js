const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const { pool } = require('../models/db');
const { redisClient } = require('../utils/redis');
const { publishMessage } = require('../utils/rabbitmq');

const router = express.Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts' });

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  first_name: Joi.string().min(2).max(100).required(),
  last_name: Joi.string().min(2).max(100).required(),
  phone: Joi.string().optional(),
  role: Joi.string().valid('tenant', 'landlord').default('tenant'),
});

function generateTokens(userId, role) {
  const accessToken = jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [value.email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(value.password, 12);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, email, first_name, last_name, role`,
      [value.email, passwordHash, value.first_name, value.last_name, value.phone || null, value.role]
    );

    const user = result.rows[0];
    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1,$2, NOW() + INTERVAL '7 days')`,
      [user.id, refreshToken]
    );

    try {
      publishMessage('notifications', 'email.welcome', { to: user.email, name: user.first_name, userId: user.id });
    } catch (_) {}

    res.status(201).json({ user, accessToken, refreshToken });
  } catch (err) { next(err); }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const result = await pool.query(
      `SELECT id, email, password_hash, first_name, last_name, role, is_active FROM users WHERE email = $1`,
      [email]
    );
    if (!result.rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    if (!user.is_active) return res.status(403).json({ error: 'Account disabled' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    await redisClient.setex(`session:${user.id}`, 7 * 24 * 3600, refreshToken);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1,$2, NOW() + INTERVAL '7 days')`,
      [user.id, refreshToken]
    );

    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser, accessToken, refreshToken });
  } catch (err) { next(err); }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    const stored = await pool.query(
      `SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()`, [refreshToken]
    );
    if (!stored.rows.length) return res.status(401).json({ error: 'Invalid refresh token' });

    const userResult = await pool.query('SELECT id, role FROM users WHERE id = $1', [payload.userId]);
    if (!userResult.rows.length) return res.status(401).json({ error: 'User not found' });

    const { accessToken, refreshToken: newRefresh } = generateTokens(payload.userId, userResult.rows[0].role);
    await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1,$2, NOW() + INTERVAL '7 days')`,
      [payload.userId, newRefresh]
    );

    res.json({ accessToken, refreshToken: newRefresh });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') return res.status(401).json({ error: 'Invalid token' });
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
      try {
        const payload = jwt.decode(refreshToken);
        if (payload?.userId) await redisClient.del(`session:${payload.userId}`);
      } catch (_) {}
    }
    res.json({ message: 'Logged out' });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
    const payload = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, phone, avatar_url, role, is_verified, created_at FROM users WHERE id = $1`,
      [payload.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') return res.status(401).json({ error: 'Invalid token' });
    next(err);
  }
});

module.exports = router;
