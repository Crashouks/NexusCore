USE NexusCore;

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS trial_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS trial_duration_mins INT DEFAULT 30,
  ADD COLUMN IF NOT EXISTS trial_level_limit INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trial_discount_percent INT DEFAULT 10;

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS is_carousel BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS carousel_order INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percent INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_expires_at DATETIME DEFAULT NULL;

ALTER TABLE cloud_sessions
  ADD COLUMN IF NOT EXISTS stream_quality VARCHAR(10) DEFAULT '1080p';

CREATE TABLE IF NOT EXISTS cart_items (
  user_id INT NOT NULL, game_id INT NOT NULL,
  added_at DATETIME DEFAULT NOW(),
  PRIMARY KEY (user_id, game_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (game_id) REFERENCES games(game_id)
);

CREATE TABLE IF NOT EXISTS wishlist (
  user_id INT NOT NULL, game_id INT NOT NULL,
  added_at DATETIME DEFAULT NOW(),
  PRIMARY KEY (user_id, game_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (game_id) REFERENCES games(game_id)
);
