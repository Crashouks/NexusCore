const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT g.*, w.added_at FROM wishlist w
       JOIN games g ON w.game_id = g.game_id
       WHERE w.user_id = ? ORDER BY w.added_at DESC`,
      [req.user.userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.get('/ids', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT game_id FROM wishlist WHERE user_id=?', [req.user.userId]);
    res.json(rows.map(r => r.game_id));
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/:gameId', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const gameId = parseInt(req.params.gameId, 10);
    const [games] = await pool.query(`SELECT * FROM games WHERE game_id=? AND status='approved'`, [gameId]);
    if (!games.length) return res.status(404).json({ error: 'Game not found', code: 'NOT_FOUND' });
    await pool.query('INSERT INTO wishlist (user_id, game_id) VALUES (?, ?)', [userId, gameId]);
    res.status(201).json({ message: 'Added to wishlist' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Already in wishlist', code: 'DUPLICATE' });
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.delete('/:gameId', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM wishlist WHERE user_id=? AND game_id=?', [req.user.userId, req.params.gameId]);
    res.json({ message: 'Removed from wishlist' });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

module.exports = router;
