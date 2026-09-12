#!/usr/bin/env bun
import Table from "cli-table3";
import pc from "picocolors";

import { type CliFlags, helpText, parseCli } from "./cli.ts";
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

// cac flags are string | boolean | undefined (numeric-looking values are
// normalized back to strings by parseCli); these accessors keep casts out of
// every command and never let `true` leak into a string position.
function flagString(flags: CliFlags, key: string): string | undefined {
	const v = flags[key];
	return typeof v === "string" && v !== "" ? v : undefined;
}

function flagBool(flags: CliFlags, key: string): boolean {
	const v = flags[key];
	return v === true || v === "true";
}

const errorRedactor = new Redactor();

function safeError(error: string | undefined): string | undefined {
	if (error === undefined) return undefined;
	return errorRedactor.redact(error).slice(0, 300);
}

function errorMessage(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

function receiptLine(r: { error?: string; key: string; ok: boolean }): string {
	const err = safeError(r.error);
	return `${r.key}: ${r.ok ? "ok" : "FAILED"}${err ? ` — ${err}` : ""}`;
}

function printJsonOr(flags: CliFlags, value: unknown, human: () => void): void {
	if (flagBool(flags, "json")) console.log(JSON.stringify(value, null, 2));
	else human();
}

async function cmdCheck(flags: CliFlags): Promise<number> {
	const results = await checkAll(parseOnlyFlag(flagString(flags, "only")));
	const drifted = results.filter((r) => r.drifted);
	printJsonOr(flags, results, () => {
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

async function cmdReset(flags: CliFlags, rest: string[]): Promise<number> {
	// Explicit worktree fresh-start (the only reset path that touches a
	// worktree; sync/reset-all never do). Requires an explicit sandbox.
	if (flagBool(flags, "fresh-start")) {
		const sandbox = flagString(flags, "sandbox") ?? rest[0];
		if (!sandbox) {
			console.error("reset --fresh-start requires --sandbox <id>");
			return 1;
		}
		if (flagBool(flags, "dry-run")) {
			console.log(
				`would fresh-start ${sandbox} (git clean -fdx + reset --hard)`,
			);
			return 0;
		}
		try {
			await new RepoBinding(sandbox).freshStart({
				branch: flagString(flags, "branch"),
				commit: flagString(flags, "commit"),
				repoUrl: flagString(flags, "repo"),
				taskId: flagString(flags, "task") ?? "task",
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
		dryRun: flagBool(flags, "dry-run"),
		only: parseOnlyFlag(flagString(flags, "only")),
		prune: parsePruneFlag(flags.prune),
	});
	printJsonOr(flags, results, () => {
		for (const r of results) console.log(receiptLine(r));
	});
	return results.every((r) => r.ok) ? 0 : 2;
}

async function cmdSync(flags: CliFlags): Promise<number> {
	const { jobId, receipts } = await performSync({
		dryRun: flagBool(flags, "dry-run"),
		only: parseOnlyFlag(flagString(flags, "only")),
	});
	printJsonOr(flags, { jobId, receipts }, () => {
		console.log(`sync ${jobId}:`);
		for (const r of receipts) console.log(`  ${receiptLine(r)}`);
	});
	// Local CLI sync records per-key receipts in SQLite. The ws sync-ack
	// half of the contract is sent by the daemon's reset-config handler
	// (server `reset-config{keys:"*"}`), which shares performSync ordering.
	return syncExitCode(receipts);
}

async function cmdHistory(flags: CliFlags): Promise<number> {
	const range = flagString(flags, "range") ?? "24h";
	const rows = new Heartbeat().history(range);
	printJsonOr(flags, rows, () => {
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

async function cmdSandbox(flags: CliFlags, rest: string[]): Promise<number> {
	const sub = rest[0] ?? "list";
	if (sub === "list") {
		const list = await Sandbox.list();
		printJsonOr(flags, list, () => {
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
				if (flagBool(flags, "dry-run")) console.log(`would prune ${s.id}`);
				else {
					await new Sandbox(s.id).remove();
					console.log(`pruned ${s.id}`);
				}
				n++;
			}
		}
		console.log(
			`${n} stopped sandbox(es)${flagBool(flags, "dry-run") ? " (dry-run)" : ""}`,
		);
		return 0;
	}
	console.error(`unknown sandbox subcommand: ${sub}`);
	return 1;
}

async function cmdRun(flags: CliFlags, rest: string[]): Promise<number> {
	const taskId = flagString(flags, "task") ?? rest[0];
	if (!taskId) {
		console.error("run requires --task <id>");
		return 1;
	}
	const commit = flagString(flags, "commit");
	const branch = flagString(flags, "branch");
	const engine = new ExecutionEngine({
		agentBin: flagString(flags, "agent"),
	});
	const res = await engine.executeTask(
		{
			projectId: flagString(flags, "project") ?? null,
			prompt: flagString(flags, "prompt") ?? `manual run ${taskId}`,
			repoUrl: flagString(flags, "repo") ?? "",
			t: "assign",
			taskId,
			...(commit ? { commit } : {}),
			...(branch ? { branch } : {}),
			...(flagBool(flags, "fresh") || flagBool(flags, "fresh-start")
				? { freshStart: true }
				: {}),
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
	// cac-backed parsing (see src/cli.ts); flag names, exit codes, and
	// defaults below are unchanged from the hand-rolled parser.
	const { cli, cmd, rest, flags } = parseCli(process.argv);

	// cac auto-doc: `check --help`, `enroll --help`, ... print the
	// per-command help instead of running the command.
	if (flags.help || flags.h) {
		cli.outputHelp();
		return 0;
	}

	switch (cmd) {
		case "version":
		case "--version":
		case "-v": {
			console.log(`uma-machine ${CLI_VERSION} (protocol v1)`);
			return 0;
		}
		case "help":
		case "--help":
		case "-h": {
			// `help <command>` prints that command's cac help; bare help
			// keeps the legacy template (keys + exit codes).
			const sub = rest[0];
			const target = sub ? cli.commands.find((c) => c.name === sub) : undefined;
			if (target) target.outputHelp();
			else console.log(helpText());
			return 0;
		}
		case "enroll": {
			const server = flagString(flags, "server") ?? serverUrl();
			const name = flagString(flags, "name") ?? flagString(flags, "machine");
			await enroll({
				clientId: flagString(flags, "client-id") ?? "uma-machine",
				machineName: name,
				server,
				writeSystemd: flagBool(flags, "systemd"),
			});
			return 0;
		}
		case "daemon": {
			// Coercion lives in daemonIntervalS (floor 2s); invalid => default.
			const intervalS =
				flags.interval !== undefined
					? daemonIntervalS(flags.interval)
					: undefined;
			console.log(`uma-machine daemon ${CLI_VERSION} starting...`);
			await new Daemon({ intervalS }).run();
			// Daemon.run installs SIGINT/SIGTERM handlers; keep alive.
			await new Promise(() => {});
			return 0;
		}
		case "check":
			return cmdCheck(flags);
		case "reset":
			return cmdReset(flags, rest);
		case "sync":
			return cmdSync(flags);
		case "history":
			return cmdHistory(flags);
		case "sandbox":
			return cmdSandbox(flags, rest);
		case "run":
			return cmdRun(flags, rest);
		default: {
			console.error(`unknown command: ${cmd}\n`);
			console.log(helpText());
			return 1;
		}
	}
}

const code = await main().catch((e) => {
	console.error(`error: ${safeError(errorMessage(e)) ?? "unknown error"}`);
	return 1;
});
process.exit(code);
