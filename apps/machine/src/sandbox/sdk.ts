import {
	type SandboxInfo,
	TASK_CPUS,
	TASK_MAX_CPUS,
	TASK_MAX_MEMORY_MB,
	TASK_MEMORY_MB,
	UBUNTU_IMAGE,
} from "../../orpc-contract/src/index.ts";
import {
	isNotFoundError,
	mapStatus,
	projectIdFromLabels,
	taskIdFromLabels,
} from "./shared.ts";
import type {
	CreateOpts,
	ExecResult,
	SandboxDriver,
	SandboxMetrics,
} from "./types.ts";

type Sdk = typeof import("microsandbox");

async function sdkCreate(
	sdk: Sdk,
	opts: CreateOpts,
): Promise<{ name: string; id: string }> {
	// Pinned Ubuntu, fixed 1c/1G (+2x max headroom), labels for attribution.
	const builder = sdk.Sandbox.builder(opts.name)
		.image(UBUNTU_IMAGE)
		.cpus(TASK_CPUS)
		.memory(TASK_MEMORY_MB as never)
		.maxCpus(TASK_MAX_CPUS)
		.maxMemory(TASK_MAX_MEMORY_MB as never)
		.label("task.id", opts.taskId)
		.label("project.id", opts.projectId ?? "global");
	// Secrets via secretEnv refs (value in-process only, never argv/config).
	for (const s of opts.secrets ?? []) {
		if (s.hosts.length === 0) continue;
		builder.secretEnv(s.guestVar, s.value, s.hosts[0] as string);
	}
	const sb = await builder.create();
	return { id: (sb as { id?: string }).id ?? sb.name, name: sb.name };
}

async function sdkStop(sdk: Sdk, name: string, force: boolean): Promise<void> {
	const handle = await sdk.Sandbox.get(name);
	// Cancel = Stop(--force): grace 10s default, force => immediate.
	if (force) await handle.stopWithTimeout(0);
	else await handle.stop();
}

async function sdkRemove(sdk: Sdk, name: string): Promise<void> {
	try {
		const handle = await sdk.Sandbox.get(name);
		try {
			await handle.stopWithTimeout(0);
		} catch {
			// already stopped
		}
		await handle.remove();
	} catch (e) {
		// SandboxNotFound => idempotent success.
		if (isNotFoundError(e)) return;
		throw e;
	}
}

async function sdkList(sdk: Sdk): Promise<SandboxInfo[]> {
	const page = await sdk.Sandbox.list();
	const out: SandboxInfo[] = [];
	for (const h of page.sandboxes) {
		let labels: Record<string, string> = {};
		try {
			labels = (h.config() as { labels?: Record<string, string> }).labels ?? {};
		} catch {
			labels = {};
		}
		out.push({
			id: h.name,
			projectId: projectIdFromLabels(labels, null),
			status: mapStatus(String(h.status)),
			taskId: taskIdFromLabels(labels, null),
		});
	}
	return out;
}

async function sdkExec(
	sdk: Sdk,
	name: string,
	cmd: string,
	args: string[],
): Promise<ExecResult> {
	const handle = await sdk.Sandbox.get(name);
	const sb = await handle.connectOrStart({});
	const out = await sb.exec(cmd, args);
	return { code: out.code, stderr: out.stderr(), stdout: out.stdout() };
}

async function sdkExecStream(
	sdk: Sdk,
	name: string,
	cmd: string,
	args: string[],
	onEvent: (stream: "stdout" | "stderr" | "system", data: string) => void,
): Promise<number> {
	const handle = await sdk.Sandbox.get(name);
	const sb = await handle.connectOrStart({});
	const stream = await sb.execStream(cmd, args);
	let code = 0;
	for await (const ev of stream) {
		const e = ev as unknown as Record<string, unknown>;
		const evKind = String(e.type ?? e.kind ?? "").toLowerCase();
		if (evKind.includes("stdout") && typeof e.data === "string")
			onEvent("stdout", e.data);
		else if (evKind.includes("stderr") && typeof e.data === "string")
			onEvent("stderr", e.data);
		else if (typeof e.data === "string" && e.data) onEvent("system", e.data);
		if (typeof e.exitCode === "number") code = e.exitCode;
		if (typeof e.code === "number") code = e.code;
	}
	try {
		const status = await stream.wait();
		const c = (status as { code?: number }).code;
		if (typeof c === "number") code = c;
	} catch {
		// ignore
	}
	return code;
}

async function sdkMetrics(sdk: Sdk): Promise<SandboxMetrics[]> {
	try {
		const all = await sdk.allSandboxMetrics();
		// Shape: unknown[] of { name, metrics } — normalize defensively.
		const arr = Array.isArray(all) ? all : [];
		// Attribution: SDK metrics carry no labels, so join with the sandbox
		// list (task.id / project.id labels) to resolve projectId per sandbox.
		const projectById = new Map<string, string | null>();
		try {
			for (const i of await sdkList(sdk)) projectById.set(i.id, i.projectId);
		} catch {
			// list failed — fall back to global (null) attribution
		}
		return arr.map((e) => {
			const r = e as Record<string, unknown>;
			const metrics = (r.metrics ?? r) as Record<string, unknown>;
			const id = String(r.name ?? r.sandbox ?? "unknown");
			return {
				cpu: Number(metrics.cpu ?? metrics.cpuPercent ?? 0) || 0,
				disk: Number(metrics.disk ?? metrics.diskPercent ?? 0) || 0,
				id,
				projectId: projectById.get(id) ?? null,
			};
		});
	} catch {
		return [];
	}
}

export function sdkDriver(sdk: Sdk): SandboxDriver {
	return {
		create: async (opts) => sdkCreate(sdk, opts),
		exec: (name, cmd, args) => sdkExec(sdk, name, cmd, args),
		execStream: (name, cmd, args, onEvent) =>
			sdkExecStream(sdk, name, cmd, args, onEvent),
		kind: "sdk",
		list: async () => sdkList(sdk),
		metrics: async () => sdkMetrics(sdk),
		remove: async (name) => sdkRemove(sdk, name),
		start: async (name) => {
			const handle = await sdk.Sandbox.get(name);
			await handle.start();
		},
		stop: async (name, force) => sdkStop(sdk, name, force),
	};
}
