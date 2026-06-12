const express = require('express');
const multer = require('multer');
const path = require('path');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s/g, '_')}`);
  },
});

const imageFilter = (req, file, cb) => {
  if (/^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only image files allowed'), false);
};

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imageFilter });

async function handleUpload(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file', code: 'VALIDATION_ERROR' });
    const url = `/uploads/${req.file.filename}`;
    const { game_id, media_type } = req.body;
    if (game_id) {
      await pool.query(
        'INSERT INTO game_media (game_id, media_type, url) VALUES (?, ?, ?)',
        [game_id, media_type || 'image', url]
      );
    }
    res.json({ url, size: req.file.size, mimetype: req.file.mimetype });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
}

router.post('/upload', auth, requireRole('developer', 'admin'), upload.single('file'), handleUpload);

router.get('/validate-url', auth, async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'URL required', code: 'VALIDATION_ERROR' });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);
    const ct = response.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) {
      return res.status(400).json({ valid: false, error: 'URL is not an image', code: 'NOT_IMAGE' });
    }
    res.json({ valid: true, contentType: ct });
  } catch (err) {
    res.status(400).json({ valid: false, error: 'Could not validate URL', code: 'INVALID_URL' });
  }
});

module.exports = router;
module.exports.uploadMiddleware = upload.single('file');
