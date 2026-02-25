const express = require('express');
const Joi = require('joi');
const { pool } = require('../models/db');
const { getCache, setCache, deleteCache } = require('../utils/redis');
const { publishEvent } = require('../utils/kafka');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const listingSchema = Joi.object({
  title: Joi.string().min(5).max(255).required(),
  description: Joi.string().max(2000).optional(),
  type: Joi.string().valid('apartment','house','room','studio','condo').required(),
  address_line1: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  zip_code: Joi.string().required(),
  country: Joi.string().default('USA'),
  latitude: Joi.number().optional(),
  longitude: Joi.number().optional(),
  rent: Joi.number().positive().required(),
  deposit: Joi.number().positive().optional(),
  bedrooms: Joi.number().integer().min(0).optional(),
  bathrooms: Joi.number().min(0).optional(),
  area_sqft: Joi.number().integer().positive().optional(),
  is_furnished: Joi.boolean().default(false),
  pets_allowed: Joi.boolean().default(false),
  smoking_allowed: Joi.boolean().default(false),
  available_from: Joi.date().optional(),
  lease_duration: Joi.number().integer().min(1).optional(),
  amenity_ids: Joi.array().items(Joi.string().uuid()).optional(),
});

// GET /api/listings - Search & filter listings
router.get('/', async (req, res, next) => {
  try {
    const { city, type, min_rent, max_rent, bedrooms, pets_allowed,
            is_furnished, page = 1, limit = 12, sort = 'created_at' } = req.query;

    const cacheKey = `listings:${JSON.stringify(req.query)}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json({ ...cached, fromCache: true });

    const offset = (parseInt(page) - 1) * parseInt(limit);
    let conditions = ["l.status = 'active'"];
    let params = [];
    let idx = 1;

    if (city) { conditions.push(`LOWER(l.city) LIKE LOWER($${idx++})`); params.push(`%${city}%`); }
    if (type) { conditions.push(`l.type = $${idx++}`); params.push(type); }
    if (min_rent) { conditions.push(`l.rent >= $${idx++}`); params.push(parseFloat(min_rent)); }
    if (max_rent) { conditions.push(`l.rent <= $${idx++}`); params.push(parseFloat(max_rent)); }
    if (bedrooms) { conditions.push(`l.bedrooms = $${idx++}`); params.push(parseInt(bedrooms)); }
    if (pets_allowed === 'true') { conditions.push(`l.pets_allowed = true`); }
    if (is_furnished === 'true') { conditions.push(`l.is_furnished = true`); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const allowedSort = ['rent', 'created_at', 'views_count'];
    const sortCol = allowedSort.includes(sort) ? sort : 'created_at';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM listings l ${where}`, params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit), offset);
    const result = await pool.query(
      `SELECT l.*, 
              u.first_name || ' ' || u.last_name as landlord_name,
              u.avatar_url as landlord_avatar,
              (SELECT url FROM listing_images WHERE listing_id = l.id AND is_primary = true LIMIT 1) as primary_image,
              (SELECT COUNT(*) FROM reviews WHERE listing_id = l.id) as review_count,
              (SELECT AVG(rating) FROM reviews WHERE listing_id = l.id) as avg_rating
       FROM listings l
       JOIN users u ON u.id = l.landlord_id
       ${where}
       ORDER BY l.${sortCol} DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );

    const response = {
      data: result.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    };

    await setCache(cacheKey, response, 120); // cache 2 minutes
    res.json(response);
  } catch (err) { next(err); }
});

// GET /api/listings/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const cacheKey = `listing:${id}`;
    const cached = await getCache(cacheKey);

    let listing;
    if (cached) {
      listing = cached;
    } else {
      const result = await pool.query(
        `SELECT l.*, 
                u.first_name || ' ' || u.last_name as landlord_name, u.avatar_url as landlord_avatar, u.phone as landlord_phone
         FROM listings l JOIN users u ON u.id = l.landlord_id WHERE l.id = $1`,
        [id]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Listing not found' });

      const images = await pool.query(`SELECT * FROM listing_images WHERE listing_id = $1 ORDER BY is_primary DESC, sort_order`, [id]);
      const amenities = await pool.query(
        `SELECT a.id, a.name FROM amenities a JOIN listing_amenities la ON la.amenity_id = a.id WHERE la.listing_id = $1`, [id]
      );
      const reviews = await pool.query(
        `SELECT r.*, u.first_name, u.last_name, u.avatar_url FROM reviews r JOIN users u ON u.id = r.reviewer_id WHERE r.listing_id = $1 ORDER BY r.created_at DESC LIMIT 10`,
        [id]
      );

      listing = { ...result.rows[0], images: images.rows, amenities: amenities.rows, reviews: reviews.rows };
      await setCache(cacheKey, listing, 300);
    }

    // Increment view count & publish Kafka event (fire-and-forget)
    pool.query('UPDATE listings SET views_count = views_count + 1 WHERE id = $1', [id]).catch(() => {});
    publishEvent('listing.viewed', id, { listingId: id, userId: req.headers['x-user-id'], timestamp: new Date().toISOString() }).catch(() => {});

    res.json({ data: listing });
  } catch (err) { next(err); }
});

// POST /api/listings - Create listing (landlord only)
router.post('/', authenticate, requireRole('landlord', 'admin'), async (req, res, next) => {
  try {
    const { error, value } = listingSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { amenity_ids, ...listingData } = value;
    const fields = Object.keys(listingData);
    const vals = Object.values(listingData);
    const placeholders = fields.map((_, i) => `$${i + 2}`).join(', ');

    const result = await pool.query(
      `INSERT INTO listings (landlord_id, ${fields.join(', ')}) VALUES ($1, ${placeholders}) RETURNING *`,
      [req.user.userId, ...vals]
    );
    const listing = result.rows[0];

    if (amenity_ids?.length) {
      const amenityValues = amenity_ids.map((aid, i) => `($1, $${i + 2})`).join(', ');
      await pool.query(`INSERT INTO listing_amenities (listing_id, amenity_id) VALUES ${amenityValues}`, [listing.id, ...amenity_ids]);
    }

    await deleteCache('listings:*');
    await publishEvent('listing.created', listing.id, { listingId: listing.id, city: listing.city, rent: listing.rent });

    res.status(201).json({ data: listing });
  } catch (err) { next(err); }
});

// PUT /api/listings/:id
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const listing = await pool.query('SELECT * FROM listings WHERE id = $1', [id]);
    if (!listing.rows.length) return res.status(404).json({ error: 'Listing not found' });
    if (listing.rows[0].landlord_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { amenity_ids, ...updates } = req.body;
    const fields = Object.keys(updates);
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

    const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const result = await pool.query(
      `UPDATE listings SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...Object.values(updates)]
    );

    if (amenity_ids !== undefined) {
      await pool.query('DELETE FROM listing_amenities WHERE listing_id = $1', [id]);
      if (amenity_ids.length > 0) {
        const amenityValues = amenity_ids.map((aid, i) => `($1, $${i + 2})`).join(', ');
        await pool.query(`INSERT INTO listing_amenities (listing_id, amenity_id) VALUES ${amenityValues}`, [id, ...amenity_ids]);
      }
    }

    await deleteCache(`listing:${id}`);
    await deleteCache('listings:*');
    await publishEvent('listing.updated', id, { listingId: id });

    res.json({ data: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/listings/:id
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const listing = await pool.query('SELECT * FROM listings WHERE id = $1', [id]);
    if (!listing.rows.length) return res.status(404).json({ error: 'Listing not found' });
    if (listing.rows[0].landlord_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await pool.query('DELETE FROM listings WHERE id = $1', [id]);
    await deleteCache(`listing:${id}`);
    await deleteCache('listings:*');
    await publishEvent('listing.deleted', id, { listingId: id });

    res.json({ message: 'Listing deleted' });
  } catch (err) { next(err); }
});

