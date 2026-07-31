CREATE TABLE `compliance_issues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` text NOT NULL,
	`document_id` integer NOT NULL,
	`item_line` integer DEFAULT 0 NOT NULL,
	`code` text NOT NULL,
	`severity` text NOT NULL,
	`message` text NOT NULL,
	`field_name` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Aberta' NOT NULL,
	`resolved_by` text DEFAULT '' NOT NULL,
	`resolved_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `compliance_issues_document_idx` ON `compliance_issues` (`tenant_id`,`document_id`,`status`);--> statement-breakpoint
CREATE TABLE `fiscal_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` text NOT NULL,
	`direction` text NOT NULL,
	`fiscal_key` text DEFAULT '' NOT NULL,
	`document_number` text DEFAULT '' NOT NULL,
	`series` text DEFAULT '' NOT NULL,
	`issue_date` text DEFAULT '' NOT NULL,
	`competence` text DEFAULT '' NOT NULL,
	`partner_name` text DEFAULT '' NOT NULL,
	`partner_tax_id` text DEFAULT '' NOT NULL,
	`supplier_tax_regime` text DEFAULT '' NOT NULL,
	`item_description` text DEFAULT '' NOT NULL,
	`item_code` text DEFAULT '' NOT NULL,
	`cst` text DEFAULT '' NOT NULL,
	`cclass_trib` text DEFAULT '' NOT NULL,
	`operation_value` real DEFAULT 0 NOT NULL,
	`reduction_percent` real DEFAULT 0 NOT NULL,
	`taxable_base` real DEFAULT 0 NOT NULL,
	`ibs_state_rate` real DEFAULT 0 NOT NULL,
	`ibs_municipal_rate` real DEFAULT 0 NOT NULL,
	`ibs_amount` real DEFAULT 0 NOT NULL,
	`cbs_rate` real DEFAULT 0 NOT NULL,
	`cbs_amount` real DEFAULT 0 NOT NULL,
	`deferment_percent` real DEFAULT 0 NOT NULL,
	`credit_eligible` integer DEFAULT false NOT NULL,
	`credit_amount` real DEFAULT 0 NOT NULL,
	`presumed_credit` real DEFAULT 0 NOT NULL,
	`blocked_credit` real DEFAULT 0 NOT NULL,
	`blocked_credit_reason` text DEFAULT '' NOT NULL,
	`credit_basis` text DEFAULT '' NOT NULL,
	`work_name` text DEFAULT '' NOT NULL,
	`cost_center` text DEFAULT '' NOT NULL,
	`document_url` text DEFAULT '' NOT NULL,
	`compliance_status` text DEFAULT '' NOT NULL,
	`critical_count` integer DEFAULT 0 NOT NULL,
	`warning_count` integer DEFAULT 0 NOT NULL,
	`validation_json` text DEFAULT '[]' NOT NULL,
	`calculation_json` text DEFAULT '{}' NOT NULL,
	`source_module` text DEFAULT '' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`superseded_by` integer,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fiscal_documents_tenant_key_idx` ON `fiscal_documents` (`tenant_id`,`fiscal_key`);--> statement-breakpoint
