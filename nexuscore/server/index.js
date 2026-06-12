const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const gameRoutes = require('./routes/games');
const cloudRoutes = require('./routes/cloud');
const trialRoutes = require('./routes/trials');
const cartRoutes = require('./routes/cart');
const wishlistRoutes = require('./routes/wishlist');
const mediaRoutes = require('./routes/media');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/cloud', cloudRoutes);
app.use('/api/trials', trialRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/media', mediaRoutes);
app.post('/api/upload', require('./middleware/auth').auth, require('./middleware/roles').requireRole('developer', 'admin'), mediaRoutes.uploadMiddleware, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file', code: 'VALIDATION_ERROR' });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url, size: req.file.size, mimetype: req.file.mimetype });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', name: 'NexusCore' }));

app.get('/api/admin/stats', require('./middleware/auth').auth, require('./middleware/roles').requireRole('admin'), async (req, res) => {
  try {
    const pool = require('./config/db');
    const [[users]] = await pool.query('SELECT COUNT(*) AS c FROM users');
    const [[games]] = await pool.query('SELECT COUNT(*) AS c FROM games WHERE status=?', ['approved']);
    const [[pending]] = await pool.query('SELECT COUNT(*) AS c FROM games WHERE status=?', ['pending']);
    const [[devReq]] = await pool.query(`SELECT COUNT(*) AS c FROM users WHERE developer_requested_at IS NOT NULL AND is_developer_approved=FALSE`);
    const [[cloudActive]] = await pool.query(`SELECT COUNT(*) AS c FROM cloud_sessions WHERE status='active'`);
    const [[trialsActive]] = await pool.query(`SELECT COUNT(*) AS c FROM trials WHERE status='active'`);
    const [[trialsToday]] = await pool.query(`SELECT COUNT(*) AS c FROM trials WHERE DATE(started_at)=CURDATE()`);
    res.json({
      users: users.c, games: games.c, pendingGames: pending.c,
      devRequests: devReq.c, activeCloudSessions: cloudActive.c,
      activeTrials: trialsActive.c, trialsToday: trialsToday.c,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users', require('./middleware/auth').auth, require('./middleware/roles').requireRole('admin'), async (req, res) => {
  try {
    const pool = require('./config/db');
    const [rows] = await pool.query(
      `SELECT user_id, username, email, role, cloud_plan, balance, reg_date FROM users ORDER BY reg_date DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/games', require('./middleware/auth').auth, require('./middleware/roles').requireRole('admin'), async (req, res) => {
  try {
    const pool = require('./config/db');
    const [rows] = await pool.query(`SELECT * FROM games ORDER BY submitted_at DESC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const { runMigrations } = require('./migrate');

runMigrations()
  .then(() => {
    app.listen(PORT, () => console.log(`NexusCore API running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('Migration failed:', err.message);
    console.error('Check MySQL is running and .env credentials are correct.');
    process.exit(1);
  });
