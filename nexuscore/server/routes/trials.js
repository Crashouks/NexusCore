const express = require('express');
const crypto = require('crypto');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

async function getGameTrialConfig(gameId) {
  const [games] = await pool.query(
    'SELECT trial_enabled, trial_duration_mins, trial_discount_percent, trial_level_limit, cloud_enabled, name, cover_url, price FROM games WHERE game_id=?',
    [gameId]
  );
  return games[0] || null;
}

router.get('/status/:gameId', auth, async (req, res) => {
  try {
    const game = await getGameTrialConfig(req.params.gameId);
    if (!game) return res.status(404).json({ error: 'Game not found', code: 'NOT_FOUND' });
    const duration = game.trial_duration_mins || 30;

    const [trials] = await pool.query(
      'SELECT * FROM trials WHERE user_id=? AND game_id=?', [req.user.userId, req.params.gameId]
    );
    if (!trials.length) {
      return res.json({
        canTrial: !!game.trial_enabled, trialUsed: false, trialStatus: null,
        minutesRemaining: duration, trialDuration: duration, trialDiscount: game.trial_discount_percent,
      });
    }
    const t = trials[0];
    let minutesRemaining = 0;
    if (t.status === 'active') minutesRemaining = Math.max(0, duration - t.duration_mins);
    res.json({
      canTrial: false, trialUsed: true, trialStatus: t.status, trialId: t.trial_id,
      minutesRemaining, startedAt: t.started_at, trialDuration: duration,
      progressPercent: Math.min(100, Math.round((t.duration_mins / duration) * 100)),
      trialDiscount: game.trial_discount_percent,
    });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/start/:gameId', auth, async (req, res) => {
  try {
    const gameId = req.params.gameId;
    const userId = req.user.userId;
    const game = await getGameTrialConfig(gameId);
    if (!game) return res.status(404).json({ error: 'Game not found', code: 'NOT_FOUND' });
    if (!game.trial_enabled) return res.status(403).json({ error: 'Trial not available', code: 'TRIAL_DISABLED' });

    const duration = game.trial_duration_mins || 30;
    const [existing] = await pool.query('SELECT * FROM trials WHERE user_id=? AND game_id=?', [userId, gameId]);
    if (existing.length) return res.status(409).json({ error: 'Trial already used', code: 'TRIAL_ALREADY_USED' });

    const [owned] = await pool.query('SELECT 1 FROM libraries WHERE user_id=? AND game_id=?', [userId, gameId]);
    if (owned.length) return res.status(409).json({ error: 'Already owned', code: 'ALREADY_OWNED' });

    const [result] = await pool.query(
      'INSERT INTO trials (user_id, game_id, status) VALUES (?, ?, ?)', [userId, gameId, 'active']
    );

    let cloudSessionId = null;
    if (game.cloud_enabled) {
      const [users] = await pool.query('SELECT cloud_plan FROM users WHERE user_id=?', [userId]);
      let plan = users[0].cloud_plan;
      if (plan === 'none') plan = 'free';
      const token = crypto.randomBytes(32).toString('hex');
      const [cs] = await pool.query(
        `INSERT INTO cloud_sessions (user_id, game_id, plan, max_duration_mins, stream_token, status)
         VALUES (?, ?, ?, ?, ?, 'active')`,
        [userId, gameId, plan === 'free' ? 'free' : plan, duration, token]
      );
      cloudSessionId = cs.insertId;
    }

    res.status(201).json({
      trialId: result.insertId,
      expiresAt: new Date(Date.now() + duration * 60 * 1000),
      cloudSessionId,
      cloudEnabled: game.cloud_enabled,
      trialDuration: duration,
      game: { name: game.name, cover_url: game.cover_url, price: game.price, trial_discount_percent: game.trial_discount_percent },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Trial already used', code: 'TRIAL_ALREADY_USED' });
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/end/:trialId', auth, async (req, res) => {
  try {
    const [trials] = await pool.query(
      'SELECT t.*, g.trial_duration_mins, g.trial_discount_percent, g.name, g.cover_url, g.price FROM trials t JOIN games g ON t.game_id=g.game_id WHERE t.trial_id=? AND t.user_id=?',
      [req.params.trialId, req.user.userId]
    );
    if (!trials.length) return res.status(404).json({ error: 'Trial not found', code: 'NOT_FOUND' });
    const t = trials[0];
    const duration = t.trial_duration_mins || 30;
    if (t.status !== 'active') return res.json({ message: 'Trial already ended', status: t.status });

    const [diff] = await pool.query(`SELECT TIMESTAMPDIFF(MINUTE, ?, NOW()) AS mins`, [t.started_at]);
    const mins = Math.min(diff[0].mins, duration);
    await pool.query(`UPDATE trials SET status='completed', ended_at=NOW(), duration_mins=? WHERE trial_id=?`, [mins, t.trial_id]);
    await pool.query(`UPDATE cloud_sessions SET status='ended', ended_at=NOW() WHERE user_id=? AND game_id=? AND status='active'`, [t.user_id, t.game_id]);

    res.json({
      message: 'Trial ended', durationMins: mins, trialExpired: mins >= duration,
      game: { name: t.name, cover_url: t.cover_url, price: t.price, trial_discount_percent: t.trial_discount_percent, game_id: t.game_id },
    });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/heartbeat/:trialId', auth, async (req, res) => {
  try {
    const [trials] = await pool.query(
      'SELECT t.*, g.trial_duration_mins, g.trial_discount_percent, g.name, g.cover_url, g.price FROM trials t JOIN games g ON t.game_id=g.game_id WHERE t.trial_id=? AND t.user_id=?',
      [req.params.trialId, req.user.userId]
    );
    if (!trials.length) return res.status(404).json({ error: 'Trial not found', code: 'NOT_FOUND' });
    const t = trials[0];
    const duration = t.trial_duration_mins || 30;
    if (t.status !== 'active') return res.json({ trialExpired: true, status: t.status });

    const [diff] = await pool.query(`SELECT TIMESTAMPDIFF(MINUTE, ?, NOW()) AS mins`, [t.started_at]);
    const mins = diff[0].mins;
    await pool.query('UPDATE trials SET duration_mins=? WHERE trial_id=?', [mins, t.trial_id]);

    if (mins >= duration) {
      await pool.query(`UPDATE trials SET status='completed', ended_at=NOW(), duration_mins=? WHERE trial_id=?`, [duration, t.trial_id]);
      await pool.query(`UPDATE cloud_sessions SET status='ended', ended_at=NOW() WHERE user_id=? AND game_id=? AND status='active'`, [t.user_id, t.game_id]);
      return res.json({
        trialExpired: true,
        game: { name: t.name, cover_url: t.cover_url, price: t.price, trial_discount_percent: t.trial_discount_percent, game_id: t.game_id },
      });
    }

    res.json({ trialExpired: false, minutesRemaining: duration - mins, progressPercent: Math.round((mins / duration) * 100) });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.get('/history', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, g.name, g.cover_url, g.price, g.slug, g.trial_duration_mins, g.trial_discount_percent FROM trials t
       JOIN games g ON t.game_id=g.game_id WHERE t.user_id=? ORDER BY t.started_at DESC`,
      [req.user.userId]
    );
    res.json(rows.map(r => ({
      ...r,
      progressPercent: r.trial_duration_mins ? Math.min(100, Math.round((r.duration_mins / r.trial_duration_mins) * 100)) : 0,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.get('/active', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, g.name, g.cover_url, g.price, g.slug, g.trial_duration_mins, g.trial_discount_percent FROM trials t
       JOIN games g ON t.game_id=g.game_id WHERE t.user_id=? AND t.status='active'`,
      [req.user.userId]
    );
    res.json(rows.map(r => ({
      ...r,
      minutesRemaining: Math.max(0, (r.trial_duration_mins || 30) - r.duration_mins),
      progressPercent: Math.min(100, Math.round((r.duration_mins / (r.trial_duration_mins || 30)) * 100)),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.get('/all', auth, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, u.username, g.name AS game_name FROM trials t
       JOIN users u ON t.user_id=u.user_id JOIN games g ON t.game_id=g.game_id
       ORDER BY t.started_at DESC LIMIT 200`
    );
    const [stats] = await pool.query(`
      SELECT COUNT(*) AS total, SUM(status='completed') AS completed,
             SUM(status='purchased') AS purchased, SUM(status='active') AS active FROM trials
    `);
    res.json({ trials: rows, stats: stats[0] });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

module.exports = router;
