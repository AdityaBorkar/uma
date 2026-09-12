#!/usr/bin/env bun
import Table from "cli-table3";
import pc from "picocolors";

import { type CliOptions, parseCli } from "./cli.ts";
import { checkAll, resetAll } from "./config/mod.ts";
import { performSync, syncExitCode } from "./config/sync.ts";
import { Daemon } from "./daemon/daemon.ts";
import { Heartbeat } from "./daemon/heartbeat.ts";
import { enroll } from "./enrollment/enroll.ts";
import { ExecutionEngine } from "./execution/execution.ts";
import { RepoBinding } from "./execution/git-binding.ts";
import { Redactor } from "./execution/redact.ts";
import { Sandbox } from "./sandboxes/sandbox.ts";
import {
	daemonIntervalS,
	parseOnlyFlag,
	parsePruneFlag,
	serverUrl,
} from "./utils/env.ts";
import { CLI_VERSION } from "./utils/version.ts";

// cli-table3 paints borders/headers even when piped; picocolors already
// respects NO_COLOR/non-TTY, so gate table styling on the same signal.
function humanTable(head: string[]) {
	return new Table({
		head,
		...(pc.isColorSupported ? {} : { style: { border: [], head: [] } }),
	});
}

// cac options are native (camelCase keys, numbers/arrays preserved); these
// accessors coerce to the string/boolean domain at the command edge.
function optString(value: unknown): string | undefined {
	if (typeof value === "string" && value !== "") return value;
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	if (Array.isArray(value) && value.length > 0)
		return optString(value[value.length - 1]);
	return undefined;
}

function optBool(value: unknown): boolean {
	if (Array.isArray(value))
		return value.length > 0 && optBool(value[value.length - 1]);
	return value === true || value === "true";
}

const errorRedactor = new Redactor();

function safeError(error: string | undefined): string | undefined {
	if (error === undefined) return undefined;
	return errorRedactor.redact(error).slice(0, 300);
}

