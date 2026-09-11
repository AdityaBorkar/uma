CREATE TYPE "agent_status" AS ENUM('available', 'disabled', 'deprecated');--> statement-breakpoint
CREATE TYPE "run_status" AS ENUM('running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "agents" (
	"binary" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"status" "agent_status" DEFAULT 'available'::"agent_status" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"version" text
);
--> statement-breakpoint
CREATE TABLE "task_runs" (
	"agent" text DEFAULT 'cli' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"id" text PRIMARY KEY,
	"machine_id" text,
	"result" text,
	"sandbox_id" text,
	"started_at" timestamp,
	"status" "run_status" DEFAULT 'running'::"run_status" NOT NULL,
	"task_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "task_runs_finished_matches_terminal_status" CHECK ((("status" in ('completed','failed','cancelled')) = ("finished_at" is not null)))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "agents_user_name_uidx" ON "agents" ("user_id","name");--> statement-breakpoint
CREATE INDEX "agents_user_status_idx" ON "agents" ("user_id","status");--> statement-breakpoint
CREATE INDEX "task_runs_user_status_idx" ON "task_runs" ("user_id","status");--> statement-breakpoint
CREATE INDEX "task_runs_task_idx" ON "task_runs" ("task_id");--> statement-breakpoint
CREATE INDEX "task_runs_machine_idx" ON "task_runs" ("machine_id");--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_runs" ADD CONSTRAINT "task_runs_machine_id_machines_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "task_runs" ADD CONSTRAINT "task_runs_task_id_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_runs" ADD CONSTRAINT "task_runs_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;