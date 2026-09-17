import type { KNOWN_AGENT_NAMES } from "@uma/orpc-contract";
import { sql } from "drizzle-orm";
import {
	check,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth.gen.ts";
import { machines } from "./machines.ts";
import { tasks } from "./tasks.ts";

export const agentStatusEnum = pgEnum("agent_status", [
	"available",
	"disabled",
	"deprecated",
]);

/**
 * Coding-agent registry: user-owned catalog of agent binaries that can run
 * tasks on the user's machines. Well-known names (`opencode`, `pi`, `omp` —
 * `KNOWN_AGENT_NAMES` in `@uma/orpc-contract`) are seeded per user on first
 * `agents.list`; users add custom entries for their own binaries.
 * `tasks.agent` stores the agent *name* (plain text) so task rows stay valid
 * even when a registry entry is renamed or removed.
 */
export const agents = pgTable(
	"agents",
	{
		binary: text("binary"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		description: text("description"),
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		status: agentStatusEnum("status").notNull().default("available"),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull()
			.defaultNow(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		version: text("version"),
	},
	(table) => [
		uniqueIndex("agents_user_name_uidx").on(table.userId, table.name),
		index("agents_user_status_idx").on(table.userId, table.status),
	],
);

/** Descriptions for the well-known agents seeded on first list. */
export const KNOWN_AGENT_DESCRIPTIONS: Record<
	(typeof KNOWN_AGENT_NAMES)[number],
	string
> = {
	omp: "Multi-agent orchestrator.",
	opencode: "AI coding agent for terminal and automation.",
	pi: "Lightweight interactive coding agent.",
};

export const runStatusEnum = pgEnum("run_status", [
	"running",
	"completed",
	"failed",
	"cancelled",
]);

/**
 * Task runs: one row per execution attempt of a task on a machine.
 * Created as a side effect of the atomic claim (`queued → running`); reaches
 * a terminal status when the task finishes. Browser clients read runs;
 * writes are owned by the claim/finish paths so runs can never disagree
 * with task status.
 */
export const taskRuns = pgTable(
	"task_runs",
	{
		agent: text("agent").notNull().default("cli"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		finishedAt: timestamp("finished_at"),
		id: text("id").primaryKey(),
		machineId: text("machine_id").references(() => machines.id, {
			onDelete: "set null",
		}),
		result: text("result"),
		sandboxId: text("sandbox_id"),
		startedAt: timestamp("started_at"),
		status: runStatusEnum("status").notNull().default("running"),
		taskId: text("task_id")
			.notNull()
			.references(() => tasks.id, { onDelete: "cascade" }),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull()
			.defaultNow(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("task_runs_user_status_idx").on(table.userId, table.status),
		index("task_runs_task_idx").on(table.taskId),
		index("task_runs_machine_idx").on(table.machineId),
		check(
			"task_runs_finished_matches_terminal_status",
			sql`((${table.status} in ('completed','failed','cancelled')) = (${table.finishedAt} is not null))`,
		),
	],
);
