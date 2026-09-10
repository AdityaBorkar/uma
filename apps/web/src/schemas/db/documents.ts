import { sql } from "drizzle-orm";
import {
	customType,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
	uniqueIndex,
} from "drizzle-orm/pg-core";

/** Postgres tsvector (full-text search), used by the generated search column. */
const tsvector = customType<{ data: string; driverData: string }>({
	dataType() {
		return "tsvector";
	},
});

import { DOCUMENT_KIND_VALUES, DOCUMENT_STATE_VALUES } from "../schema.ts";
import { user } from "./auth.gen.ts";
import { projects } from "./projects.ts";

export const documentKindEnum = pgEnum("document_kind", DOCUMENT_KIND_VALUES);

export const documentStateEnum = pgEnum(
	"document_state",
	DOCUMENT_STATE_VALUES,
);

/**
 * Per-user sequential number allocation for documents. One row per user;
 * `nextNumber` is bumped atomically via INSERT … ON CONFLICT DO UPDATE.
 * Numbers are never derived from the uuid and never reused (ADR 004).
 */
export const documentCounters = pgTable("document_counters", {
	nextNumber: integer("next_number").notNull().default(1),
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
});

/**
 * Documents: the single content primitive (docs/adr/004-documents-single-primitive.md + docs/CONTEXT.md).
 * Everything a user writes is a Document — a GitHub-issue-like record
 * (number, open/closed state, labels, comments, events) whose body is MDX
 * with frontmatter. `body` stores the complete MDX source including its
 * frontmatter block; common frontmatter fields are mirrored into real
 * columns so every kind is uniformly queryable, kind-specific extras live
 * in `meta` validated per kind by Zod schemas in src/orpc/schema.ts.
 */
export const documents = pgTable(
	"documents",
	{
		body: text("body").notNull(),
		closedAt: timestamp("closed_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		id: text("id").primaryKey(),
		kind: documentKindEnum("kind").notNull(),
		labels: text("labels").array().notNull().default(sql`'{}'::text[]`),
		meta: jsonb("meta")
			.$type<Record<string, unknown>>()
			.notNull()
			.default(sql`'{}'::jsonb`),
		number: integer("number").notNull(),
		projectId: text("project_id").references(() => projects.id, {
			onDelete: "set null",
		}),
		// Generated column keeps search in sync with title + body without
		// application-side triggers (SOW §4: plain tsvector is enough for v1).
		search: tsvector("search").generatedAlwaysAs(
			sql`to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))`,
		),
		slug: text("slug").notNull(),
		state: documentStateEnum("state").notNull().default("open"),
		title: text("title").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull()
			.defaultNow(),
	},
	(table) => [
		unique("documents_user_number_uidx").on(table.createdBy, table.number),
		uniqueIndex("documents_user_slug_uidx").on(table.createdBy, table.slug),
		index("documents_user_kind_idx").on(table.createdBy, table.kind),
		index("documents_search_idx").using("gin", table.search),
	],
);

/**
 * Comments on a document (GitHub-style discussion). Markdown body, v1 is
 * single-author but the table already carries authorId for later phases.
 */
export const documentComments = pgTable(
	"document_comments",
	{
		authorId: text("author_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		body: text("body").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		documentId: text("document_id")
			.notNull()
			.references(() => documents.id, { onDelete: "cascade" }),
		id: text("id").primaryKey(),
	},
	(table) => [index("document_comments_document_idx").on(table.documentId)],
);

/**
 * Append-only event timeline: opened | closed | reopened | labeled |
 * unlabeled | renamed | commented. Written in the same transaction as the
 * mutation that caused it (SOW §6/D2 acceptance).
 */
export const documentEvents = pgTable(
	"document_events",
	{
		actorId: text("actor_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		documentId: text("document_id")
			.notNull()
			.references(() => documents.id, { onDelete: "cascade" }),
		id: text("id").primaryKey(),
		kind: text("kind").notNull(),
		payload: jsonb("payload")
			.$type<Record<string, unknown>>()
			.notNull()
			.default(sql`'{}'::jsonb`),
	},
	(table) => [index("document_events_document_idx").on(table.documentId)],
);
