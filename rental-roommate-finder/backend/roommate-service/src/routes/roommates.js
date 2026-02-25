const express = require('express');
const Joi = require('joi');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 20 });

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Auth required' });
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
}

const profileSchema = Joi.object({
  bio: Joi.string().max(500).optional(),
  age: Joi.number().integer().min(18).max(100).optional(),
  gender: Joi.string().optional(),
  occupation: Joi.string().optional(),
  lifestyle: Joi.string().valid('early_bird','night_owl','flexible').optional(),
  cleanliness: Joi.string().valid('very_clean','clean','moderate','relaxed').optional(),
  noise_level: Joi.string().valid('quiet','moderate','lively').optional(),
  smoking_preference: Joi.string().valid('non_smoker','smoker','outdoor_ok').optional(),
  pet_preference: Joi.string().valid('no_pets','loves_pets','allergic').optional(),
  budget_min: Joi.number().positive().optional(),
  budget_max: Joi.number().positive().optional(),
  preferred_city: Joi.string().optional(),
  move_in_date: Joi.date().optional(),
  interests: Joi.array().items(Joi.string()).optional(),
  looking_for_room: Joi.boolean().optional(),
});

// GET /api/roommates - Browse roommate profiles with smart matching
router.get('/', async (req, res, next) => {
  try {
    const { city, budget_min, budget_max, lifestyle, pets, page = 1, limit = 12 } = req.query;
    let conditions = ["rp.is_active = true"];
    let params = [];
    let idx = 1;

    if (city) { conditions.push(`LOWER(rp.preferred_city) LIKE LOWER($${idx++})`); params.push(`%${city}%`); }
    if (budget_min) { conditions.push(`rp.budget_max >= $${idx++}`); params.push(parseFloat(budget_min)); }
    if (budget_max) { conditions.push(`rp.budget_min <= $${idx++}`); params.push(parseFloat(budget_max)); }
    if (lifestyle) { conditions.push(`rp.lifestyle = $${idx++}`); params.push(lifestyle); }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where = `WHERE ${conditions.join(' AND ')}`;
    const countRes = await pool.query(`SELECT COUNT(*) FROM roommate_profiles rp ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    params.push(parseInt(limit), offset);
    const result = await pool.query(
      `SELECT rp.*, u.first_name, u.last_name, u.avatar_url, u.email
       FROM roommate_profiles rp
       JOIN users u ON u.id = rp.user_id
       ${where}
       ORDER BY rp.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );

    res.json({ data: result.rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

// GET /api/roommates/profile/me
router.get('/profile/me', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT rp.*, u.first_name, u.last_name, u.email, u.avatar_url
       FROM roommate_profiles rp JOIN users u ON u.id = rp.user_id WHERE rp.user_id = $1`,
      [req.user.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Profile not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/roommates/profile - Create or update roommate profile
router.post('/profile', authenticate, async (req, res, next) => {
  try {
    const { error, value } = profileSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const fields = Object.keys(value);
    const vals = Object.values(value);

    // Upsert profile
    const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const insertCols = ['user_id', ...fields].join(', ');
    const insertVals = ['$1', ...fields.map((_, i) => `$${i + 2}`)].join(', ');

    const result = await pool.query(
      `INSERT INTO roommate_profiles (${insertCols}) VALUES (${insertVals})
       ON CONFLICT (user_id) DO UPDATE SET ${setClauses}, updated_at = NOW() RETURNING *`,
      [req.user.userId, ...vals]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) { next(err); }
});

// GET /api/roommates/:userId - Get specific profile
router.get('/:userId', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT rp.*, u.first_name, u.last_name, u.avatar_url
       FROM roommate_profiles rp JOIN users u ON u.id = rp.user_id WHERE rp.user_id = $1 AND rp.is_active = true`,
      [req.params.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Profile not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/roommates/requests - Send roommate request
router.post('/requests', authenticate, async (req, res, next) => {
  try {
    const { receiver_id, listing_id, message } = req.body;
    if (!receiver_id) return res.status(400).json({ error: 'receiver_id required' });
    if (receiver_id === req.user.userId) return res.status(400).json({ error: 'Cannot request yourself' });

    const result = await pool.query(
      `INSERT INTO roommate_requests (sender_id, receiver_id, listing_id, message)
       VALUES ($1,$2,$3,$4) ON CONFLICT (sender_id, receiver_id, listing_id) DO NOTHING RETURNING *`,
      [req.user.userId, receiver_id, listing_id || null, message]
    );
    if (!result.rows.length) return res.status(409).json({ error: 'Request already sent' });
    res.status(201).json({ data: result.rows[0] });
  } catch (err) { next(err); }
});

// GET /api/roommates/requests/me - Get my requests (sent & received)
router.get('/requests/me', authenticate, async (req, res, next) => {
  try {
    const sent = await pool.query(
      `SELECT rr.*, u.first_name, u.last_name, u.avatar_url 
       FROM roommate_requests rr JOIN users u ON u.id = rr.receiver_id WHERE rr.sender_id = $1 ORDER BY rr.created_at DESC`,
      [req.user.userId]
    );
    const received = await pool.query(
      `SELECT rr.*, u.first_name, u.last_name, u.avatar_url 
       FROM roommate_requests rr JOIN users u ON u.id = rr.sender_id WHERE rr.receiver_id = $1 ORDER BY rr.created_at DESC`,
      [req.user.userId]
    );
    res.json({ sent: sent.rows, received: received.rows });
  } catch (err) { next(err); }
});

// PATCH /api/roommates/requests/:id - Accept/Reject request
router.patch('/requests/:id', authenticate, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['accepted','rejected','withdrawn'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const request = await pool.query('SELECT * FROM roommate_requests WHERE id = $1', [req.params.id]);
    if (!request.rows.length) return res.status(404).json({ error: 'Request not found' });

    const req_ = request.rows[0];
    const isReceiver = req_.receiver_id === req.user.userId;
    const isSender = req_.sender_id === req.user.userId;

    if (status === 'withdrawn' && !isSender) return res.status(403).json({ error: 'Only sender can withdraw' });
    if (['accepted','rejected'].includes(status) && !isReceiver) return res.status(403).json({ error: 'Only receiver can accept/reject' });

    const result = await pool.query(
      'UPDATE roommate_requests SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
