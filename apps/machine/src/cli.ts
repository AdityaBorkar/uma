import type { CAC } from "cac";
import cac from "cac";
import { kebabCase } from "es-toolkit/string";

export type CliFlags = Record<string, string | boolean>;

export interface ParsedArgs {
	cmd: string;
	flags: CliFlags;
	rest: string[];
}

export interface CliParseResult extends ParsedArgs {
	cli: CAC;
}

function toKebab(key: string): string {
	return kebabCase(key);
}

/**
 * Build the cac CLI with all commands + type-safe option defs.
 *
 * Global `-h/--help` and `-v/--version` are registered via option() (not
 * help()/version()) so parse() stays pure — no auto console output.
 * main() in index.ts handles help/version explicitly to preserve the exact
 * legacy output formats and exit codes.
 */
export function buildCli(): CAC {
	const cli = cac("uma-machine");
	cli.option("-h, --help", "Display this message");
	cli.option("-v, --version", "Display version number");

	cli
		.command("enroll", "Enroll this machine with the server")
		.usage(
			"enroll --server <url> [--name <machine>] [--systemd] [--client-id <id>]",
		)
		.option("--server <url>", "Server URL")
		.option("--name <machine>", "Machine name")
		.option("--machine <machine>", "Machine name alias")
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
			"run --task <id> [--prompt <text>] [--project <id>] [--repo <url>] [--commit <sha>] [--branch <b>] [--agent <bin>]",
		)
		.option("--task <id>", "Task id")
		.option("--prompt <text>", "Prompt text")
		.option("--project <id>", "Project id")
		.option("--repo <url>", "Repo URL")
		.option("--commit <sha>", "Commit sha")
		.option("--branch <branch>", "Branch name")
		.option("--agent <bin>", "Agent binary")
		.option("--fresh", "Fresh start in sandbox")
		.option("--fresh-start", "Fresh start in sandbox");

	cli.command("version", "Print version").usage("version");

	// Keep Keys / Exit-codes footer consistent with helpText() on global help.
	const prevHelp = cli.globalCommand.helpCallback;
	cli.globalCommand.helpCallback = (sections) => {
		const out = prevHelp ? prevHelp(sections) : undefined;
		const base = out ?? sections;
		if (!base.some((s) => s.title === "Commands")) return base;
		return [
			...base,
			{
				body: "  programs, git-login, adityab-agent, agents, files, providers, mcp, skills, systemd",
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

/** Parse argv via cac into the legacy {cmd, flags, rest} shape. */
export function parseCli(argv: string[]): CliParseResult {
	const cli = buildCli();
	cli.parse(argv, { run: false });
	const rawOptions = cli.options as Record<string, unknown>;
	const flags: CliFlags = {};
	for (const [key, value] of Object.entries(rawOptions)) {
		if (key === "--") continue;
		if (value === undefined) continue;
		if (typeof value === "string" || typeof value === "boolean") {
			flags[key] = value;
			const kebab = toKebab(key);
			if (kebab !== key) flags[kebab] = value;
		} else if (typeof value === "number" || Array.isArray(value)) {
			// mri coerces numeric-looking values to numbers and repeated
			// flags to arrays; normalize back to the legacy string domain so
			// downstream casts (taskId, sandbox, server, ...) stay strings.
			// (Repeated --only a --only b joins to "a,b" for parseOnlyFlag;
			// the old hand parser overwrote and lost `a`.)
			const joined = Array.isArray(value)
				? value.map((v) => String(v)).join(",")
				: String(value);
			flags[key] = joined;
			const kebab = toKebab(key);
			if (kebab !== key) flags[kebab] = joined;
		}
	}
	const afterDoubleDash = Array.isArray(rawOptions["--"])
		? (rawOptions["--"] as unknown[]).map((v) => String(v))
		: [];
	const matched = cli.matchedCommandName;
	let cmd: string;
	let rest: string[];
	if (matched) {
		cmd = matched;
		rest = cli.args.map((a) => String(a));
	} else if (rawOptions.help || rawOptions.h) {
		cmd = "help";
		rest = cli.args.map((a) => String(a));
	} else if (rawOptions.version || rawOptions.v) {
		cmd = "version";
		rest = cli.args.map((a) => String(a));
	} else if (cli.args.length > 0) {
		cmd = String(cli.args[0]);
		rest = cli.args.slice(1).map((a) => String(a));
	} else {
		cmd = "help";
		rest = [];
	}
	if (afterDoubleDash.length > 0) rest = [...rest, ...afterDoubleDash];
	return { cli, cmd, flags, rest };
}

export function helpText(): string {
	return `uma-machine — device-side agent (protocol v1)

Usage:
  uma-machine enroll --server <url> [--name <machine>] [--systemd] [--client-id <id>]
  uma-machine daemon [--interval <seconds>]
  uma-machine check [--only <k1,k2>] [--json]
  uma-machine reset [--only <k1,k2>] [--dry-run] [--prune]
  uma-machine reset --fresh-start --sandbox <id> [--commit <sha>] [--repo <url>] [--branch <b>] [--task <id>] [--dry-run]
  uma-machine sync [--dry-run] [--json] [--only <k1,k2>]
  uma-machine history [--range 24h|30d] [--json]
  uma-machine sandbox list [--json]
  uma-machine sandbox prune [--dry-run]
  uma-machine run --task <id> [--prompt <text>] [--project <id>] [--repo <url>] [--commit <sha>] [--branch <b>] [--agent <bin>]
  uma-machine version

Keys: programs, git-login, adityab-agent, agents, files, providers, mcp, skills, systemd
Exit codes: 0 ok/clean, 2 drifted/partial, 1 error, 3 UPGRADE_REQUIRED
`;
}
