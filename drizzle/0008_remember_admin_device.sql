CREATE TABLE IF NOT EXISTS `admin_device_sessions` (
  `token_hash` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `created_at` text NOT NULL,
  `expires_at` text NOT NULL,
  `last_seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_admin_device_sessions_expires_at`
ON `admin_device_sessions` (`expires_at`);
