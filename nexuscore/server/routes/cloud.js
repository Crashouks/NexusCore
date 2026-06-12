const express = require('express');
const crypto = require('crypto');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { promoteQueue, expireReadySlots } = require('../utils/sessionExpiry');

const router = express.Router();
const FREE_SLOTS = parseInt(process.env.FREE_CLOUD_SLOTS, 10) || 3;

const PLAN_SPECS = {
  free: { resolution: '1080p', fps: 60, rayTracing: false },
  starter: { resolution: '1080p', fps: 60, rayTracing: false },
  pro: { resolution: '1440p', fps: 120, rayTracing: false },
  ultimate: { resolution: '4K', fps: 144, rayTracing: true },
};

async function resetFreeDailyIfNeeded(userId) {
  const [users] = await pool.query(
    'SELECT cloud_free_used_today, cloud_free_reset_at FROM users WHERE user_id=?', [userId]
  );
  const u = users[0];
  if (!u.cloud_free_reset_at || new Date(u.cloud_free_reset_at) < new Date()) {
    await pool.query(
      `UPDATE users SET cloud_free_used_today=FALSE,
       cloud_free_reset_at=DATE_ADD(CURDATE(), INTERVAL 1 DAY) WHERE user_id=?`,
      [userId]
    );
    return false;
  }
  return u.cloud_free_used_today;
}

