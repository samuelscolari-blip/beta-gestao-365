CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`legal_name` text NOT NULL,
	`trade_name` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
INSERT OR IGNORE INTO `tenants` (`id`, `legal_name`, `trade_name`, `status`)
VALUES ('beta-construtora', 'Beta Construtora', 'Beta Construtora', 'ACTIVE');
