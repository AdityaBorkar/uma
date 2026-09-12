/**
 * Runtime schema sync for the device-side state.db.
 *
 * Instead of generated/hardcoded migrations, the DDL is computed on the go
 * from `src/db/schema.ts` (drizzle table definitions are the single source of
 * truth): every open compares the drizzle schema against the live database
 * (`sqlite_master` + `PRAGMA table_info`) and applies only the additive
 * SQLite statements needed to converge —
 *
 * - missing tables  → `CREATE TABLE IF NOT EXISTS` (SQL derived from columns)
 * - missing columns → `ALTER TABLE ... ADD COLUMN`
 * - missing indexes → `CREATE [UNIQUE] INDEX IF NOT EXISTS`
 *
 * Nothing destructive is ever emitted (no DROP / RENAME / type change) —
 * SQLite would require a table rebuild for those, which is a manual ops step.
 * All statements run in one transaction, so a crash replays the whole sync.
 * `PRAGMA user_version` is stamped with a stable fingerprint (FNV-1a of the
 * computed DDL) for ops introspection; it is a fingerprint, not a counter.
 */
import type { Database } from "bun:sqlite";

import { Column, is } from "drizzle-orm";
import {
	getTableConfig,
	type SQLiteColumn,
	type SQLiteTable,
} from "drizzle-orm/sqlite-core";

import { schema } from "../../db/schema.tsdb/schema.ts";

export interface SchemaSyncResult {
	addedColumns: string[];
	createdIndexes: string[];
	createdTables: string[];
}

function quoteIdent(name: string): string {
	return `"${name.replaceAll('"', '""')}"`;
}

/** SQL literal for a static column default (drizzle stores the JS value). */
function defaultLiteral(value: unknown): string {
	if (typeof value === "number" || typeof value === "bigint") {
		return String(value);
	}
	if (typeof value === "boolean") {
		return value ? "1" : "0";
	}
	if (typeof value === "string") {
		return `'${value.replaceAll("'", "''")}'`;
	}
	if (value === null) {
		return "null";
	}
	if (value instanceof Uint8Array) {
		return `X'${Buffer.from(value).toString("hex")}'`;
	}
	throw new Error(
		`schema-sync: unsupported default value ${String(value)} — use a static text/number/boolean/blob default in schema.ts`,
	);
}

function columnSql(col: SQLiteColumn): string {
	let out = `${quoteIdent(col.name)} ${col.getSQLType()}`;
	if (col.primary) {
		out += " PRIMARY KEY";
	} else if (col.notNull) {
		out += " NOT NULL";
	}
	if (col.default !== undefined) {
		out += ` DEFAULT ${defaultLiteral(col.default)}`;
	}
	return out;
}

function createTableSql(table: SQLiteTable): string {
	const cfg = getTableConfig(table);
	const lines = cfg.columns.map((c) => `\t${columnSql(c)}`);
	const compositePks = cfg.primaryKeys;
	if (compositePks.length > 0) {
		const cols = compositePks
			.flatMap((pk) => pk.columns.map((c) => quoteIdent(c.name)))
			.join(", ");
		lines.push(`\tPRIMARY KEY (${cols})`);
	}
	return `CREATE TABLE IF NOT EXISTS ${quoteIdent(cfg.name)} (\n${lines.join(",\n")}\n)`;
}

function createIndexSqls(table: SQLiteTable): { name: string; sql: string }[] {
	const cfg = getTableConfig(table);
	return cfg.indexes.map((ix) => {
		const conf = ix.config;
		if (conf.where !== undefined) {
			throw new Error(
				`schema-sync: partial index ${conf.name} unsupported — remove the .where(...) in schema.ts`,
			);
		}
		const cols = conf.columns
			.map((c) => {
				if (!is(c, Column)) {
					throw new Error(
						`schema-sync: index ${conf.name} uses an expression — only plain column references are supported in schema.ts`,
					);
				}
				return quoteIdent(c.name);
			})
			.join(", ");
		const unique = conf.unique ? "UNIQUE " : "";
		return {
			name: conf.name,
			sql: `CREATE ${unique}INDEX IF NOT EXISTS ${quoteIdent(conf.name)} ON ${quoteIdent(cfg.name)} (${cols})`,
		};
	});
}

/** Canonical DDL of the drizzle schema — the basis for the fingerprint. */
function schemaDdl(): string {
	return Object.values(schema)
		.map((table) => {
			const parts = [createTableSql(table)];
			for (const { sql } of createIndexSqls(table)) parts.push(sql);
			return parts.join(";\n");
		})
		.join(";\n");
}

/** Stable 31-bit FNV-1a fingerprint of the computed schema DDL. */
function schemaFingerprint(): number {
	const ddl = schemaDdl();
	let hash = 0x811c9dc5;
	for (let i = 0; i < ddl.length; i++) {
		hash ^= ddl.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash & 0x7fffffff;
}

function existingTableNames(raw: Database): Set<string> {
	const rows = raw
		.query("SELECT name FROM sqlite_master WHERE type = 'table';")
		.all() as { name: string }[];
	return new Set(rows.map((r) => r.name));
}

function existingIndexNames(raw: Database): Set<string> {
	const rows = raw
		.query(
			"SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex%';",
		)
		.all() as { name: string }[];
	return new Set(rows.map((r) => r.name));
}

function existingColumnNames(raw: Database, table: string): Set<string> {
	const rows = raw.query(`PRAGMA table_info(${quoteIdent(table)});`).all() as {
		name: string;
	}[];
	return new Set(rows.map((r) => r.name));
}

function addColumnSql(table: string, col: SQLiteColumn): string {
	if (col.notNull && col.default === undefined) {
		throw new Error(
			`schema-sync: cannot ADD COLUMN ${quoteIdent(col.name)} to ${quoteIdent(table)} — NOT NULL requires a static default in schema.ts (SQLite limitation)`,
		);
	}
	return `ALTER TABLE ${quoteIdent(table)} ADD COLUMN ${columnSql(col)}`;
}

/**
 * Compute the statements needed to converge state.db to `schema.ts` and apply
 * them in one transaction. Idempotent: a converged database yields no writes.
 */
export function syncSchema(raw: Database): SchemaSyncResult {
	const result: SchemaSyncResult = {
		addedColumns: [],
		createdIndexes: [],
		createdTables: [],
	};
	const tables = existingTableNames(raw);
	const indexes = existingIndexNames(raw);

	raw.exec("BEGIN");
	try {
		for (const table of Object.values(schema)) {
			const cfg = getTableConfig(table);
			if (!tables.has(cfg.name)) {
				raw.exec(createTableSql(table));
				result.createdTables.push(cfg.name);
			} else {
				const columns = existingColumnNames(raw, cfg.name);
				for (const col of cfg.columns) {
					if (!columns.has(col.name)) {
						raw.exec(addColumnSql(cfg.name, col));
						result.addedColumns.push(`${cfg.name}.${col.name}`);
					}
				}
			}
			for (const { name, sql } of createIndexSqls(table)) {
				if (!indexes.has(name)) {
					raw.exec(sql);
					result.createdIndexes.push(name);
				}
			}
		}
		raw.exec("COMMIT");
	} catch (e) {
		raw.exec("ROLLBACK");
		throw e;
	}
	return result;
}

/** Stamp `PRAGMA user_version` with the current schema fingerprint. */
export function stampSchemaVersion(raw: Database): void {
	raw.exec(`PRAGMA user_version = ${schemaFingerprint()};`);
}

/** Current schema fingerprint (what `PRAGMA user_version` gets stamped with). */
export function currentSchemaVersion(): number {
	return schemaFingerprint();
}