function errorMessage(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

function receiptLine(r: {
	error?: string | undefined;
	key: string;
	ok: boolean;
}): string {
	const err = safeError(r.error);
	return `${r.key}: ${r.ok ? "ok" : "FAILED"}${err ? ` — ${err}` : ""}`;
}

function printJsonOr(
	options: CliOptions,
	value: unknown,
	human: () => void,
): void {
	if (optBool(options.json)) console.log(JSON.stringify(value, null, 2));
	else human();
}

async function cmdCheck(options: CliOptions): Promise<number> {
	const results = await checkAll(parseOnlyFlag(options.only));
	const drifted = results.filter((r) => r.drifted);
	printJsonOr(options, results, () => {
		const table = humanTable([
			pc.bold("key"),
			pc.bold("status"),
			pc.bold("detail"),
		]);
		for (const r of results) {
			table.push([
				r.key,
				r.drifted ? pc.red("DRIFTED") : pc.green("ok"),
				safeError(r.detail) ?? "",
			]);
		}
		console.log(table.toString());
	});
	return drifted.length > 0 ? 2 : 0;
}

async function cmdReset(options: CliOptions): Promise<number> {
	// Explicit worktree fresh-start (the only reset path that touches a
	// worktree; sync/reset-all never do). Requires an explicit sandbox.
	if (optBool(options.freshStart)) {
		const sandbox = optString(options.sandbox);
		if (!sandbox) {
			console.error("reset --fresh-start requires --sandbox <id>");
			return 1;
		}
		if (optBool(options.dryRun)) {
			console.log(
				`would fresh-start ${sandbox} (git clean -fdx + reset --hard)`,
			);
			return 0;
		}
		try {
			await new RepoBinding(sandbox).freshStart({
				branch: optString(options.branch),
				commit: optString(options.commit),
				repoUrl: optString(options.repo),
				taskId: optString(options.task) ?? "task",
			});
			console.log(`fresh-start ${sandbox}: clean`);
			return 0;
		} catch (e) {
			console.error(
				`fresh-start ${sandbox} failed: ${safeError(errorMessage(e))}`,
			);
			return 1;
		}
	}
	const results = await resetAll({
		dryRun: optBool(options.dryRun),
		only: parseOnlyFlag(options.only),
		prune: parsePruneFlag(options.prune),
	});
	printJsonOr(options, results, () => {
		for (const r of results) console.log(receiptLine(r));
	});
	return results.every((r) => r.ok) ? 0 : 2;
}

async function cmdSync(options: CliOptions): Promise<number> {
	const { jobId, receipts } = await performSync({
		dryRun: optBool(options.dryRun),
		only: parseOnlyFlag(options.only),
	});
	printJsonOr(options, { jobId, receipts }, () => {
		console.log(`sync ${jobId}:`);
		for (const r of receipts) console.log(`  ${receiptLine(r)}`);
	});
	// Local CLI sync records per-key receipts in SQLite. The ws sync-ack
	// half of the contract is sent by the daemon's reset-config handler
	// (server `reset-config{keys:"*"}`), which shares performSync ordering.
	return syncExitCode(receipts);
}

async function cmdHistory(options: CliOptions): Promise<number> {
	const range = optString(options.range) ?? "24h";
	const rows = new Heartbeat().history(range);
	printJsonOr(options, rows, () => {
		const table = humanTable([
			pc.bold("ts"),
			pc.bold("cpu"),
			pc.bold("ram"),
			pc.bold("disk"),
		]);
		for (const r of rows.slice(-50)) {
			table.push([
				new Date(r.ts).toISOString(),
				r.cpu.toFixed(1),
				r.ram.toFixed(1),
				r.disk.toFixed(1),
			]);
		}
		console.log(table.toString());
		console.log(`(${rows.length} rows in range ${range})`);
	});
	return 0;
}

function colorSandboxStatus(status: string): string {
	switch (status) {
		case "running":
			return pc.green(status);
		case "stopped":
			return pc.yellow(status);
		case "created":
			return pc.cyan(status);
		case "destroyed":
			return pc.red(status);
		default:
			return status;
	}
}

async function cmdSandbox(
	options: CliOptions,
	args: string[],
): Promise<number> {
	const sub = args[0] ?? "list";
	if (sub === "list") {
		const list = await Sandbox.list();
		printJsonOr(options, list, () => {
			const table = humanTable([
				pc.bold("id"),
				pc.bold("task"),
				pc.bold("project"),
				pc.bold("status"),
			]);
			for (const s of list) {
				table.push([
					s.id,
					s.taskId ?? "-",
					s.projectId ?? "global",
					colorSandboxStatus(s.status),
				]);
			}
			console.log(table.toString());
		});
		return 0;
	}
	if (sub === "prune") {
		const list = await Sandbox.list();
		let n = 0;
		for (const s of list) {
			if (s.status === "stopped") {
				if (optBool(options.dryRun)) console.log(`would prune ${s.id}`);
				else {
					await new Sandbox(s.id).remove();
					console.log(`pruned ${s.id}`);
				}
				n++;
			}
		}
		console.log(
			`${n} stopped sandbox(es)${optBool(options.dryRun) ? " (dry-run)" : ""}`,
		);
		return 0;
	}
	console.error(`unknown sandbox subcommand: ${sub}`);
	return 1;
}

async function cmdRun(options: CliOptions): Promise<number> {
	const taskId = optString(options.task);
	if (!taskId) {
		console.error("run requires --task <id>");
		return 1;
	}
	const commit = optString(options.commit);
	const branch = optString(options.branch);
	const engine = new ExecutionEngine({
		agentBin: optString(options.agent),
	});
	const res = await engine.executeTask(
		{
			projectId: optString(options.project) ?? null,
			prompt: optString(options.prompt) ?? `manual run ${taskId}`,
			repoUrl: optString(options.repo) ?? "",
			t: "assign",
			taskId,
			...(commit ? { commit } : {}),
			...(branch ? { branch } : {}),
			...(optBool(options.freshStart) ? { freshStart: true } : {}),
		},
		(f) => console.log(JSON.stringify(f)),
	);
	if (res.status === "refused") {
		console.log(`run ${taskId} -> refused (quota)`);
		return 1;
	}
	if (res.status === "rejected") {
		console.log(`run ${taskId} -> rejected (claim ${res.reason})`);
		return 1;
	}
	console.log(`run ${taskId} -> ${res.status} (${res.sandboxId})`);
	return res.status === "completed" ? 0 : 1;
}

async function main(): Promise<number> {
	const { cli, command, args, options } = parseCli(process.argv);

	// cac already printed help/version during parse.
	if (options.help === true || options.h === true) return 0;
	if (options.version === true || options.v === true) return 0;

	switch (command) {
		case "version": {
			console.log(`uma-machine ${CLI_VERSION} (protocol v1)`);
			return 0;
		}
		case "enroll": {
			const server = optString(options.server) ?? serverUrl();
			await enroll({
				clientId: optString(options.clientId) ?? "uma-machine",
				machineName: optString(options.name),
				server,
				writeSystemd: optBool(options.systemd),
			});
			return 0;
		}
		case "daemon": {
			// Coercion lives in daemonIntervalS (floor 2s); invalid => default.
			const intervalS =
				options.interval !== undefined
					? daemonIntervalS(options.interval)
					: undefined;
			console.log(`uma-machine daemon ${CLI_VERSION} starting...`);
			await new Daemon({ intervalS }).run();
			// Daemon.run installs SIGINT/SIGTERM handlers; keep alive.
			await new Promise(() => {});
			return 0;
		}
		case "check":
			return cmdCheck(options);
		case "reset":
			return cmdReset(options);
		case "sync":
			return cmdSync(options);
		case "history":
			return cmdHistory(options);
		case "sandbox":
			return cmdSandbox(options, args);
		case "run":
			return cmdRun(options);
		case undefined: {
			if (args.length === 0) {
				cli.outputHelp();
				return 0;
			}
			console.error(`unknown command: ${args[0]}\n`);
			cli.outputHelp();
			return 1;
		}
		default: {
			console.error(`unknown command: ${command}\n`);
			cli.outputHelp();
			return 1;
		}
	}
}

const code = await main().catch((e) => {
	console.error(`error: ${safeError(errorMessage(e)) ?? "unknown error"}`);
	return 1;
});
process.exit(code);
