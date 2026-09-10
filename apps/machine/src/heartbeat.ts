import { readFile } from "node:fs/promises";

import {
	type HeartbeatFrame,
	type HostMetrics,
	PRESSURE_ATTRIBUTION_PCT,
	PRESSURE_THRESHOLD_PCT,
	type QuotaUsage,
	type SandboxInfo,
} from "@uma/orpc-contract";
import { maxBy, uniq } from "es-toolkit/array";
import ms from "ms";

import {
	insertHeartbeat,
	pruneAuxTables,
	queryHistory,
	vacuumRetention,
	withDb,
} from "./db.ts";
import { loadIdentity } from "./enroll.ts";
import { heartbeatRetentionDays, stateDbPath } from "./env.ts";
import { runCapture } from "./proc.ts";
import { listSandboxes, sandboxMetricsForPressure } from "./sandbox.ts";
import { CLI_VERSION, CONFIG_VERSION } from "./version.ts";

// ---------------------------------------------------------------------------
// Host collectors (Linux-first: /proc + statvfs)
// ---------------------------------------------------------------------------

export async function collectCpu(): Promise<number> {
	try {
		const a = await readFile("/proc/stat", "utf8");
		const idle1 = parseCpu(a);
		await new Promise((r) => setTimeout(r, 200));
		const b = await readFile("/proc/stat", "utf8");
		const idle2 = parseCpu(b);
		if (!idle1 || !idle2) return 0;
		const totalDelta = idle2.total - idle1.total;
		const idleDelta = idle2.idle - idle1.idle;
		if (totalDelta <= 0) return 0;
		return Math.min(100, Math.max(0, (1 - idleDelta / totalDelta) * 100));
	} catch {
		return 0;
	}
}

function parseCpu(stat: string): { idle: number; total: number } | null {
	const line = stat.split("\n").find((l) => l.startsWith("cpu "));
	if (!line) return null;
	const parts = line.trim().split(/\s+/).slice(1).map(Number);
	if (parts.length < 4) return null;
	const idle = (parts[3] ?? 0) + (parts[4] ?? 0);
	const total = parts.reduce((a, b) => a + b, 0);
	return { idle, total };
}

export async function collectRam(): Promise<number> {
	try {
		const meminfo = await readFile("/proc/meminfo", "utf8");
		const total = meminfo.match(/MemTotal:\s+(\d+)/)?.[1];
		const avail = meminfo.match(/MemAvailable:\s+(\d+)/)?.[1];
		if (total && avail) {
			const t = parseInt(total, 10);
			const a = parseInt(avail, 10);
			return Math.min(100, Math.max(0, ((t - a) / t) * 100));
		}
	} catch {
		// ignore
	}
	return 0;
}

export function collectDisk(path = "/"): Promise<number> {
	return (async () => {
		// Canonical process runner (same as msb/which probes).
		const r = await runCapture("df", ["-k", path], 8000);
		if (!r) return 0;
		const row = r.stdout.trim().split("\n")[1] ?? "";
		const parts = row.trim().split(/\s+/);
		// df -k: Filesystem 1K-blocks Used Available Use% Mounted
		const v = parseInt((parts[4] ?? "").replace("%", ""), 10);
		return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0;
	})();
}

export function collectPids(allowlist: number[]): number[] {
	// pids = allowlisted agent + sandbox PIDs only, never full ps.
	return uniq(allowlist.filter((p) => Number.isInteger(p) && p > 0)).slice(
		0,
		256,
	);
}

export async function collectHostMetrics(
	extraPids: number[] = [],
): Promise<HostMetrics> {
	const [cpu, ram, disk] = await Promise.all([
		collectCpu(),
		collectRam(),
		collectDisk("/"),
	]);
	const pids = collectPids([process.pid, ...extraPids]);
	return { cpu, disk, pids, ram };
}

// ---------------------------------------------------------------------------
// Sandbox metrics via SDK (host + msb); degrades gracefully when runtime absent
// ---------------------------------------------------------------------------

