ALTER TABLE `records` ADD `amount_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `records`
SET `amount_cents` = CAST(ROUND(`amount` * 100) AS INTEGER)
WHERE `amount_cents` = 0 AND `amount` <> 0;--> statement-breakpoint
CREATE INDEX `records_module_date_idx` ON `records` (`module`,`record_date`);--> statement-breakpoint
CREATE INDEX `records_reference_idx` ON `records` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `records_module_reference_unique`
ON `records` (`module`, LOWER(TRIM(`reference`)))
WHERE TRIM(`reference`) <> '';
