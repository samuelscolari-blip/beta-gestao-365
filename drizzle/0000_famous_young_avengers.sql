CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`module` text NOT NULL,
	`record_id` integer,
	`summary` text DEFAULT '' NOT NULL,
	`actor` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_logs_module_idx` ON `audit_logs` (`module`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`module` text NOT NULL,
	`title` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`status` text DEFAULT '' NOT NULL,
	`record_date` text DEFAULT '' NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`source` text DEFAULT 'system' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `records_module_idx` ON `records` (`module`);--> statement-breakpoint
CREATE INDEX `records_module_status_idx` ON `records` (`module`,`status`);--> statement-breakpoint
CREATE INDEX `records_record_date_idx` ON `records` (`record_date`);