export async function collectSandboxInfos(): Promise<SandboxInfo[]> {
	try {
		return await listSandboxes();
	} catch {
		return [];
	}
}

export function evaluateScopeHint(
	hostCpu: number,
	hostDisk: number,
	sandboxMetrics: {
		id: string;
		projectId: string | null;
		cpu: number;
		disk: number;
	}[],
): { breached: boolean; scopeHint: string | null } {
	const breached =
		hostCpu > PRESSURE_THRESHOLD_PCT || hostDisk > PRESSURE_THRESHOLD_PCT;
	if (!breached) return { breached: false, scopeHint: null };
	// Attribution: one sandbox >60% of host usage (cpu OR disk) => scoped
	// hint, else host-global (null). Pure: no retained window — the server
	// applies the sustain gate + per-scope cooldown. Linear max (no alloc).
	const top = maxBy(sandboxMetrics, (m) => m.cpu + m.disk);
	if (
		top &&
		(top.cpu > (hostCpu * PRESSURE_ATTRIBUTION_PCT) / 100 ||
			top.disk > (hostDisk * PRESSURE_ATTRIBUTION_PCT) / 100)
	) {
		return { breached: true, scopeHint: top.projectId };
	}
	return { breached: true, scopeHint: null };
}

// ---------------------------------------------------------------------------
// Heartbeat frame builder + persist-then-send + history query
// ---------------------------------------------------------------------------

export async function buildHeartbeat(
	quotaUsage: QuotaUsage,
	scopeHint: string | null = null,
): Promise<HeartbeatFrame> {
	const identity = loadIdentity();
	if (!identity) throw new Error("not enrolled (missing identity.json)");
	// Host metrics and sandbox listing are independent collectors.
	const [metrics, sandboxes] = await Promise.all([
		collectHostMetrics(),
		collectSandboxInfos(),
	]);
	// scopeHint heuristic: evaluate both per-sandbox + host-global pressure.
	let hint: string | null = scopeHint;
	if (
		hint === null &&
		(metrics.cpu > PRESSURE_THRESHOLD_PCT ||
			metrics.disk > PRESSURE_THRESHOLD_PCT)
	) {
		try {
			const per = await sandboxMetricsForPressure();
			hint = evaluateScopeHint(metrics.cpu, metrics.disk, per).scopeHint;
		} catch {
			hint = null;
		}
	}
	return {
		cliVersion: CLI_VERSION,
		configVersion: CONFIG_VERSION,
		machineId: identity.machineId,
		metrics,
		protocol: "v1",
		quotaUsage,
		sandboxes,
		scopeHint: hint,
		t: "heartbeat",
	};
}

export function persistHeartbeat(frame: HeartbeatFrame, ts = Date.now()): void {
	withDb(stateDbPath(), false, (db) => {
		insertHeartbeat(db, {
			configVersion: frame.configVersion,
			cpu: frame.metrics.cpu,
			disk: frame.metrics.disk,
			pids: frame.metrics.pids,
			quotaUsage: frame.quotaUsage,
			ram: frame.metrics.ram,
			sandboxes: frame.sandboxes,
			ts,
		});
		// Retention: 30d raw heartbeats (VACUUM only on actual deletes) + aux prune.
		vacuumRetention(db, heartbeatRetentionDays(), ts);
		pruneAuxTables(db, ts);
	});
}

export function readHistory(
	range: "24h" | "30d" | string,
	limit?: number,
): {
	ts: number;
	cpu: number;
	ram: number;
	disk: number;
}[] {
	const windowMs =
		(ms(range as ms.StringValue) as unknown as number | undefined) ??
		(range === "24h" ? ms("24h") : ms("30d"));
	const since = Date.now() - windowMs;
	try {
		return withDb(stateDbPath(), true, (db) => {
			return queryHistory(db, since, limit ?? 100000);
		});
	} catch {
		return []; // fresh machine, nothing recorded yet
	}
}