CREATE INDEX `fiscal_documents_competence_idx` ON `fiscal_documents` (`tenant_id`,`competence`);--> statement-breakpoint
CREATE INDEX `fiscal_documents_status_idx` ON `fiscal_documents` (`tenant_id`,`compliance_status`);--> statement-breakpoint
CREATE TABLE `fiscal_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` text NOT NULL,
	`document_id` integer NOT NULL,
	`line_number` integer DEFAULT 1 NOT NULL,
	`item_description` text DEFAULT '' NOT NULL,
	`item_code` text DEFAULT '' NOT NULL,
	`cst` text DEFAULT '' NOT NULL,
	`cclass_trib` text DEFAULT '' NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit_value` real DEFAULT 0 NOT NULL,
	`operation_value` real DEFAULT 0 NOT NULL,
	`reduction_percent` real DEFAULT 0 NOT NULL,
	`taxable_base` real DEFAULT 0 NOT NULL,
	`ibs_state_rate` real DEFAULT 0 NOT NULL,
	`ibs_municipal_rate` real DEFAULT 0 NOT NULL,
	`ibs_amount` real DEFAULT 0 NOT NULL,
	`cbs_rate` real DEFAULT 0 NOT NULL,
	`cbs_amount` real DEFAULT 0 NOT NULL,
	`deferment_percent` real DEFAULT 0 NOT NULL,
	`credit_eligible` integer DEFAULT false NOT NULL,
	`credit_amount` real DEFAULT 0 NOT NULL,
	`presumed_credit` real DEFAULT 0 NOT NULL,
	`blocked_credit` real DEFAULT 0 NOT NULL,
	`blocked_credit_reason` text DEFAULT '' NOT NULL,
	`credit_basis` text DEFAULT '' NOT NULL,
	`validation_json` text DEFAULT '[]' NOT NULL,
	`calculation_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `fiscal_documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `fiscal_items_document_idx` ON `fiscal_items` (`tenant_id`,`document_id`,`line_number`);--> statement-breakpoint
CREATE TABLE `ibs_cbs_adjustments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` text NOT NULL,
	`competence` text NOT NULL,
	`adjustment_type` text NOT NULL,
	`tax_type` text DEFAULT 'IBS/CBS' NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`actor` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ibs_cbs_adjustments_comp_idx` ON `ibs_cbs_adjustments` (`tenant_id`,`competence`);--> statement-breakpoint
CREATE TABLE `ibs_cbs_assessments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` text NOT NULL,
	`competence` text NOT NULL,
	`status` text DEFAULT 'Aberta' NOT NULL,
	`ibs_debits` real DEFAULT 0 NOT NULL,
	`ibs_credits` real DEFAULT 0 NOT NULL,
	`ibs_balance` real DEFAULT 0 NOT NULL,
	`cbs_debits` real DEFAULT 0 NOT NULL,
	`cbs_credits` real DEFAULT 0 NOT NULL,
	`cbs_balance` real DEFAULT 0 NOT NULL,
	`blocked_credits` real DEFAULT 0 NOT NULL,
	`debit_adjustments` real DEFAULT 0 NOT NULL,
	`credit_adjustments` real DEFAULT 0 NOT NULL,
	`pis_cofins_compensation` real DEFAULT 0 NOT NULL,
	`technical_balance` real DEFAULT 0 NOT NULL,
	`pending_documents` integer DEFAULT 0 NOT NULL,
	`critical_issues` integer DEFAULT 0 NOT NULL,
	`close_reason` text DEFAULT '' NOT NULL,
	`closed_by` text DEFAULT '' NOT NULL,
	`closed_at` text DEFAULT '' NOT NULL,
	`reopened_by` text DEFAULT '' NOT NULL,
	`reopened_at` text DEFAULT '' NOT NULL,
	`reopen_reason` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ibs_cbs_assessment_tenant_competence_unique` ON `ibs_cbs_assessments` (`tenant_id`,`competence`);--> statement-breakpoint
CREATE TABLE `ibs_cbs_audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer,
	`summary` text DEFAULT '' NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`actor` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ibs_cbs_audit_tenant_idx` ON `ibs_cbs_audit_logs` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ibs_cbs_configurations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` text NOT NULL,
	`regime` text DEFAULT 'Regime regular' NOT NULL,
	`incidence_enabled` integer DEFAULT true NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text DEFAULT '' NOT NULL,
	`ibs_state_rate` real DEFAULT 0.1 NOT NULL,
	`ibs_municipal_rate` real DEFAULT 0 NOT NULL,
	`cbs_rate` real DEFAULT 0.9 NOT NULL,
	`reduction_percent` real DEFAULT 0 NOT NULL,
	`deferment_percent` real DEFAULT 0 NOT NULL,
	`credit_enabled` integer DEFAULT true NOT NULL,
	`special_regime` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`rules_version` text DEFAULT 'BR-RTC-2026.2-NT2025.002-v1.40' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ibs_cbs_config_tenant_idx` ON `ibs_cbs_configurations` (`tenant_id`,`effective_from`);