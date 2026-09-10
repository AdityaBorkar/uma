import { sql } from "drizzle-orm";
import {
	check,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

import {
	SIGNAL_SEVERITY_VALUES,
	SIGNAL_STATUS_VALUES,
	TASK_STATUS_VALUES,
} from "../schema.ts";
import { user } from "./auth.gen.ts";
import { projects } from "./projects.ts";

export const signalSourceEnum = pgEnum("signal_source", [
	"manual",
	"github",
	"ci",
	"alert",
]);

export const signalSeverityEnum = pgEnum(
	"signal_severity",
	SIGNAL_SEVERITY_VALUES,
);

export const signalStatusEnum = pgEnum("signal_status", SIGNAL_STATUS_VALUES);

/**
 * Signals: inbound issues worth attention (docs/CONTEXT.md (Signal/Task) §2).
 * A signal arrives and ages — it is not committed work until triaged into a task.
 * `source`/`externalRef` are provisioned for future ingestion; v1 writes manual only.
 */
export const signals = pgTable(
	"signals",
	{
		body: text("body"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		externalRef: text("external_ref"),
		id: text("id").primaryKey(),
		projectId: text("project_id").references(() => projects.id, {
			onDelete: "set null",
		}),
		severity: signalSeverityEnum("severity").notNull().default("info"),
		source: signalSourceEnum("source").notNull().default("manual"),
		status: signalStatusEnum("status").notNull().default("new"),
		title: text("title").notNull(),
		triagedAt: timestamp("triaged_at"),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull()
			.defaultNow(),
		url: text("url"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("signals_user_status_idx").on(table.userId, table.status),
		index("signals_user_created_idx").on(table.userId, table.createdAt),
	],
);

export const taskStatusEnum = pgEnum("task_status", TASK_STATUS_VALUES);

/**
 * Agentic tasks: units of agent-executable work, usually derived from a signal.
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
		signalId: text("signal_id").references(() => signals.id, {
			onDelete: "set null",
		}),
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
