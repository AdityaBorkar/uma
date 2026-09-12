import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import type { SandboxInfo } from "@uma/orpc-contract";
import { nanoid } from "nanoid";
import writeFileAtomic from "write-file-atomic";

import { dataDir } from "../../utils/env.ts";
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

export interface MockDriverPaths {
	/** Directory for mock-sandboxes.json + mock-home; defaults to dataDir(). */
	data?: string;
	/** msb-root-meta directory (per-sandbox meta.json contract); defaults under `data`. */
	root?: string;
}

interface MockRecord {
	createdAt: number;
	id: string;
	name: string;
	projectId: string | null;
	status: SandboxInfo["status"];
	taskId: string | null;
}

/**
 * File-backed mock driver (tests/dev only — `useMock()` must gate selection).
 * Paths are constructor-injectable so tests can isolate state in temp dirs;
 * the default mirrors the real `msb` layout under the XDG data dir.
 */
export class MsbMockDriver implements SandboxDriver {
	readonly kind = "mock" as const;

	constructor(private readonly paths: MockDriverPaths = {}) {}

	// Paths resolve lazily (not pinned at construction): the shared default
	// selector constructs one instance, and env-driven roots (UMA_DATA_HOME in
	// tests) must be re-read per operation.
	private get dataPath(): string {
		return this.paths.data ?? dataDir();
	}

	private get rootPath(): string {
		return this.paths.root ?? join(this.dataPath, "msb-root-meta");
	}

	private dbPath(): string {
		return join(this.dataPath, "mock-sandboxes.json");
	}

	private load(): Map<string, MockRecord> {
		const p = this.dbPath();
		if (!existsSync(p)) return new Map();
		try {
			const arr = JSON.parse(readFileSync(p, "utf8")) as MockRecord[];
			return new Map(arr.map((r) => [r.name, r]));
		} catch {
			return new Map();
		}
	}

	private save(m: Map<string, MockRecord>, touched?: string[]): void {
		mkdirSync(this.dataPath, { recursive: true });
		writeFileAtomic.sync(
			this.dbPath(),
			JSON.stringify([...m.values()], null, 2),
		);
		// per-sandbox meta dir (mirrors msb-root-meta/<name>/meta.json contract).
		// Only touched records are rewritten (previously every meta.json per flip).
		const names = touched ?? [...m.keys()];
		for (const name of names) {
			const r = m.get(name);
			if (!r) continue;
			const dir = join(this.rootPath, name);
			mkdirSync(dir, { recursive: true });
			writeFileAtomic.sync(join(dir, "meta.json"), JSON.stringify(r, null, 2));
		}
	}

	private home(): string {
		const dir = join(this.dataPath, "mock-home");
		mkdirSync(dir, { recursive: true });
		return dir;
	}

	/** Mock exec: run on host via Bun.spawn (real path is SDK exec). HOME is
	 * redirected so sandbox-relative paths (~/work) never touch the real home. */
	private async execHost(cmd: string, args: string[]): Promise<ExecResult> {
		const proc = Bun.spawn([cmd, ...args], {
			env: { ...process.env, HOME: this.home() },
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

	async create(opts: CreateOpts): Promise<{ id: string; name: string }> {
		const db = this.load();
		if (db.has(opts.name))
			throw new Error(`sandbox ${opts.name} already exists`);
		const rec: MockRecord = {
			createdAt: Date.now(),
			id: `mock-${Date.now().toString(36)}-${nanoid(6)}`,
			name: opts.name,
			projectId: opts.projectId,
			status: "created",
			taskId: opts.taskId,
		};
		db.set(opts.name, rec);
		this.save(db, [opts.name]);
		return { id: rec.id, name: rec.name };
	}

	async exec(_name: string, cmd: string, args: string[]): Promise<ExecResult> {
		return this.execHost(cmd, args);
	}

	async execStream(
		_name: string,
		cmd: string,
		args: string[],
		onEvent: (stream: "stdout" | "stderr" | "system", data: string) => void,
	): Promise<number> {
		const r = await this.execHost(cmd, args);
		if (r.stdout) onEvent("stdout", r.stdout);
		if (r.stderr) onEvent("stderr", r.stderr);
		return r.code;
	}

	async list(): Promise<SandboxInfo[]> {
		const db = this.load();
		return [...db.values()].map((r) => ({
			id: r.name,
			projectId: r.projectId,
			status: r.status,
			taskId: r.taskId,
		}));
	}

	async metrics(): Promise<SandboxMetrics[]> {
		return [];
	}

	async remove(name: string): Promise<void> {
		const db = this.load();
		if (!db.has(name)) return;
		// Reap = rm --force: stop if running then destroy.
		db.delete(name);
		this.save(db, []);
		try {
			rmSync(join(this.rootPath, name), { force: true, recursive: true });
		} catch {
			// ignore
		}
	}

	async start(name: string): Promise<void> {
		const db = this.load();
		const r = db.get(name);
		if (!r) throw new Error(`sandbox ${name} not found`);
		r.status = "running";
		this.save(db, [name]);
	}

	async stop(name: string): Promise<void> {
		const db = this.load();
		const r = db.get(name);
		if (!r) return;
		r.status = "stopped";
		this.save(db, [name]);
	}
}
