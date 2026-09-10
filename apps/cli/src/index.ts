#!/usr/bin/env bun
import pc from "picocolors";

import type { CliFlags } from "./cli.ts";
import { helpText, parseCli } from "./cli.ts";
import { listDocFiles, queryDocs, readDoc } from "./docs.ts";
import { MCP_DEFAULT_HOST, startHttpServer, startStdioServer } from "./mcp.ts";
import { CLI_VERSION } from "./version.ts";

// cac flags are string | boolean | undefined; these accessors keep casts out
// of every command and never let `true` leak into a string position.
function flagString(flags: CliFlags, key: string): string | undefined {
	const v = flags[key];
	return typeof v === "string" && v !== "" ? v : undefined;
}

function flagBool(flags: CliFlags, key: string): boolean {
	const v = flags[key];
	return v === true || v === "true";
}

function errorMessage(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

function printJsonOr(flags: CliFlags, value: unknown, human: () => void): void {
	if (flagBool(flags, "json")) console.log(JSON.stringify(value, null, 2));
	else human();
}

async function cmdMcp(flags: CliFlags, rest: string[]): Promise<number> {
	const sub = rest[0] ?? "start";
	if (sub !== "start") {
		console.error(`unknown mcp subcommand: ${sub} (want: start)`);
		return 1;
	}
	const root = flagString(flags, "root");
	const portRaw = flagString(flags, "port");
	const host = flagString(flags, "host") ?? MCP_DEFAULT_HOST;
	const both = flagBool(flags, "stdio");

	if (portRaw === undefined && both) {
		console.error("--stdio needs --port <n> (stdio is already the default)");
		return 1;
	}

	if (portRaw === undefined) {
		// stdio mode: stdout carries JSON-RPC — keep it clean, log to stderr.
		console.error("uma-docs MCP (stdio) running — press Ctrl-C to stop");
		await startStdioServer(root);
		// connect() only wires the transport; park until SIGINT/SIGTERM.
		await new Promise(() => {});
		return 0;
	}

	const port = Number(portRaw);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		console.error(`invalid --port: ${JSON.stringify(portRaw)} (want 1-65535)`);
		return 1;
	}
	if (both) {
		startHttpServer({ host, port, root });
		console.error("uma-docs MCP (stdio) running — press Ctrl-C to stop");
		await startStdioServer(root);
		await new Promise(() => {});
		return 0;
	}
	startHttpServer({ host, port, root });
	// The HTTP server holds the event loop; park here until SIGINT/SIGTERM.
	await new Promise((resolve) => {
		const stop = () => resolve(undefined);
		process.once("SIGINT", stop);
		process.once("SIGTERM", stop);
	});
	return 0;
}

async function cmdDocs(flags: CliFlags, rest: string[]): Promise<number> {
	const sub = rest[0] ?? "list";
	const root = flagString(flags, "root");
	if (sub === "list") {
		const files = await listDocFiles(root);
		printJsonOr(flags, files, () => {
			for (const f of files) console.log(f);
		});
		return 0;
	}
	if (sub === "read") {
		const path = rest[1];
		if (!path) {
			console.error("docs read requires <path> (see `uma docs list`)");
			return 1;
		}
		try {
			const doc = await readDoc(path, root);
			console.log(doc.content);
			if (doc.truncated) {
				console.error(`(truncated — file is larger than one read)`);
			}
			return 0;
		} catch (e) {
			console.error(`error: ${errorMessage(e)}`);
			return 1;
		}
	}
	if (sub === "query") {
		const query = rest.slice(1).join(" ").trim();
		if (query === "") {
			console.error("docs query requires <text...>");
			return 1;
		}
		const limitRaw = flagString(flags, "limit");
		const limit = limitRaw === undefined ? undefined : Number(limitRaw);
		if (
			limitRaw !== undefined &&
			(!Number.isInteger(limit) || (limit as number) < 1)
		) {
			console.error(`invalid --limit: ${JSON.stringify(limitRaw)}`);
			return 1;
		}
		const hits = await queryDocs(query, { limit, root });
		printJsonOr(flags, hits, () => {
			if (hits.length === 0) {
				console.log("no matches");
				return;
			}
			for (const h of hits) {
				console.log(`${pc.bold(h.path)} ${pc.dim(`(score ${h.score})`)}`);
				for (const line of h.snippet.split("\n")) console.log(`  ${line}`);
			}
		});
		return 0;
	}
	console.error(`unknown docs subcommand: ${sub} (want: list|read|query)`);
	return 1;
}

async function main(): Promise<number> {
	const { cli, cmd, rest, flags } = parseCli(process.argv);

	if (flags.help || flags.h) {
		cli.outputHelp();
		return 0;
	}

	switch (cmd) {
		case "version":
		case "--version":
		case "-v": {
			console.log(`uma ${CLI_VERSION}`);
			return 0;
		}
		case "help":
		case "--help":
		case "-h": {
			const sub = rest[0];
			const target = sub ? cli.commands.find((c) => c.name === sub) : undefined;
			if (target) target.outputHelp();
			else console.log(helpText());
			return 0;
		}
		case "mcp":
			return cmdMcp(flags, rest);
		case "docs":
			return cmdDocs(flags, rest);
		default: {
			console.error(`unknown command: ${cmd}\n`);
			console.log(helpText());
			return 1;
		}
	}
}

const code = await main().catch((e) => {
	console.error(`error: ${errorMessage(e) ?? "unknown error"}`);
	return 1;
});
process.exit(code);
