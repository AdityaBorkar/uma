import { execFile } from "node:child_process";

import { isSafeSkillSource } from "../skills/skills.ts";

const VERIFY_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_CHARS = 40_000;

function stripAnsi(text: string): string {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI escapes.
	const noAnsi = text.replace(/\[[0-9;?]*[A-Za-z]/g, "").replace(/\r/g, "");
	// The CLI renders box-drawing/progress glyphs (│ ┌ ◇ …) that survive
	// ANSI stripping; drop them so line parsing sees plain text.
	return noAnsi.replace(/[│┌┐└┘├┤┬┴┼─━┃◒◐◓◑◇◆○●✓✗✔■□▲▼…]/g, "");
}

function parseSkillList(
	output: string,
): { description: string; name: string }[] {
	const text = stripAnsi(output);
	const start = text.search(/Available Skills/i);
	const section = start >= 0 ? text.slice(start) : text;
	const lines = section.split("\n");
	const skills: { description: string; name: string }[] = [];
	for (let i = 0; i < lines.length && skills.length < 200; i++) {
		const line = lines[i] ?? "";
		const trimmed = line.trim();
		if (!trimmed) continue;
		if (/^(available skills|use --skill|skills\s*$)/i.test(trimmed)) continue;
		// Skill name rows are short single tokens; the following non-empty
		// line is the description.
		if (!/^[A-Za-z0-9][A-Za-z0-9\-_ ]{0,99}$/.test(trimmed)) continue;
		let j = i + 1;
		let description = "";
		while (j < lines.length) {
			const next = (lines[j] ?? "").trim();
			j++;
			if (!next) continue;
			if (/^(available skills|use --skill)/i.test(next)) break;
			description = next;
			break;
		}
		if (description) {
			skills.push({ description, name: trimmed });
			i = j - 1;
		}
	}
	return skills;
}

function runVerify(
	source: string,
): Promise<{ code: number; stderr: string; stdout: string }> {
	return new Promise((resolve) => {
		execFile(
			"bunx",
			["skills", "add", source, "--list", "-y"],
			{
				env: {
					...process.env,
					CI: "1",
					DISABLE_TELEMETRY: "1",
					DO_NOT_TRACK: "1",
					NO_COLOR: "1",
				},
				maxBuffer: 8 * 1024 * 1024,
				timeout: VERIFY_TIMEOUT_MS,
			},
			(error, stdout, stderr) => {
				const code =
					error &&
					typeof error === "object" &&
					"code" in error &&
					typeof error.code === "number"
						? error.code
						: error
							? 1
							: 0;
				resolve({
					code,
					stderr: String(stderr ?? "").slice(0, MAX_OUTPUT_CHARS),
					stdout: String(stdout ?? "").slice(0, MAX_OUTPUT_CHARS),
				});
			},
		);
	});
}

/**
 * `GET /api/skills/verify?source=…` — run
 * `bunx skills add <source> --list -y` server-side (lists without
 * installing) and return the discovered skill names. Args go through
 * `execFile` with no shell; the source is allowlisted first.
 */
export async function handleSkillsVerify(request: Request): Promise<Response> {
	const url = new URL(request.url);
	const source = (url.searchParams.get("source") ?? "").trim();
	if (!isSafeSkillSource(source)) {
		return Response.json(
			{ error: "Source is required (max 512 chars, no whitespace)." },
			{ status: 400 },
		);
	}
	let result: { code: number; stderr: string; stdout: string };
	try {
		result = await runVerify(source);
	} catch (error) {
		const message =
			error instanceof Error && /ENOENT/i.test(error.message)
				? "bunx is not available on the server."
				: "Could not run the skills CLI on the server.";
		return Response.json({ error: message, source }, { status: 503 });
	}
	const combined = `${result.stdout}\n${result.stderr}`;
	const clean = stripAnsi(combined);
	if (/failed to clone|installation failed|canceled|cancelled/i.test(clean)) {
		const hint = clean
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean)
			.slice(-6)
			.join(" ");
		return Response.json(
			{
				error: `Could not resolve ${source}. ${hint}`.trim(),
				source,
			},
			{ status: 422 },
		);
	}
	const skills = parseSkillList(combined);
	const found = clean.match(/Found\s+(\d+)\s+skills?/i);
	const count = found?.[1] ? Number(found[1]) : skills.length;
	if (skills.length === 0 && /no skills found/i.test(clean)) {
		return Response.json(
			{ error: `No skills found in ${source}.`, source },
			{ status: 422 },
		);
	}
	return Response.json({ count, skills, source });
}
