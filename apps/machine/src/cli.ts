import type { CAC } from "cac";
import cac from "cac";

import { CLI_VERSION } from "./utils/version.ts";

export type CliOptions = Record<string, unknown>;

export interface CliParseResult {
	/** Positional args (e.g. `sandbox [sub]`). */
	args: string[];
	cli: CAC;
	/** Matched cac command name, or undefined when no command matched. */
	command: string | undefined;
	/** Native cac options: camelCase keys, numbers/arrays preserved. */
	options: CliOptions;
}

/**
 * Build the cac CLI with all commands + option defs.
 *
 * Help (`-h/--help`, `<cmd> --help`) and version (`-v/--version`) are owned
 * by cac via help()/version() — parse() prints them directly.
 */
export function buildCli(): CAC {
	const cli = cac("uma-machine");
	cli.help();
	cli.version(CLI_VERSION);

	cli
		.command("enroll", "Enroll this machine with the server")
		.usage(
			"enroll --server <url> [--name <machine>] [--systemd] [--client-id <id>]",
		)
		.option("--server <url>", "Server URL")
		.option("--name <machine>", "Machine name")
		.option("--systemd", "Write systemd unit")
		.option("--client-id <id>", "OAuth client id");

	cli
		.command("daemon", "Run the device daemon")
		.usage("daemon [--interval <seconds>]")
		.option("--interval <seconds>", "Tick interval in seconds (min 2)");

	cli
		.command("check", "Check config drift")
		.usage("check [--only <k1,k2>] [--json]")
		.option("--only <keys>", "Comma-separated subset of keys")
		.option("--json", "JSON output");

	cli
		.command("reset", "Reset drifted config")
		.usage(
			"reset [--only <k1,k2>] [--dry-run] [--prune] | reset --fresh-start --sandbox <id> [--commit <sha>] [--repo <url>] [--branch <branch>] [--task <id>] [--dry-run]",
		)
		.option("--only <keys>", "Comma-separated subset of keys")
		.option("--dry-run", "Print actions without applying")
		.option("--prune", "Prune unmanaged entries")
		.option(
			"--fresh-start",
			"Git clean -fdx + reset --hard in sandbox worktree",
		)
		.option("--sandbox <id>", "Sandbox id (fresh-start)")
		.option("--commit <sha>", "Commit sha (fresh-start)")
		.option("--repo <url>", "Repo URL (fresh-start)")
		.option("--branch <branch>", "Branch name (fresh-start)")
		.option("--task <id>", "Task id (fresh-start)")
		.option("--json", "JSON output");

	cli
		.command("sync", "Sync config with server receipts")
		.usage("sync [--dry-run] [--json] [--only <k1,k2>]")
		.option("--dry-run", "Print actions without applying")
		.option("--json", "JSON output")
		.option("--only <keys>", "Comma-separated subset of keys");

	cli
		.command("history", "Show heartbeat history")
		.usage("history [--range 24h|30d] [--json]")
		.option("--range <range>", "Time range (e.g. 24h, 30d)")
		.option("--json", "JSON output");

	cli
		.command("sandbox [sub]", "Manage sandboxes (list|prune)")
		.usage("sandbox [list|prune] [--json] [--dry-run]")
		.option("--json", "JSON output")
		.option("--dry-run", "Print actions without applying");

	cli
		.command("run", "Run a task once")
		.usage(
			"run --task <id> [--prompt <text>] [--project <id>] [--repo <url>] [--commit <sha>] [--branch <b>] [--agent <bin>] [--fresh-start]",
		)
		.option("--task <id>", "Task id")
		.option("--prompt <text>", "Prompt text")
		.option("--project <id>", "Project id")
		.option("--repo <url>", "Repo URL")
		.option("--commit <sha>", "Commit sha")
		.option("--branch <branch>", "Branch name")
		.option("--agent <bin>", "Agent binary")
		.option("--fresh-start", "Fresh start in sandbox");

	cli.command("version", "Print version").usage("version");

	// Product footer on global help: valid config keys + exit-code contract.
	const prevHelp = cli.globalCommand.helpCallback;
	cli.globalCommand.helpCallback = (sections) => {
		const out = prevHelp ? prevHelp(sections) : undefined;
		const base = out ?? sections;
		if (!base.some((s) => s.title === "Commands")) return base;
		return [
			...base,
			{
				body: "  programs, git-login, agents, files, providers, mcp, skills, systemd",
				title: "Keys",
			},
			{
				body: "  0 ok/clean, 2 drifted/partial, 1 error, 3 UPGRADE_REQUIRED",
				title: "Exit codes",
			},
		];
	};

	return cli;
}

/** Parse argv via cac, keeping options native (camelCase, numbers/arrays). */
export function parseCli(argv: string[]): CliParseResult {
	const cli = buildCli();
	const parsed = cli.parse(argv, { run: false });
	return {
		args: parsed.args.map((a) => String(a)),
		cli,
		command: cli.matchedCommandName ?? undefined,
		options: { ...parsed.options },
	};
}
