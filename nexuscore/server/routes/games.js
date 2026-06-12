const express = require('express');
const pool = require('../config/db');
const { auth, optionalAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const slugify = require('../utils/slugify');
const { enrichGame, getPurchasePrice } = require('../utils/pricing');

const router = express.Router();

function buildGameQuery(query) {
  const { search, genre, cloud, free, trial, upcoming, sort } = query;
  let where = ["g.status='approved'"];
  const params = [];

  if (search) {
    where.push('(g.name LIKE ? OR g.short_desc LIKE ? OR g.tags LIKE ? OR g.developer_name LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (genre) {
    where.push('g.genre=?');
    params.push(genre);
  }
  if (cloud === '1') where.push('g.cloud_enabled=TRUE');
  if (free === '1') where.push('g.is_free=TRUE');
  if (trial === '1') where.push('(g.trial_enabled IS NULL OR g.trial_enabled=TRUE)');
  if (upcoming === '1') where.push('g.release_date > NOW()');

  let order = 'g.release_date DESC';
  switch (sort) {
    case 'price_asc': order = 'g.price ASC'; break;
    case 'price_desc': order = 'g.price DESC'; break;
    case 'az': order = 'g.name ASC'; break;
    case 'rating': order = 'avg_rating DESC'; break;
    default: order = 'g.release_date DESC';
  }

  return { where: where.join(' AND '), params, order };
}

router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const { where, params, order } = buildGameQuery(req.query);

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM games g WHERE ${where}`, params
    );

    const [games] = await pool.query(
      `SELECT g.*, COALESCE(AVG(r.rating), 0) AS avg_rating, COUNT(r.review_id) AS review_count
       FROM games g LEFT JOIN reviews r ON g.game_id=r.game_id
       WHERE ${where} GROUP BY g.game_id ORDER BY ${order} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ games: games.map(enrichGame), total: countRows[0].total, page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.get('/carousel', async (req, res) => {
  try {
    let [games] = await pool.query(
      `SELECT g.*, COALESCE(AVG(r.rating), 0) AS avg_rating
       FROM games g LEFT JOIN reviews r ON g.game_id=r.game_id
       WHERE g.is_carousel=TRUE AND g.status='approved'
       GROUP BY g.game_id ORDER BY g.carousel_order ASC, g.release_date DESC LIMIT 10`
    );
    if (!games.length) {
      [games] = await pool.query(
        `SELECT g.*, COALESCE(AVG(r.rating), 0) AS avg_rating
         FROM games g LEFT JOIN reviews r ON g.game_id=r.game_id
         WHERE g.is_featured=TRUE AND g.status='approved'
         GROUP BY g.game_id ORDER BY g.release_date DESC LIMIT 5`
      );
    }
    res.json(games.map(enrichGame));
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.get('/on-sale', async (req, res) => {
  try {
    const [games] = await pool.query(
      `SELECT g.*, COALESCE(AVG(r.rating), 0) AS avg_rating
       FROM games g LEFT JOIN reviews r ON g.game_id=r.game_id
       WHERE g.status='approved' AND g.is_free=FALSE
         AND g.discount_percent IS NOT NULL AND g.discount_percent > 0
         AND (g.discount_expires_at IS NULL OR g.discount_expires_at > NOW())
       GROUP BY g.game_id ORDER BY g.discount_percent DESC, g.release_date DESC LIMIT 20`
    );
    res.json(games.map(enrichGame));
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.get('/featured', async (req, res) => {
  try {
    const [games] = await pool.query(
      `SELECT g.*, COALESCE(AVG(r.rating), 0) AS avg_rating
       FROM games g LEFT JOIN reviews r ON g.game_id=r.game_id
       WHERE g.is_featured=TRUE AND g.status='approved'
       GROUP BY g.game_id LIMIT 5`
    );
    res.json(games.map(enrichGame));
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.get('/new-releases', async (req, res) => {
  try {
    const [games] = await pool.query(
      `SELECT * FROM games WHERE status='approved' ORDER BY release_date DESC LIMIT 8`
    );
    res.json(games.map(enrichGame));
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.put('/carousel/manage', auth, requireRole('admin'), async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items array required', code: 'INVALID_BODY' });
    }
    await pool.query('UPDATE games SET is_carousel=FALSE, carousel_order=0');
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await pool.query(
        'UPDATE games SET is_carousel=TRUE, carousel_order=? WHERE game_id=? AND status=?',
        [item.carousel_order ?? i, item.game_id, 'approved']
      );
    }
    res.json({ message: 'Carousel updated', count: items.length });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.get('/pending', auth, requireRole('admin'), async (req, res) => {
  try {
    const [games] = await pool.query(`SELECT * FROM games WHERE status='pending' ORDER BY submitted_at ASC`);
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.get('/my', auth, requireRole('developer', 'admin'), async (req, res) => {
  try {
    const [games] = await pool.query(
      `SELECT g.*,
        (SELECT COUNT(*) FROM libraries l WHERE l.game_id=g.game_id) AS owners_count,
        (SELECT COUNT(*) FROM trials t WHERE t.game_id=g.game_id) AS trial_starts,
        (SELECT COUNT(*) FROM trials t WHERE t.game_id=g.game_id AND t.status='purchased') AS trial_purchases
       FROM games g WHERE g.developer_id=? ORDER BY g.submitted_at DESC`,
      [req.user.userId]
    );
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.get('/:idOrSlug', optionalAuth, async (req, res) => {
  try {
    const param = req.params.idOrSlug;
    const isNum = /^\d+$/.test(param);
    const [games] = await pool.query(
      isNum ? 'SELECT * FROM games WHERE game_id=?' : 'SELECT * FROM games WHERE slug=?',
      [param]
    );
    if (!games.length) return res.status(404).json({ error: 'Game not found', code: 'NOT_FOUND' });
    const game = games[0];
    if (game.status !== 'approved' && (!req.user || (req.user.role !== 'admin' && req.user.userId !== game.developer_id))) {
      return res.status(404).json({ error: 'Game not found', code: 'NOT_FOUND' });
    }

    const [ratings] = await pool.query(
      `SELECT COALESCE(AVG(rating),0) AS avg_rating, COUNT(*) AS review_count FROM reviews WHERE game_id=?`,
      [game.game_id]
    );
    const [media] = await pool.query(
      `SELECT * FROM game_media WHERE game_id=? ORDER BY sort_order`, [game.game_id]
    );
    const [reviews] = await pool.query(
      `SELECT r.*, u.username, u.avatar_url FROM reviews r
       JOIN users u ON r.user_id=u.user_id WHERE r.game_id=? ORDER BY r.review_date DESC`,
      [game.game_id]
    );

    res.json(enrichGame({ ...game, ...ratings[0], media, reviews }));
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/', auth, requireRole('developer', 'admin'), async (req, res) => {
  try {
    const { name, short_desc, description, genre, tags, price, is_free, requirements, trailer_url, cover_url, cloud_enabled,
      trial_enabled, trial_duration_mins, trial_level_limit, trial_discount_percent } = req.body;
    const slug = slugify(name);
    const [users] = await pool.query('SELECT username FROM users WHERE user_id=?', [req.user.userId]);
    const [result] = await pool.query(
      `INSERT INTO games (name, slug, short_desc, description, genre, tags, developer_name, developer_id,
        price, is_free, requirements, trailer_url, cover_url, cloud_enabled,
        trial_enabled, trial_duration_mins, trial_level_limit, trial_discount_percent, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [name, slug, short_desc, description, genre, tags, users[0].username, req.user.userId,
       price || 0, is_free || false, requirements, trailer_url, cover_url, cloud_enabled || false,
       trial_enabled !== false, trial_duration_mins || 30, trial_level_limit || null, trial_discount_percent || 10]
    );
    res.status(201).json({ gameId: result.insertId, slug });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.put('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const fields = ['name','short_desc','description','genre','tags','price','is_free','is_featured',
      'is_carousel','carousel_order','discount_percent','discount_expires_at',
      'cloud_enabled','requirements','trailer_url','cover_url','status',
      'trial_enabled','trial_duration_mins','trial_level_limit','trial_discount_percent'];
    const updates = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { updates.push(`${f}=?`); params.push(req.body[f]); }
    }
    if (req.body.name) { updates.push('slug=?'); params.push(slugify(req.body.name)); }
    params.push(req.params.id);
    await pool.query(`UPDATE games SET ${updates.join(', ')} WHERE game_id=?`, params);
    res.json({ message: 'Game updated' });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const gameId = req.params.id;
    await pool.query('DELETE FROM libraries WHERE game_id=?', [gameId]);
    await pool.query(`UPDATE trials SET status='expired' WHERE game_id=? AND status='active'`, [gameId]);
    await pool.query(`UPDATE cloud_sessions SET status='force_ended', ended_at=NOW() WHERE game_id=? AND status='active'`, [gameId]);
    await pool.query('DELETE FROM reviews WHERE game_id=?', [gameId]);
    await pool.query('DELETE FROM game_media WHERE game_id=?', [gameId]);
    await pool.query('DELETE FROM games WHERE game_id=?', [gameId]);
    res.json({ message: 'Game deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/:id/review', auth, requireRole('admin'), async (req, res) => {
  try {
    const { action, reason } = req.body;
    if (action === 'approve') {
      await pool.query(`UPDATE games SET status='approved', reviewed_at=NOW() WHERE game_id=?`, [req.params.id]);
    } else {
      await pool.query(
        `UPDATE games SET status='rejected', rejection_reason=?, reviewed_at=NOW() WHERE game_id=?`,
        [reason, req.params.id]
      );
    }
    res.json({ message: `Game ${action}d` });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/:id/user-review', auth, async (req, res) => {
  try {
    const gameId = req.params.id;
    const userId = req.user.userId;
    const { rating, review_text, is_recommended } = req.body;

    const [owned] = await pool.query('SELECT 1 FROM libraries WHERE user_id=? AND game_id=?', [userId, gameId]);
    const [trial] = await pool.query(
      `SELECT status FROM trials WHERE user_id=? AND game_id=? AND status IN ('completed','purchased')`,
      [userId, gameId]
    );
    if (!owned.length && !trial.length) {
      return res.status(403).json({ error: 'Must own game or complete trial', code: 'REVIEW_NOT_ALLOWED' });
    }

    await pool.query(
      `INSERT INTO reviews (user_id, game_id, rating, review_text, is_recommended) VALUES (?, ?, ?, ?, ?)`,
      [userId, gameId, rating, review_text, is_recommended !== false]
    );
    res.status(201).json({ message: 'Review submitted' });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

module.exports = router;
