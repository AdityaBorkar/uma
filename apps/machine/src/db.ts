import {
	and,
	asc,
	count,
	desc,
	eq,
	gte,
	inArray,
	lt,
	lte,
	max,
	sql,
} from "drizzle-orm";
import ms from "ms";

import {
	type Db,
	type DbTx,
	type DrizzleDb,
	latestMigrationVersion,
	migrate,
	openDb,
	withDb,
} from "./db/client.ts";
import {
	configReceipts,
	heartbeats,
	logBuffer,
	providerKeys,
	sandboxEvents,
} from "./db/schema.ts";

export {
	type Db,
	type DbTx,
	type DrizzleDb,
	latestMigrationVersion,
	migrate,
	openDb,
	withDb,
};

export interface HeartbeatSample {
	cpu: number;
	disk: number;
	ram: number;
	ts: number;
}

export interface ReceiptRow {
	error: string | null;
	job_id: string;
	key: string;
	ok: number;
	ts: number;
}

export interface ReceiptInput {
	error?: string;
	key: string;
	ok: boolean;
}

/** Persist per-key receipts atomically-ish (single open, single timestamp). */
export function persistReceipts(
	dbPath: string,
	jobId: string,
	receipts: ReceiptInput[],
	ts = Date.now(),
): void {
	withDb(dbPath, false, (db) => {
		db.transaction((tx) => {
			for (const r of receipts) {
				insertReceipt(tx, {
					error: r.error,
					jobId,
					key: r.key,
					ok: r.ok,
					ts,
				});
			}
		});
	});
}

/** Best-effort receipt persist that never masks converge results. */
export function persistReceiptsBestEffort(
	dbPath: string,
	jobId: string,
	receipts: ReceiptInput[],
): void {
	try {
		persistReceipts(dbPath, jobId, receipts);
	} catch (e) {
		console.error(
			`warn: receipts not persisted: ${e instanceof Error ? e.message : String(e)}`,
		);
	}
}

/** One sandbox lifecycle event row. */
export interface SandboxEventInput {
	detail?: string;
	event: string;
	sandboxId: string;
	taskId?: string | null;
	ts?: number;
}

/** Record one sandbox lifecycle event (best-effort open/close in one place). */
export function recordSandboxEvent(
	dbPath: string,
	ev: SandboxEventInput,
): void {
	withDb(dbPath, false, (db) => {
		insertSandboxEvent(db, {
			detail: ev.detail,
			event: ev.event,
			sandboxId: ev.sandboxId,
			taskId: ev.taskId,
			ts: ev.ts ?? Date.now(),
		});
	});
}

/** Best-effort event record that never masks the caller's outcome. */
export function recordSandboxEventBestEffort(
	dbPath: string,
	ev: SandboxEventInput,
): void {
	try {
		recordSandboxEvent(dbPath, ev);
	} catch {
		// event loss is non-fatal
	}
}

/** Load stored provider keys; returns [] when DB is missing/unreadable. */
export function readProviderKeys(dbPath: string): {
	provider: string;
	fingerprint: string;
	secret: string;
	updated_at: number;
}[] {
	try {
		return withDb(dbPath, true, (db) => getProviderKeys(db));
	} catch {
		return [];
	}
}

export interface HeartbeatInsert {
	configVersion: string;
	cpu: number;
	disk: number;
	pids: number[];
	quotaUsage: unknown;
	ram: number;
	sandboxes: unknown[];
	ts: number;
}

export function insertHeartbeat(db: DbTx, h: HeartbeatInsert): void {
	db.insert(heartbeats)
		.values({
			configVersion: h.configVersion,
			cpu: h.cpu,
			disk: h.disk,
			pids: JSON.stringify(h.pids),
			quotaUsage: JSON.stringify(h.quotaUsage),
			ram: h.ram,
			sandboxes: JSON.stringify(h.sandboxes),
			ts: h.ts,
		})
		.onConflictDoUpdate({
			set: {
				configVersion: h.configVersion,
				cpu: h.cpu,
				disk: h.disk,
				pids: JSON.stringify(h.pids),
				quotaUsage: JSON.stringify(h.quotaUsage),
				ram: h.ram,
				sandboxes: JSON.stringify(h.sandboxes),
			},
			target: heartbeats.ts,
		})
		.run();
}

