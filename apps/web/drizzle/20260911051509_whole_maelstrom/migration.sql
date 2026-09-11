CREATE TYPE "connection_auth_type" AS ENUM('oauth2', 'api_key', 'pat');--> statement-breakpoint
CREATE TYPE "connection_provider" AS ENUM('github', 'google');--> statement-breakpoint
CREATE TYPE "connection_status" AS ENUM('connected', 'disconnected', 'expired', 'error');--> statement-breakpoint
CREATE TYPE "document_kind" AS ENUM('wiki', 'spec', 'bug_report', 'update', 'changelog', 'release', 'deployment', 'action_log');--> statement-breakpoint
CREATE TYPE "document_state" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "device_code_status" AS ENUM('pending', 'approved', 'denied');--> statement-breakpoint
CREATE TYPE "machine_status" AS ENUM('enrolled', 'connected', 'disconnected', 'revoked');--> statement-breakpoint
CREATE TYPE "project_status" AS ENUM('active', 'on_hold', 'completed');--> statement-breakpoint
CREATE TYPE "signal_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "signal_source" AS ENUM('manual', 'github', 'ci', 'alert');--> statement-breakpoint
CREATE TYPE "signal_status" AS ENUM('new', 'triaged', 'dismissed');--> statement-breakpoint
CREATE TYPE "task_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"access_token" text,
	"access_token_expires_at" timestamp,
	"auth_type" "connection_auth_type" DEFAULT 'oauth2'::"connection_auth_type" NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"last_sync_at" timestamp,
	"metadata" jsonb,
	"provider" "connection_provider" NOT NULL,
	"provider_account_email" text,
	"provider_account_id" text,
	"refresh_token" text,
	"refresh_token_expires_at" timestamp,
	"scopes" text,
	"status" "connection_status" DEFAULT 'connected'::"connection_status" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_comments" (
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"document_id" text NOT NULL,
	"id" text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE "document_counters" (
	"next_number" integer DEFAULT 1 NOT NULL,
	"user_id" text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE "document_events" (
	"actor_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"document_id" text NOT NULL,
	"id" text PRIMARY KEY,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"body" text NOT NULL,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"id" text PRIMARY KEY,
	"kind" "document_kind" NOT NULL,
	"labels" text[] DEFAULT '{}'::text[] NOT NULL,
	"meta" jsonb DEFAULT '{}' NOT NULL,
	"number" integer NOT NULL,
	"project_id" text,
	"search" tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))) STORED,
	"slug" text NOT NULL,
	"state" "document_state" DEFAULT 'open'::"document_state" NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "documents_user_number_uidx" UNIQUE("created_by","number")
);
--> statement-breakpoint
CREATE TABLE "device_codes" (
	"client_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"device_code" text PRIMARY KEY,
	"expires_in" integer DEFAULT 600 NOT NULL,
	"interval" integer DEFAULT 2 NOT NULL,
	"machine_id" text NOT NULL,
	"machine_name" text,
	"status" "device_code_status" DEFAULT 'pending'::"device_code_status" NOT NULL,
	"user_code" text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE "machine_heartbeats" (
	"cli_version" text NOT NULL,
	"cpu" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"disk" double precision DEFAULT 0 NOT NULL,
	"id" text PRIMARY KEY,
	"machine_id" text NOT NULL,
	"quota_running" integer DEFAULT 0 NOT NULL,
	"quota_total" integer DEFAULT 0 NOT NULL,
	"ram" double precision DEFAULT 0 NOT NULL,
	"sandboxes" jsonb DEFAULT '[]' NOT NULL,
	"scope_hint" text,
	"ts" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machine_pressure_state" (
	"last_signal_at" timestamp,
	"machine_id" text NOT NULL,
	"samples" jsonb DEFAULT '[]' NOT NULL,
	"scope_key" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machine_sandboxes" (
	"machine_id" text NOT NULL,
	"project_id" text,
	"sandbox_id" text PRIMARY KEY,
	"status" text DEFAULT 'created' NOT NULL,
	"task_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machine_sessions" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"machine_id" text NOT NULL,
	"revoked_at" timestamp,
	"token" text PRIMARY KEY,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machines" (
	"cli_version" text,
	"config_version" text DEFAULT 'v1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"last_seen_at" timestamp,
	"limits" jsonb,
	"name" text NOT NULL,
	"status" "machine_status" DEFAULT 'enrolled'::"machine_status" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_logs" (
	"chunk" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"machine_id" text,
	"stream" text DEFAULT 'stdout' NOT NULL,
	"task_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"deadline_date" date,
	"definition_of_done" text DEFAULT '' NOT NULL,
	"description" text,
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"outcome" text DEFAULT '' NOT NULL,
	"slug" text NOT NULL,
	"status" "project_status" DEFAULT 'active'::"project_status" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projects_deadline_is_sunday" CHECK (EXTRACT(ISODOW FROM "deadline_date") = 7 OR "deadline_date" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "workspace_settings" (
	"id" text PRIMARY KEY,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"body" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"external_ref" text,
	"id" text PRIMARY KEY,
	"project_id" text,
	"severity" "signal_severity" DEFAULT 'info'::"signal_severity" NOT NULL,
	"source" "signal_source" DEFAULT 'manual'::"signal_source" NOT NULL,
	"status" "signal_status" DEFAULT 'new'::"signal_status" NOT NULL,
	"title" text NOT NULL,
	"triaged_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"url" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"agent" text DEFAULT 'cli' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"id" text PRIMARY KEY,
	"project_id" text,
	"prompt" text,
	"queued_at" timestamp DEFAULT now() NOT NULL,
	"result" text,
	"signal_id" text,
	"started_at" timestamp,
	"status" "task_status" DEFAULT 'queued'::"task_status" NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "tasks_finished_matches_terminal_status" CHECK ((("status" in ('completed', 'failed', 'cancelled')) = ("finished_at" is not null)))
);
--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "connections_user_provider_uidx" ON "connections" ("user_id","provider");--> statement-breakpoint
CREATE INDEX "connections_userId_idx" ON "connections" ("user_id");--> statement-breakpoint
CREATE INDEX "document_comments_document_idx" ON "document_comments" ("document_id");--> statement-breakpoint
CREATE INDEX "document_events_document_idx" ON "document_events" ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_user_slug_uidx" ON "documents" ("created_by","slug");--> statement-breakpoint
CREATE INDEX "documents_user_kind_idx" ON "documents" ("created_by","kind");--> statement-breakpoint
CREATE INDEX "documents_search_idx" ON "documents" USING gin ("search");--> statement-breakpoint
CREATE INDEX "device_codes_status_created_idx" ON "device_codes" ("status");--> statement-breakpoint
CREATE INDEX "machine_heartbeats_machine_ts_idx" ON "machine_heartbeats" ("machine_id","ts");--> statement-breakpoint
CREATE INDEX "machine_heartbeats_user_ts_idx" ON "machine_heartbeats" ("user_id","ts");--> statement-breakpoint
CREATE INDEX "machine_pressure_state_machine_scope_uidx" ON "machine_pressure_state" ("machine_id","scope_key");--> statement-breakpoint
CREATE INDEX "machine_sandboxes_machine_idx" ON "machine_sandboxes" ("machine_id");--> statement-breakpoint
CREATE INDEX "machine_sessions_machine_idx" ON "machine_sessions" ("machine_id");--> statement-breakpoint
CREATE UNIQUE INDEX "machines_user_name_uidx" ON "machines" ("user_id","name");--> statement-breakpoint
CREATE INDEX "machines_user_status_idx" ON "machines" ("user_id","status");--> statement-breakpoint
CREATE INDEX "task_logs_task_created_idx" ON "task_logs" ("task_id");--> statement-breakpoint
CREATE INDEX "projects_createdBy_idx" ON "projects" ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_user_slug_uidx" ON "projects" ("created_by","slug");--> statement-breakpoint
CREATE INDEX "signals_user_status_idx" ON "signals" ("user_id","status");--> statement-breakpoint
CREATE INDEX "signals_user_created_idx" ON "signals" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "tasks_user_status_idx" ON "tasks" ("user_id","status");--> statement-breakpoint
CREATE INDEX "tasks_user_queued_idx" ON "tasks" ("user_id","queued_at");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_author_id_user_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_document_id_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document_counters" ADD CONSTRAINT "document_counters_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document_events" ADD CONSTRAINT "document_events_actor_id_user_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document_events" ADD CONSTRAINT "document_events_document_id_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "machine_heartbeats" ADD CONSTRAINT "machine_heartbeats_machine_id_machines_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "machine_heartbeats" ADD CONSTRAINT "machine_heartbeats_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "machine_sandboxes" ADD CONSTRAINT "machine_sandboxes_machine_id_machines_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "machine_sandboxes" ADD CONSTRAINT "machine_sandboxes_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "machine_sandboxes" ADD CONSTRAINT "machine_sandboxes_task_id_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "machine_sessions" ADD CONSTRAINT "machine_sessions_machine_id_machines_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "machine_sessions" ADD CONSTRAINT "machine_sessions_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_logs" ADD CONSTRAINT "task_logs_machine_id_machines_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "task_logs" ADD CONSTRAINT "task_logs_task_id_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_signal_id_signals_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "signals"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;