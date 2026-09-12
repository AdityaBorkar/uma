import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import type { SandboxInfo } from "@uma/orpc-contract";
import { nanoid } from "nanoid";
import writeFileAtomic from "write-file-atomic";

import { dataDir } from "../../env.ts";
import type {
	CreateOpts,
	ExecResult,
	SandboxDriver,
	SandboxMetrics,
} from "./types.ts";

export function useMock(): boolean {
	if (process.env.MSB_MOCK === "1") return true;
	if (process.env.UMA_MSB_MOCK === "1") return true;
	return false;
}

function mockRoot(): string {
	return join(dataDir(), "msb-root-meta");
}

function mockDbPath(): string {
	return join(dataDir(), "mock-sandboxes.json");
}

interface MockRecord {
	createdAt: number;
	id: string;
	name: string;
	projectId: string | null;
	status: SandboxInfo["status"];
	taskId: string | null;
}

function loadMock(): Map<string, MockRecord> {
	const p = mockDbPath();
	if (!existsSync(p)) return new Map();
	try {
		const arr = JSON.parse(readFileSync(p, "utf8")) as MockRecord[];
		return new Map(arr.map((r) => [r.name, r]));
	} catch {
		return new Map();
	}
}

function saveMock(m: Map<string, MockRecord>, touched?: string[]): void {
	mkdirSync(dataDir(), { recursive: true });
	writeFileAtomic.sync(mockDbPath(), JSON.stringify([...m.values()], null, 2));
	// per-sandbox meta dir (mirrors msb-root-meta/<name>/meta.json contract).
	// Only touched records are rewritten (previously every meta.json per flip).
	const names = touched ?? [...m.keys()];
	for (const name of names) {
		const r = m.get(name);
		if (!r) continue;
		const dir = join(mockRoot(), name);
		mkdirSync(dir, { recursive: true });
		writeFileAtomic.sync(join(dir, "meta.json"), JSON.stringify(r, null, 2));
	}
}

function mockCreate(opts: CreateOpts): { name: string; id: string } {
	const db = loadMock();
	if (db.has(opts.name)) throw new Error(`sandbox ${opts.name} already exists`);
	const rec: MockRecord = {
		createdAt: Date.now(),
		id: `mock-${Date.now().toString(36)}-${nanoid(6)}`,
		name: opts.name,
		projectId: opts.projectId,
		status: "created",
		taskId: opts.taskId,
	};
	db.set(opts.name, rec);
	saveMock(db, [opts.name]);
	return { id: rec.id, name: rec.name };
}

function mockStart(name: string): void {
	const db = loadMock();
	const r = db.get(name);
	if (!r) throw new Error(`sandbox ${name} not found`);
	r.status = "running";
	saveMock(db, [name]);
}

function mockStop(name: string): void {
	const db = loadMock();
	const r = db.get(name);
	if (!r) return;
	r.status = "stopped";
	saveMock(db, [name]);
}

function mockRemove(name: string): void {
	const db = loadMock();
	if (!db.has(name)) return;
	// Reap = rm --force: stop if running then destroy.
	db.delete(name);
	saveMock(db, []);
	try {
		rmSync(join(mockRoot(), name), { force: true, recursive: true });
	} catch {
		// ignore
	}
}

function mockList(): SandboxInfo[] {
	const db = loadMock();
	return [...db.values()].map((r) => ({
		id: r.name,
		projectId: r.projectId,
		status: r.status,
		taskId: r.taskId,
	}));
}

function mockHome(): string {
	const dir = join(dataDir(), "mock-home");
	mkdirSync(dir, { recursive: true });
	return dir;
}

async function mockExec(cmd: string, args: string[]): Promise<ExecResult> {
	// Mock: run on host via Bun.spawn (test/dev only; real path is SDK exec).
	// HOME is redirected into the data dir so sandbox-relative paths (~/work)
	// never touch the user's real home.
	const proc = Bun.spawn([cmd, ...args], {
		env: { ...process.env, HOME: mockHome() },
		stderr: "pipe",
		stdout: "pipe",
	});
	const [so, se, code] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { code, stderr: se, stdout: so };
}

export const mockDriver: SandboxDriver = {
	create: async (opts) => mockCreate(opts),
	exec: (_name, cmd, args) => mockExec(cmd, args),
	execStream: async (_name, cmd, args, onEvent) => {
		const r = await mockExec(cmd, args);
		if (r.stdout) onEvent("stdout", r.stdout);
		if (r.stderr) onEvent("stderr", r.stderr);
		return r.code;
	},
	kind: "mock",
	list: async () => mockList(),
	metrics: async (): Promise<SandboxMetrics[]> => [],
	remove: async (name) => mockRemove(name),
	start: async (name) => mockStart(name),
	stop: async (name) => mockStop(name),
};
