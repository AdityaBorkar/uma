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
 * main() in index.ts handles help/version explicitly.
 */
export function buildCli(): CAC {
	const cli = cac("uma");
	cli.option("-h, --help", "Display this message");
	cli.option("-v, --version", "Display version number");

	cli
		.command("mcp [sub]", "MCP server (start)")
		.usage("mcp start [--port <n>] [--host <h>] [--root <dir>] [--stdio]")
		.option("--port <n>", "Serve Streamable HTTP on this port (default: stdio)")
		.option("--host <h>", "HTTP bind host (default 127.0.0.1)")
		.option("--root <dir>", "Repo root for docs (default: auto-detect)")
		.option("--stdio", "Keep stdio transport up alongside --port");

	cli
		.command("docs [sub]", "Read/search repo docs (list|read|query)")
		.usage(
			"docs list [--json] | docs read <path> | docs query <text...> [--limit <n>] [--json]",
		)
		.option("--limit <n>", "Max query hits (default 10, max 50)")
		.option("--json", "JSON output")
		.option("--root <dir>", "Repo root for docs (default: auto-detect)");

	cli.command("version", "Print version").usage("version");

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
	return `uma — repo CLI (docs + MCP server)

Usage:
  uma mcp start [--port <n>] [--host <h>] [--root <dir>] [--stdio]
  uma docs list [--root <dir>] [--json]
  uma docs read <path> [--root <dir>]
  uma docs query <text...> [--limit <n>] [--root <dir>] [--json]
  uma version

MCP transports: stdio (default) or Streamable HTTP POST /mcp with --port.
Exit codes: 0 ok, 1 error
`;
}
