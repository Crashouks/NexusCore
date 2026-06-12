const pool = require('./config/db');

const MIGRATIONS = [
  'ALTER TABLE games ADD COLUMN trial_enabled BOOLEAN DEFAULT TRUE',
  'ALTER TABLE games ADD COLUMN trial_duration_mins INT DEFAULT 30',
  'ALTER TABLE games ADD COLUMN trial_level_limit INT DEFAULT NULL',
  'ALTER TABLE games ADD COLUMN trial_discount_percent INT DEFAULT 10',
  'ALTER TABLE games ADD COLUMN is_carousel BOOLEAN DEFAULT FALSE',
  'ALTER TABLE games ADD COLUMN carousel_order INT DEFAULT 0',
  'ALTER TABLE games ADD COLUMN discount_percent INT DEFAULT NULL',
  'ALTER TABLE games ADD COLUMN discount_expires_at DATETIME DEFAULT NULL',
];

async function runMigrations() {
  for (const sql of MIGRATIONS) {
    try {
      await pool.query(sql);
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
    }
  }
  await pool.query('UPDATE games SET trial_enabled=TRUE WHERE trial_enabled IS NULL');
  const carouselSeeds = [
    ['neon-drift', 0],
    ['void-walker', 1],
    ['starfall-arena', 2],
    ['cyber-heist', 3],
  ];
  for (const [slug, order] of carouselSeeds) {
    await pool.query(
      'UPDATE games SET is_carousel=TRUE, carousel_order=? WHERE slug=? AND is_carousel=FALSE',
      [order, slug]
    );
  }
}

module.exports = { runMigrations };