router.get('/plans', async (req, res) => {
  try {
    const [plans] = await pool.query('SELECT * FROM cloud_plans ORDER BY price_monthly ASC');
    res.json({
      free: {
        name: 'free', display_name: 'Free', price_monthly: 0,
        max_res: '1080p', max_fps: 60, ray_tracing: false, skip_queue: false,
        description: '1 hour/day, queue required',
      },
      plans,
    });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/subscribe', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { plan } = req.body;
    const [planRows] = await conn.query('SELECT * FROM cloud_plans WHERE name=?', [plan]);
    if (!planRows.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Invalid plan', code: 'VALIDATION_ERROR' });
    }
    const planData = planRows[0];
    const [users] = await conn.query('SELECT balance FROM users WHERE user_id=? FOR UPDATE', [req.user.userId]);
    if (parseFloat(users[0].balance) < parseFloat(planData.price_monthly)) {
      await conn.rollback();
      return res.status(402).json({ error: 'Insufficient balance', code: 'INSUFFICIENT_BALANCE' });
    }
    await conn.query('UPDATE users SET balance=balance-?, cloud_plan=?, cloud_plan_expires=DATE_ADD(NOW(), INTERVAL 30 DAY) WHERE user_id=?',
      [planData.price_monthly, plan, req.user.userId]);
    await conn.commit();
    res.json({ message: 'Subscribed', plan, expiresIn: '30 days' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  } finally {
    conn.release();
  }
});

router.get('/queue/status', auth, async (req, res) => {
  try {
    await expireReadySlots();
    const [rows] = await pool.query('SELECT * FROM cloud_queue WHERE user_id=?', [req.user.userId]);
    if (!rows.length) return res.json({ inQueue: false });

    const entry = rows[0];
    if (entry.status === 'ready') {
      return res.json({
        inQueue: true, position: 0, status: 'ready',
        estimatedWaitMins: 0, expiresAt: entry.expires_at, gameId: entry.game_id,
      });
    }
    const [pos] = await pool.query(
      `SELECT COUNT(*)+1 AS position FROM cloud_queue
       WHERE status='waiting' AND joined_at < ?`, [entry.joined_at]
    );
    res.json({
      inQueue: true,
      position: pos[0].position,
      status: entry.status,
      estimatedWaitMins: pos[0].position * 4,
      gameId: entry.game_id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/queue/join', auth, async (req, res) => {
  try {
    const { gameId } = req.body;
    const [games] = await pool.query(
      `SELECT * FROM games WHERE game_id=? AND status='approved' AND cloud_enabled=TRUE`, [gameId]
    );
    if (!games.length) return res.status(404).json({ error: 'Game not cloud-enabled', code: 'NOT_FOUND' });

    const [active] = await pool.query(
      `SELECT session_id FROM cloud_sessions WHERE user_id=? AND status='active'`, [req.user.userId]
    );
    if (active.length) return res.status(409).json({ error: 'Active session exists', code: 'SESSION_ACTIVE' });

    const [existing] = await pool.query('SELECT * FROM cloud_queue WHERE user_id=?', [req.user.userId]);
    if (existing.length) return res.status(409).json({ error: 'Already in queue', code: 'ALREADY_IN_QUEUE' });

    const [freeCount] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM cloud_sessions WHERE plan='free' AND status='active'`
    );

    if (freeCount[0].cnt < FREE_SLOTS) {
      return res.json({ skipQueue: true, message: 'Slot available — start session directly' });
    }

    await pool.query(
      'INSERT INTO cloud_queue (user_id, game_id, status) VALUES (?, ?, ?)',
      [req.user.userId, gameId, 'waiting']
    );
    const [pos] = await pool.query(
      `SELECT COUNT(*) AS position FROM cloud_queue WHERE status='waiting'`
    );
    res.status(201).json({ position: pos[0].position, estimatedWaitMins: pos[0].position * 4 });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/queue/leave', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM cloud_queue WHERE user_id=?', [req.user.userId]);
    res.json({ message: 'Left queue' });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/session/start', auth, async (req, res) => {
  try {
    const { gameId, billingMode } = req.body;
    const userId = req.user.userId;

    const [games] = await pool.query(
      `SELECT * FROM games WHERE game_id=? AND status='approved' AND cloud_enabled=TRUE`, [gameId]
    );
    if (!games.length) return res.status(404).json({ error: 'Game not found or not cloud-enabled', code: 'NOT_FOUND' });

    const [active] = await pool.query(
      `SELECT session_id FROM cloud_sessions WHERE user_id=? AND status='active'`, [userId]
    );
    if (active.length) return res.status(409).json({ error: 'Active session exists', code: 'SESSION_ACTIVE' });

    const game = games[0];
    const [owned] = await pool.query('SELECT 1 FROM libraries WHERE user_id=? AND game_id=?', [userId, gameId]);
    if (!owned.length && !game.is_free && billingMode !== 'free') {
      return res.status(403).json({ error: 'Must own game', code: 'NOT_OWNED' });
    }

    const [users] = await pool.query('SELECT cloud_plan, cloud_plan_expires FROM users WHERE user_id=?', [userId]);
    const user = users[0];
    let plan = 'free';
    let maxDuration = 60;

    if (billingMode === 'subscription') {
      if (user.cloud_plan === 'none' || user.cloud_plan === 'free') {
        return res.status(403).json({ error: 'Paid plan required', code: 'CLOUD_PLAN_REQUIRED' });
      }
      if (user.cloud_plan_expires && new Date(user.cloud_plan_expires) < new Date()) {
        return res.status(403).json({ error: 'Plan expired', code: 'CLOUD_PLAN_EXPIRED' });
      }
      plan = user.cloud_plan;
      maxDuration = 0;
    } else {
      const usedToday = await resetFreeDailyIfNeeded(userId);
      if (usedToday) {
        return res.status(403).json({ error: 'Daily free hour used', code: 'FREE_LIMIT_REACHED' });
      }

      const [freeCount] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM cloud_sessions WHERE plan='free' AND status='active'`
      );
      if (freeCount[0].cnt >= FREE_SLOTS) {
        const [queue] = await pool.query(
          `SELECT * FROM cloud_queue WHERE user_id=? AND status='ready'`, [userId]
        );
        if (!queue.length) {
          return res.status(403).json({ error: 'Must join queue first', code: 'QUEUE_REQUIRED' });
        }
        if (new Date(queue[0].expires_at) < new Date()) {
          await pool.query(`UPDATE cloud_queue SET status='expired' WHERE user_id=?`, [userId]);
          await promoteQueue();
          return res.status(403).json({ error: 'Queue slot expired', code: 'QUEUE_EXPIRED' });
        }
      }

      await pool.query(
        `UPDATE users SET cloud_free_used_today=TRUE,
         cloud_free_reset_at=DATE_ADD(CURDATE(), INTERVAL 1 DAY) WHERE user_id=?`, [userId]
      );
      await pool.query('DELETE FROM cloud_queue WHERE user_id=?', [userId]);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const [result] = await pool.query(
      `INSERT INTO cloud_sessions (user_id, game_id, plan, max_duration_mins, stream_token, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [userId, gameId, plan, maxDuration, token]
    );

    const specs = PLAN_SPECS[plan] || PLAN_SPECS.free;
    res.status(201).json({
      sessionId: result.insertId,
      streamToken: token,
      streamUrl: `https://stream.NexusCore.fake/session/${token}`,
      region: 'eu-central',
      resolution: specs.resolution,
      fps: specs.fps,
      rayTracing: specs.rayTracing,
      maxDurationMins: maxDuration,
      game: { game_id: game.game_id, name: game.name, cover_url: game.cover_url },
    });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/session/end', auth, async (req, res) => {
  try {
    const [sessions] = await pool.query(
      `SELECT * FROM cloud_sessions WHERE user_id=? AND status='active'`, [req.user.userId]
    );
    if (!sessions.length) return res.status(404).json({ error: 'No active session', code: 'NOT_FOUND' });

    const s = sessions[0];
    const [diff] = await pool.query(`SELECT TIMESTAMPDIFF(MINUTE, ?, NOW()) AS mins`, [s.started_at]);
    const duration = diff[0].mins;

    await pool.query(
      `UPDATE cloud_sessions SET status='ended', ended_at=NOW(), duration_mins=? WHERE session_id=?`,
      [duration, s.session_id]
    );

    if (s.plan === 'free') await promoteQueue();
    res.json({ message: 'Session ended', durationMins: duration });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/session/heartbeat', auth, async (req, res) => {
  try {
    const [sessions] = await pool.query(
      `SELECT * FROM cloud_sessions WHERE user_id=? AND status='active'`, [req.user.userId]
    );
    if (!sessions.length) return res.json({ active: false });

    const s = sessions[0];
    if (s.max_duration_mins > 0) {
      const [diff] = await pool.query(`SELECT TIMESTAMPDIFF(MINUTE, ?, NOW()) AS mins`, [s.started_at]);
      if (diff[0].mins >= s.max_duration_mins) {
        await pool.query(
          `UPDATE cloud_sessions SET status='expired', ended_at=NOW(), duration_mins=? WHERE session_id=?`,
          [s.max_duration_mins, s.session_id]
        );
        if (s.plan === 'free') await promoteQueue();
        return res.json({ autoEnded: true, reason: 'Time limit reached' });
      }
      return res.json({ active: true, minutesRemaining: s.max_duration_mins - diff[0].mins });
    }
    res.json({ active: true, minutesRemaining: null });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.get('/session/active', auth, async (req, res) => {
  try {
    const [sessions] = await pool.query(
      `SELECT cs.*, g.name, g.cover_url, g.slug FROM cloud_sessions cs
       JOIN games g ON cs.game_id=g.game_id
       WHERE cs.user_id=? AND cs.status='active'`, [req.user.userId]
    );
    if (!sessions.length) return res.json(null);
    const s = sessions[0];
    const specs = PLAN_SPECS[s.plan] || PLAN_SPECS.free;
    let minutesRemaining = null;
    if (s.max_duration_mins > 0) {
      const [diff] = await pool.query(`SELECT TIMESTAMPDIFF(MINUTE, ?, NOW()) AS mins`, [s.started_at]);
      minutesRemaining = Math.max(0, s.max_duration_mins - diff[0].mins);
    }
    res.json({ ...s, ...specs, minutesRemaining });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.get('/session/history', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const [count] = await pool.query(
      `SELECT COUNT(*) AS total FROM cloud_sessions WHERE user_id=? AND status!='active'`, [req.user.userId]
    );
    const [rows] = await pool.query(
      `SELECT cs.*, g.name, g.cover_url FROM cloud_sessions cs
       JOIN games g ON cs.game_id=g.game_id
       WHERE cs.user_id=? AND cs.status!='active'
       ORDER BY cs.ended_at DESC LIMIT ? OFFSET ?`,
      [req.user.userId, limit, offset]
    );
    res.json({ sessions: rows, total: count[0].total, page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.get('/sessions/all', auth, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT cs.*, u.username, g.name AS game_name FROM cloud_sessions cs
       JOIN users u ON cs.user_id=u.user_id JOIN games g ON cs.game_id=g.game_id
       ORDER BY cs.started_at DESC LIMIT 100`
    );
    const [queue] = await pool.query(
      `SELECT cq.*, u.username, g.name AS game_name FROM cloud_queue cq
       JOIN users u ON cq.user_id=u.user_id JOIN games g ON cq.game_id=g.game_id
       WHERE cq.status IN ('waiting','ready') ORDER BY cq.joined_at ASC`
    );
    res.json({ sessions: rows, queue });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

router.post('/sessions/:id/force-end', auth, requireRole('admin'), async (req, res) => {
  try {
    const [sessions] = await pool.query('SELECT * FROM cloud_sessions WHERE session_id=? AND status=?', [req.params.id, 'active']);
    if (!sessions.length) return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
    const s = sessions[0];
    const [diff] = await pool.query(`SELECT TIMESTAMPDIFF(MINUTE, ?, NOW()) AS mins`, [s.started_at]);
    await pool.query(
      `UPDATE cloud_sessions SET status='force_ended', ended_at=NOW(), duration_mins=? WHERE session_id=?`,
      [diff[0].mins, req.params.id]
    );
    if (s.plan === 'free') await promoteQueue();
    res.json({ message: 'Session force-ended' });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

module.exports = router;
