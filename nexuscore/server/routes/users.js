const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const { requireRole, requireOwnOrAdmin } = require('../middleware/roles');
const { getPurchasePrice } = require('../utils/pricing');

const router = express.Router();

router.get('/me', auth, async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT user_id, username, email, avatar_url, bio, country, reg_date, balance, role,
              cloud_plan, cloud_plan_expires, cloud_free_used_today, cloud_free_reset_at,
              developer_company, is_developer_approved
       FROM users WHERE user_id=?`,
      [req.user.userId]
    );
    if (!users.length) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    res.json(users[0]);
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.get('/search', auth, async (req, res) => {
  try {
    const q = `%${req.query.q || ''}%`;
    const [users] = await pool.query(
      `SELECT user_id, username, avatar_url FROM users WHERE username LIKE ? LIMIT 20`,
      [q]
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.get('/developer-requests', auth, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT user_id, username, email, developer_company, developer_requested_at
       FROM users WHERE developer_requested_at IS NOT NULL AND is_developer_approved=FALSE AND role='user'`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/request-developer', auth, async (req, res) => {
  try {
    const { company } = req.body;
    await pool.query(
      `UPDATE users SET developer_company=?, developer_requested_at=NOW() WHERE user_id=?`,
      [company, req.user.userId]
    );
    res.json({ message: 'Application submitted' });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/approve-developer/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await pool.query(
      `UPDATE users SET role='developer', is_developer_approved=TRUE WHERE user_id=?`,
      [req.params.id]
    );
    res.json({ message: 'Developer approved' });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/reject-developer/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await pool.query(
      `UPDATE users SET developer_requested_at=NULL, developer_company=NULL WHERE user_id=?`,
      [req.params.id]
    );
    res.json({ message: 'Developer rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.get('/:id', auth, requireOwnOrAdmin('id'), async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT user_id, username, email, avatar_url, bio, country, reg_date, balance, role,
              cloud_plan, cloud_plan_expires FROM users WHERE user_id=?`,
      [req.params.id]
    );
    if (!users.length) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    res.json(users[0]);
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.put('/:id', auth, requireOwnOrAdmin('id'), async (req, res) => {
  try {
    const { bio, country, avatar_url } = req.body;
    await pool.query(
      `UPDATE users SET bio=?, country=?, avatar_url=? WHERE user_id=?`,
      [bio, country, avatar_url, req.params.id]
    );
    res.json({ message: 'Profile updated' });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE user_id=?', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.get('/:id/library', auth, requireOwnOrAdmin('id'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT g.*, l.purchase_date, l.purchase_price, l.playtime_mins, l.last_played
       FROM libraries l JOIN games g ON l.game_id=g.game_id
       WHERE l.user_id=? ORDER BY l.purchase_date DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/:id/library/:gameId', auth, requireOwnOrAdmin('id'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const userId = parseInt(req.params.id, 10);
    const gameId = parseInt(req.params.gameId, 10);

    const [existing] = await conn.query(
      'SELECT * FROM libraries WHERE user_id=? AND game_id=?', [userId, gameId]
    );
    if (existing.length) {
      await conn.rollback();
      return res.status(409).json({ error: 'Already in library', code: 'ALREADY_OWNED' });
    }

    const [games] = await conn.query('SELECT * FROM games WHERE game_id=? AND status=?', [gameId, 'approved']);
    if (!games.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Game not found', code: 'NOT_FOUND' });
    }
    const game = games[0];
    let price = 0;
    if (!game.is_free && game.price > 0) {
      let applyTrial = false;
      if (req.body?.applyDiscount) {
        const [trial] = await conn.query(
          `SELECT status FROM trials WHERE user_id=? AND game_id=? AND status IN ('completed','active')`,
          [userId, gameId]
        );
        applyTrial = trial.length > 0;
      }
      price = getPurchasePrice(game, { applyTrialDiscount: applyTrial });
      const [users] = await conn.query('SELECT balance FROM users WHERE user_id=? FOR UPDATE', [userId]);
      if (parseFloat(users[0].balance) < price) {
        await conn.rollback();
        return res.status(402).json({ error: 'Insufficient balance', code: 'INSUFFICIENT_BALANCE' });
      }
      await conn.query('UPDATE users SET balance=balance-? WHERE user_id=?', [price, userId]);
    }

    await conn.query(
      'INSERT INTO libraries (user_id, game_id, purchase_price) VALUES (?, ?, ?)',
      [userId, gameId, price]
    );

    await conn.query(
      `UPDATE trials SET status='purchased', ended_at=COALESCE(ended_at, NOW())
       WHERE user_id=? AND game_id=? AND status IN ('active','completed')`,
      [userId, gameId]
    );

    await conn.commit();
    const [balance] = await pool.query('SELECT balance FROM users WHERE user_id=?', [userId]);
    res.status(201).json({ message: 'Purchased', price, balance: balance[0].balance });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  } finally {
    conn.release();
  }
});

router.delete('/:id/library/:gameId', auth, requireOwnOrAdmin('id'), async (req, res) => {
  try {
    await pool.query('DELETE FROM libraries WHERE user_id=? AND game_id=?', [req.params.id, req.params.gameId]);
    res.json({ message: 'Removed from library' });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.get('/:id/friends', auth, requireOwnOrAdmin('id'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.user_id, u.username, u.avatar_url, f.status, f.created_at
       FROM friends f JOIN users u ON (
         CASE WHEN f.user_id=? THEN f.friend_id ELSE f.user_id END = u.user_id
       )
       WHERE (f.user_id=? OR f.friend_id=?) AND f.status='accepted'`,
      [req.params.id, req.params.id, req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/:id/friends/:friendId', auth, requireOwnOrAdmin('id'), async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)',
      [req.params.id, req.params.friendId, 'accepted']
    );
    res.status(201).json({ message: 'Friend added' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Already friends', code: 'DUPLICATE' });
    }
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.delete('/:id/friends/:friendId', auth, requireOwnOrAdmin('id'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM friends WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)',
      [req.params.id, req.params.friendId, req.params.friendId, req.params.id]
    );
    res.json({ message: 'Friend removed' });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/:id/topup', auth, requireOwnOrAdmin('id'), async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount', code: 'VALIDATION_ERROR' });
    }
    await pool.query('UPDATE users SET balance=balance+? WHERE user_id=?', [amount, req.params.id]);
    const [users] = await pool.query('SELECT balance FROM users WHERE user_id=?', [req.params.id]);
    res.json({ balance: users[0].balance });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

module.exports = router;