export function queryHistory(
	db: DbTx,
	sinceTs: number,
	// 30d @30s ticks ≈ 86k rows max; keep the full raw window queryable.
	limit = 100000,
): HeartbeatSample[] {
	// Project scalars only: the raw pids/sandboxes/quota_usage blobs are
	// write-side telemetry and must not be hauled into every history query.
	return db
		.select({
			cpu: heartbeats.cpu,
			disk: heartbeats.disk,
			ram: heartbeats.ram,
			ts: heartbeats.ts,
		})
		.from(heartbeats)
		.where(gte(heartbeats.ts, sinceTs))
		.orderBy(asc(heartbeats.ts))
		.limit(limit)
		.all();
}

export function countHeartbeats(db: Db): number {
	const rows = db.select({ c: count() }).from(heartbeats).all();
	return Number(rows[0]?.c ?? 0);
}

/** Delete heartbeats older than retentionDays; VACUUMs only when rows were
 * actually deleted (steady state = one cheap indexed DELETE per tick, one
 * VACUUM per day at the retention boundary). Returns deleted count. */
export function vacuumRetention(
	db: Db,
	retentionDays: number,
	nowMs = Date.now(),
): number {
	const cutoff = nowMs - retentionDays * ms("1d");
	const res = db
		.delete(heartbeats)
		.where(lt(heartbeats.ts, cutoff))
		.run() as unknown as {
		changes?: number;
	};
	const deleted = Number(res.changes ?? 0);
	if (deleted > 0) {
		try {
			(db.$client as unknown as { exec: (sql: string) => void }).exec(
				"VACUUM;",
			);
		} catch {
			// VACUUM may fail under WAL concurrency; retention delete already applied.
		}
	}
	return deleted;
}

/** Retention for auxiliary tables (not covered by the 30d heartbeat rule):
 * sandbox_events + config_receipts 90d, undrained log_buffer 7d. */
export function pruneAuxTables(db: DbTx, nowMs = Date.now()): void {
	try {
		db.delete(sandboxEvents)
			.where(lt(sandboxEvents.ts, nowMs - ms("90d")))
			.run();
		db.delete(configReceipts)
			.where(lt(configReceipts.ts, nowMs - ms("90d")))
			.run();
		db.delete(logBuffer)
			.where(lt(logBuffer.ts, nowMs - ms("7d")))
			.run();
	} catch {
		// best-effort; never fail the heartbeat tick
	}
}

/** Latest sandbox_events.ts for a sandbox (drives TTL reap age); null if unknown. */
export function lastSandboxEventTs(db: DbTx, sandboxId: string): number | null {
	try {
		const rows = db
			.select({ ts: sandboxEvents.ts })
			.from(sandboxEvents)
			.where(eq(sandboxEvents.sandboxId, sandboxId))
			.orderBy(desc(sandboxEvents.ts))
			.limit(1)
			.all();
		return rows[0]?.ts ?? null;
	} catch {
		return null;
	}
}

/** Latest sandbox_events.ts per sandbox in one query (drives TTL reap age). */
export function lastSandboxEventTsBatch(
	db: DbTx,
	sandboxIds: string[],
): Map<string, number> {
	if (sandboxIds.length === 0) return new Map();
	try {
		const rows = db
			.select({ id: sandboxEvents.sandboxId, ts: max(sandboxEvents.ts) })
			.from(sandboxEvents)
			.where(inArray(sandboxEvents.sandboxId, sandboxIds))
			.groupBy(sandboxEvents.sandboxId)
			.all();
		return new Map(rows.map((r) => [r.id, Number(r.ts)]));
	} catch {
		return new Map();
	}
}

export function insertSandboxEvent(
	db: DbTx,
	ev: {
		ts: number;
		sandboxId: string;
		event: string;
		taskId?: string | null;
		detail?: string;
	},
): void {
	db.insert(sandboxEvents)
		.values({
			detail: ev.detail ?? null,
			event: ev.event,
			sandboxId: ev.sandboxId,
			taskId: ev.taskId ?? null,
			ts: ev.ts,
		})
		.run();
}