// POST /api/listings/:id/save
router.post('/:id/save', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query(
      `INSERT INTO saved_listings (user_id, listing_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user.userId, id]
    );
    res.json({ message: 'Listing saved' });
  } catch (err) { next(err); }
});

// DELETE /api/listings/:id/save
router.delete('/:id/save', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM saved_listings WHERE user_id = $1 AND listing_id = $2', [req.user.userId, id]);
    res.json({ message: 'Listing unsaved' });
  } catch (err) { next(err); }
});

// POST /api/listings/:id/reviews
router.post('/:id/reviews', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });

    const result = await pool.query(
      `INSERT INTO reviews (reviewer_id, listing_id, rating, comment) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.userId, id, rating, comment]
    );
    await deleteCache(`listing:${id}`);
    res.status(201).json({ data: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/listings/:id/book
router.post('/:id/book', authenticate, requireRole('tenant'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tour_date, message } = req.body;

    const result = await pool.query(
      `INSERT INTO bookings (listing_id, tenant_id, tour_date, message) VALUES ($1,$2,$3,$4) RETURNING *`,
      [id, req.user.userId, tour_date, message]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) { next(err); }
});

// GET /api/listings/my/listings (landlord's own)
router.get('/my/listings', authenticate, requireRole('landlord', 'admin'), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT l.*, (SELECT url FROM listing_images WHERE listing_id = l.id AND is_primary = true LIMIT 1) as primary_image
       FROM listings l WHERE l.landlord_id = $1 ORDER BY l.created_at DESC`,
      [req.user.userId]
    );
    res.json({ data: result.rows });
  } catch (err) { next(err); }
});

module.exports = router;
