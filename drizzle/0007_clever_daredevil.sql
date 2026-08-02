CREATE TABLE `importacoes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text DEFAULT 'beta-construtora' NOT NULL,
	`nome_arquivo` text NOT NULL,
	`url_arquivo` text DEFAULT '' NOT NULL,
	`modulo_destino` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Pendente' NOT NULL,
	`total_linhas` integer DEFAULT 0 NOT NULL,
	`total_sucesso` integer DEFAULT 0 NOT NULL,
	`total_atualizados` integer DEFAULT 0 NOT NULL,
	`total_ignorados` integer DEFAULT 0 NOT NULL,
	`total_erros` integer DEFAULT 0 NOT NULL,
	`responsavel` text DEFAULT '' NOT NULL,
	`iniciado_em` text DEFAULT '' NOT NULL,
	`finalizado_em` text DEFAULT '' NOT NULL,
	`criado_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `importacoes_tenant_data_idx` ON `importacoes` (`tenant_id`,`criado_em`);--> statement-breakpoint
CREATE INDEX `importacoes_tenant_status_idx` ON `importacoes` (`tenant_id`,`status`);--> statement-breakpoint
CREATE TABLE `importacao_erros` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text DEFAULT 'beta-construtora' NOT NULL,
	`importacao_id` text NOT NULL,
	`linha` integer NOT NULL,
	`aba` text DEFAULT '' NOT NULL,
	`modulo` text DEFAULT '' NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`motivo` text NOT NULL,
	`resolvido` integer DEFAULT false NOT NULL,
	`resolvido_por` text DEFAULT '' NOT NULL,
	`resolvido_em` text DEFAULT '' NOT NULL,
	`criado_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`importacao_id`) REFERENCES `importacoes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `importacao_erros_busca` ON `importacao_erros` (`tenant_id`,`importacao_id`) WHERE "importacao_erros"."resolvido" = 0;--> statement-breakpoint
ALTER TABLE `records` ADD `import_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `records_tenant_module_import_key_unique` ON `records` (`tenant_id`,`module`,`import_key`) WHERE TRIM("records"."import_key") <> '';
