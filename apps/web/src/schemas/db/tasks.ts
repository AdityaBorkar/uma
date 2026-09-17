import { sql } from "drizzle-orm";
import {
	check,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

import { TASK_STATUS_VALUES } from "../schema.ts";
import { user } from "./auth.gen.ts";
import { projects } from "./projects.ts";

export const taskStatusEnum = pgEnum("task_status", TASK_STATUS_VALUES);

/**
 * Agentic tasks: units of agent-executable work.
 * Lifecycle is server-guarded (queued → running → completed|failed|cancelled,
 * failed → queued retry); timestamps are stamped by the API, never the client.
 */
export const tasks = pgTable(
	"tasks",
	{
		agent: text("agent").notNull().default("cli"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		finishedAt: timestamp("finished_at"),
		id: text("id").primaryKey(),
		projectId: text("project_id").references(() => projects.id, {
			onDelete: "set null",
		}),
		prompt: text("prompt"),
		queuedAt: timestamp("queued_at").defaultNow().notNull(),
		result: text("result"),
		startedAt: timestamp("started_at"),
		status: taskStatusEnum("status").notNull().default("queued"),
		title: text("title").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull()
			.defaultNow(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("tasks_user_status_idx").on(table.userId, table.status),
		index("tasks_user_queued_idx").on(table.userId, table.queuedAt),
		check(
			"tasks_finished_matches_terminal_status",
			sql`((${table.status} in ('completed', 'failed', 'cancelled')) = (${table.finishedAt} is not null))`,
		),
	],
);
