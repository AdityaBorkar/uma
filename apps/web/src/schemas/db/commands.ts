import {
	boolean,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth.gen.ts";

/**
 * Commands: user-owned OpenCode-style slash commands (`/name`).
 *
 * Distinct from `subagents` (specialized assistants invoked via `@mention`).
 * A command is a reusable prompt template with `$ARGUMENTS` / `$1..$n`,
 * `!`shell`` and `@file` placeholders, plus optional `agent` / `model` /
 * `subtask` overrides. No built-ins are seeded; only custom rows are stored.
 */
export const commands = pgTable(
	"commands",
	{
		agent: text("agent"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		description: text("description").notNull().default(""),
		id: text("id").primaryKey(),
		model: text("model"),
		name: text("name").notNull(),
		subtask: boolean("subtask").notNull().default(false),
		template: text("template").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull()
			.defaultNow(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		uniqueIndex("commands_user_name_uidx").on(table.userId, table.name),
		index("commands_user_idx").on(table.userId),
	],
);

export type CommandRow = typeof commands.$inferSelect;
