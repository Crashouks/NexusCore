const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const { getPurchasePrice, enrichGame } = require('../utils/pricing');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT g.*, c.added_at FROM cart_items c
       JOIN games g ON c.game_id = g.game_id
       WHERE c.user_id = ? ORDER BY c.added_at DESC`,
      [req.user.userId]
    );
    const total = rows.reduce((s, g) => s + (g.is_free ? 0 : getPurchasePrice(g)), 0);
    res.json({ items: rows.map(enrichGame), total, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/checkout', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const userId = req.user.userId;
    const [items] = await conn.query(
      `SELECT g.* FROM cart_items c JOIN games g ON c.game_id = g.game_id WHERE c.user_id = ?`,
      [userId]
    );
    if (!items.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Cart is empty', code: 'EMPTY_CART' });
    }
    let totalCost = 0;
    for (const g of items) {
      if (!g.is_free && parseFloat(g.price) > 0) totalCost += getPurchasePrice(g);
    }
    const [users] = await conn.query('SELECT balance FROM users WHERE user_id=? FOR UPDATE', [userId]);
    if (parseFloat(users[0].balance) < totalCost) {
      await conn.rollback();
      return res.status(402).json({ error: 'Insufficient balance', code: 'INSUFFICIENT_BALANCE', total: totalCost });
    }
    if (totalCost > 0) {
      await conn.query('UPDATE users SET balance=balance-? WHERE user_id=?', [totalCost, userId]);
    }
    for (const g of items) {
      const [exists] = await conn.query('SELECT 1 FROM libraries WHERE user_id=? AND game_id=?', [userId, g.game_id]);
      if (!exists.length) {
        const price = g.is_free ? 0 : getPurchasePrice(g);
        await conn.query('INSERT INTO libraries (user_id, game_id, purchase_price) VALUES (?, ?, ?)', [userId, g.game_id, price]);
        await conn.query(
          `UPDATE trials SET status='purchased' WHERE user_id=? AND game_id=? AND status IN ('active','completed')`,
          [userId, g.game_id]
        );
      }
    }
    await conn.query('DELETE FROM cart_items WHERE user_id=?', [userId]);
    await conn.commit();
    const [balance] = await pool.query('SELECT balance FROM users WHERE user_id=?', [userId]);
    res.json({ message: 'Checkout complete', purchased: items.length, total: totalCost, balance: balance[0].balance });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  } finally {
    conn.release();
  }
});

router.post('/:gameId', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const gameId = parseInt(req.params.gameId, 10);
    const [games] = await pool.query(`SELECT * FROM games WHERE game_id=? AND status='approved'`, [gameId]);
    if (!games.length) return res.status(404).json({ error: 'Game not found', code: 'NOT_FOUND' });
    const [owned] = await pool.query('SELECT 1 FROM libraries WHERE user_id=? AND game_id=?', [userId, gameId]);
    if (owned.length) return res.status(409).json({ error: 'Already owned', code: 'ALREADY_OWNED' });
    await pool.query('INSERT INTO cart_items (user_id, game_id) VALUES (?, ?)', [userId, gameId]);
    res.status(201).json({ message: 'Added to cart' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Already in cart', code: 'DUPLICATE' });
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.delete('/:gameId', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM cart_items WHERE user_id=? AND game_id=?', [req.user.userId, req.params.gameId]);
    res.json({ message: 'Removed from cart' });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.delete('/', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM cart_items WHERE user_id=?', [req.user.userId]);
    res.json({ message: 'Cart cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

module.exports = router;
