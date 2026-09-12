import { sql } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	real,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth.gen.ts";

/**
 * Subagents: user-owned OpenCode-style specialized assistants.
 *
 * Distinct from `agents` (coding-agent *binaries* that run tasks on
 * machines). A subagent is a prompt + model + tuning + permission config
 * that a primary agent invokes via `@mention` or the Task tool.
 * No built-ins are seeded; only custom rows are stored.
 * `permissions` holds shorthand actions (`allow | ask | deny`) keyed by
 * tool group (`edit`, `bash`, `webfetch`, `websearch`, `task`).
 */
export const subagents = pgTable(
	"subagents",
	{
		color: text("color"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		description: text("description").notNull(),
		disabled: boolean("disabled").notNull().default(false),
		hidden: boolean("hidden").notNull().default(false),
		id: text("id").primaryKey(),
		model: text("model"),
		name: text("name").notNull(),
		permissions: jsonb("permissions")
			.$type<Record<string, string>>()
			.notNull()
			.default(sql`'{}'::jsonb`),
		prompt: text("prompt").notNull(),
		steps: integer("steps"),
		temperature: real("temperature"),
		topP: real("top_p"),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull()
			.defaultNow(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		uniqueIndex("subagents_user_name_uidx").on(table.userId, table.name),
		index("subagents_user_idx").on(table.userId),
	],
);

export type SubagentRow = typeof subagents.$inferSelect;
