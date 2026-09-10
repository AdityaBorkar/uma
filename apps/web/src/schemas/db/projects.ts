import { sql } from "drizzle-orm";
import {
	check,
	date,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { PROJECT_STATUS_VALUES } from "../schema.ts";
import { user } from "./auth.gen.ts";

export const projectStatusEnum = pgEnum(
	"project_status",
	PROJECT_STATUS_VALUES,
);

export const projects = pgTable(
	"projects",
	{
		createdAt: timestamp("created_at").defaultNow().notNull(),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		deadlineDate: date("deadline_date", { mode: "date" }),
		definitionOfDone: text("definition_of_done").notNull().default(""),
		description: text("description"),
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		outcome: text("outcome").notNull().default(""),
		slug: text("slug").notNull(),
		status: projectStatusEnum("status").notNull().default("active"),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("projects_createdBy_idx").on(table.createdBy),
		uniqueIndex("projects_user_slug_uidx").on(table.createdBy, table.slug),
		check(
			"projects_deadline_is_sunday",
			sql`EXTRACT(ISODOW FROM ${table.deadlineDate}) = 7 OR ${table.deadlineDate} IS NULL`,
		),
	],
);
