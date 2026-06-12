const pool = require('../config/db');

async function promoteQueue() {
  await pool.query(
    `UPDATE cloud_queue SET status='ready', notified_at=NOW(),
     expires_at=DATE_ADD(NOW(), INTERVAL 5 MINUTE)
     WHERE status='waiting' ORDER BY joined_at ASC LIMIT 1`
  );
}

async function expireReadySlots() {
  const [expired] = await pool.query(
    `SELECT queue_id FROM cloud_queue WHERE status='ready' AND expires_at < NOW()`
  );
  for (const row of expired) {
    await pool.query(`UPDATE cloud_queue SET status='expired' WHERE queue_id=?`, [row.queue_id]);
    await promoteQueue();
  }
}

async function checkAndEndExpiredSessions() {
  const [sessions] = await pool.query(
    `SELECT session_id, user_id, plan, max_duration_mins, started_at
     FROM cloud_sessions WHERE status='active' AND max_duration_mins > 0`
  );
  for (const s of sessions) {
    const [diff] = await pool.query(
      `SELECT TIMESTAMPDIFF(MINUTE, ?, NOW()) AS mins`, [s.started_at]
    );
    if (diff[0].mins >= s.max_duration_mins) {
      await pool.query(
        `UPDATE cloud_sessions SET status='expired', ended_at=NOW(), duration_mins=? WHERE session_id=?`,
        [s.max_duration_mins, s.session_id]
      );
      if (s.plan === 'free') await promoteQueue();
    }
  }
  await expireReadySlots();
}

module.exports = { promoteQueue, expireReadySlots, checkAndEndExpiredSessions };
