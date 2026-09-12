CREATE TABLE `config_receipts` (
	`error` text,
	`job_id` text NOT NULL,
	`key` text NOT NULL,
	`ok` integer NOT NULL,
	`ts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `heartbeats` (
	`config_version` text DEFAULT 'v1' NOT NULL,
	`cpu` real NOT NULL,
	`disk` real NOT NULL,
	`pids` text DEFAULT '[]' NOT NULL,
	`quota_usage` text DEFAULT '{}' NOT NULL,
	`ram` real NOT NULL,
	`sandboxes` text DEFAULT '[]' NOT NULL,
	`ts` integer PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE `log_buffer` (
	`chunk` text NOT NULL,
	`task_id` text NOT NULL,
	`ts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `provider_keys` (
	`fingerprint` text NOT NULL,
	`provider` text PRIMARY KEY,
	`secret` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sandbox_events` (
	`detail` text,
	`event` text NOT NULL,
	`sandbox_id` text NOT NULL,
	`task_id` text,
	`ts` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_config_receipts_ts` ON `config_receipts` (`ts`);--> statement-breakpoint
CREATE INDEX `idx_log_buffer_task` ON `log_buffer` (`task_id`,`ts`);--> statement-breakpoint
CREATE INDEX `idx_log_buffer_ts` ON `log_buffer` (`ts`);--> statement-breakpoint
CREATE INDEX `idx_sandbox_events_ts` ON `sandbox_events` (`ts`);--> statement-breakpoint
CREATE INDEX `idx_sandbox_events_sandbox` ON `sandbox_events` (`sandbox_id`,`ts`);