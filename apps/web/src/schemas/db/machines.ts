import {
	doublePrecision,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth.gen.ts";
import { projects } from "./projects.ts";
import { tasks } from "./tasks.ts";

/**
 * Machines: user-owned devices enrolled to run Tasks (device-code flow,
 * Bearer machine sessions). Ported from the `server-central` test harness
 * into Postgres-backed production storage.
 *
 * Domain terms (docs/CONTEXT.md): Machine, Connection State (`status`
 * column — never `state`), Task Status, Severity.
 */

export const machineStatusEnum = pgEnum("machine_status", [
	"enrolled",
	"connected",
	"disconnected",
	"revoked",
]);

export const deviceCodeStatusEnum = pgEnum("device_code_status", [
	"pending",
	"approved",
	"denied",
]);

export const machines = pgTable(
	"machines",
	{
		cliVersion: text("cli_version"),
		configVersion: text("config_version").notNull().default("v1"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		id: text("id").primaryKey(),
		lastSeenAt: timestamp("last_seen_at"),
		limits: jsonb("limits").$type<{
			maxRunning?: number;
			maxTotal?: number;
		} | null>(),
		name: text("name").notNull(),
		status: machineStatusEnum("status").notNull().default("enrolled"),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull()
			.defaultNow(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		uniqueIndex("machines_user_name_uidx").on(table.userId, table.name),
		index("machines_user_status_idx").on(table.userId, table.status),
	],
);

export const deviceCodes = pgTable(
	"device_codes",
	{
		clientId: text("client_id").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		deviceCode: text("device_code").primaryKey(),
		expiresIn: integer("expires_in").notNull().default(600),
		interval: integer("interval").notNull().default(2),
		machineId: text("machine_id").notNull(),
		machineName: text("machine_name"),
		status: deviceCodeStatusEnum("status").notNull().default("pending"),
		userCode: text("user_code").notNull().unique(),
	},
	(table) => [index("device_codes_status_created_idx").on(table.status)],
);

export const machineSessions = pgTable(
	"machine_sessions",
	{
		createdAt: timestamp("created_at").defaultNow().notNull(),
		machineId: text("machine_id")
			.notNull()
			.references(() => machines.id, { onDelete: "cascade" }),
		revoked: timestamp("revoked_at"),
		token: text("token").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [index("machine_sessions_machine_idx").on(table.machineId)],
);

export const machineHeartbeats = pgTable(
	"machine_heartbeats",
	{
		cliVersion: text("cli_version").notNull(),
		cpu: doublePrecision("cpu").notNull().default(0),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		disk: doublePrecision("disk").notNull().default(0),
		id: text("id").primaryKey(),
		machineId: text("machine_id")
			.notNull()
			.references(() => machines.id, { onDelete: "cascade" }),
		quotaRunning: integer("quota_running").notNull().default(0),
		quotaTotal: integer("quota_total").notNull().default(0),
		ram: doublePrecision("ram").notNull().default(0),
		sandboxes: jsonb("sandboxes")
			.$type<
				{
					id: string;
					taskId: string | null;
					status: string;
				}[]
			>()
			.notNull()
			.default([]),
		scopeHint: text("scope_hint"),
		ts: timestamp("ts").notNull().defaultNow(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("machine_heartbeats_machine_ts_idx").on(table.machineId, table.ts),
		index("machine_heartbeats_user_ts_idx").on(table.userId, table.ts),
	],
);

export const machineSandboxes = pgTable(
	"machine_sandboxes",
	{
		machineId: text("machine_id")
			.notNull()
			.references(() => machines.id, { onDelete: "cascade" }),
		projectId: text("project_id").references(() => projects.id, {
			onDelete: "set null",
		}),
		sandboxId: text("sandbox_id").primaryKey(),
		status: text("status").notNull().default("created"),
		taskId: text("task_id").references(() => tasks.id, {
			onDelete: "set null",
		}),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull()
			.defaultNow(),
	},
	(table) => [index("machine_sandboxes_machine_idx").on(table.machineId)],
);

/** Streaming exec output per Task (was an in-memory array in server-central). */
export const taskLogs = pgTable(
	"task_logs",
	{
		chunk: text("chunk").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		id: text("id").primaryKey(),
		machineId: text("machine_id").references(() => machines.id, {
			onDelete: "set null",
		}),
		stream: text("stream").notNull().default("stdout"),
		taskId: text("task_id")
			.notNull()
			.references(() => tasks.id, { onDelete: "cascade" }),
	},
	(table) => [index("task_logs_task_created_idx").on(table.taskId)],
);

export const machinePressureState = pgTable(
	"machine_pressure_state",
	{
		lastSignalAt: timestamp("last_signal_at"),
		machineId: text("machine_id").notNull(),
		samples: jsonb("samples")
			.$type<{ ts: number; cpu: number; disk: number }[]>()
			.notNull()
			.default([]),
		scopeKey: text("scope_key").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("machine_pressure_state_machine_scope_uidx").on(
			table.machineId,
			table.scopeKey,
		),
	],
);
