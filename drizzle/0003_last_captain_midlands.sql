ALTER TABLE `audit_logs` ADD `tenant_id` text DEFAULT 'beta-construtora' NOT NULL;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `previous_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `entry_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `audit_logs_tenant_created_idx` ON `audit_logs` (`tenant_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `records` ADD `tenant_id` text DEFAULT 'beta-construtora' NOT NULL;--> statement-breakpoint
CREATE INDEX `records_tenant_module_idx` ON `records` (`tenant_id`,`module`);--> statement-breakpoint
CREATE INDEX `records_tenant_reference_idx` ON `records` (`tenant_id`,`reference`);--> statement-breakpoint
DROP INDEX IF EXISTS `records_module_reference_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `records_tenant_module_reference_unique`
ON `records` (`tenant_id`, `module`, LOWER(TRIM(`reference`)))
WHERE TRIM(`reference`) <> '';--> statement-breakpoint
CREATE TRIGGER `audit_logs_immutable_update`
BEFORE UPDATE ON `audit_logs`
BEGIN
  SELECT RAISE(ABORT, 'AUDIT_LOG_IMMUTABLE');
END;--> statement-breakpoint
CREATE TRIGGER `audit_logs_immutable_delete`
BEFORE DELETE ON `audit_logs`
BEGIN
  SELECT RAISE(ABORT, 'AUDIT_LOG_IMMUTABLE');
END;