export function insertReceipt(
	db: DbTx,
	r: { ts: number; jobId: string; key: string; ok: boolean; error?: string },
): void {
	db.insert(configReceipts)
		.values({
			error: r.error ?? null,
			jobId: r.jobId,
			key: r.key,
			ok: r.ok ? 1 : 0,
			ts: r.ts,
		})
		.run();
}

export function latestReceipts(db: DbTx, limit = 50): ReceiptRow[] {
	const rows = db
		.select()
		.from(configReceipts)
		.orderBy(desc(configReceipts.ts))
		.limit(limit)
		.all();
	return rows.map((r) => ({
		error: r.error ?? null,
		job_id: r.jobId,
		key: r.key,
		ok: r.ok,
		ts: r.ts,
	}));
}

export function setProviderKey(
	db: DbTx,
	provider: string,
	fingerprintHex: string,
	secret: string,
	updatedAt = Date.now(),
): void {
	db.insert(providerKeys)
		.values({
			fingerprint: fingerprintHex,
			provider,
			secret,
			updatedAt,
		})
		.onConflictDoUpdate({
			set: {
				fingerprint: fingerprintHex,
				secret,
				updatedAt,
			},
			target: providerKeys.provider,
		})
		.run();
}

export function getProviderKeys(db: Db): {
	provider: string;
	fingerprint: string;
	secret: string;
	updated_at: number;
}[] {
	const rows = db.select().from(providerKeys).all();
	return rows.map((r) => ({
		fingerprint: r.fingerprint,
		provider: r.provider,
		secret: r.secret,
		updated_at: r.updatedAt,
	}));
}

export function getProviderSecret(db: DbTx, provider: string): string | null {
	const rows = db
		.select({ secret: providerKeys.secret })
		.from(providerKeys)
		.where(eq(providerKeys.provider, provider))
		.limit(1)
		.all();
	return rows[0]?.secret ?? null;
}

export function bufferLog(
	db: DbTx,
	taskId: string,
	chunk: string,
	ts = Date.now(),
): void {
	db.insert(logBuffer).values({ chunk, taskId, ts }).run();
}

/** Peek buffered rows for a task (rowid-ordered) without deleting them. */
export function peekLogBuffer(
	db: DbTx,
	taskId: string,
	limit = 200,
): { rowid: number; ts: number; chunk: string }[] {
	return db
		.select({
			chunk: logBuffer.chunk,
			rowid: sql<number>`rowid`,
			ts: logBuffer.ts,
		})
		.from(logBuffer)
		.where(eq(logBuffer.taskId, taskId))
		.orderBy(asc(sql`rowid`))
		.limit(limit)
		.all();
}

/** Delete already-sent rows up to and including `throughRowid` (at-least-once). */
export function deleteLogBufferThrough(
	db: DbTx,
	taskId: string,
	throughRowid: number,
): void {
	db.delete(logBuffer)
		.where(and(eq(logBuffer.taskId, taskId), lte(sql`rowid`, throughRowid)))
		.run();
}

export function drainLogBuffer(
	db: DbTx,
	taskId: string,
	limit = 200,
): { ts: number; chunk: string }[] {
	// rowid cursor: monotonic and collision-free under same-millisecond
	// inserts (deleting by ts <= last.ts could drop rows never read).
	const rows = peekLogBuffer(db, taskId, limit);
	const last = rows[rows.length - 1];
	if (last) deleteLogBufferThrough(db, taskId, last.rowid);
	return rows.map(({ chunk, ts }) => ({ chunk, ts }));
}

export function bufferedLogCount(db: DbTx, taskId?: string): number {
	if (taskId) {
		const rows = db
			.select({ c: count() })
			.from(logBuffer)
			.where(eq(logBuffer.taskId, taskId))
			.all();
		return Number(rows[0]?.c ?? 0);
	}
	const rows = db.select({ c: count() }).from(logBuffer).all();
	return Number(rows[0]?.c ?? 0);
}
