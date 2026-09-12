import { createHash } from "node:crypto";

import fastRedact from "fast-redact";

/** SHA-256 hex fingerprint, truncated for display (never the secret itself). */
export function fingerprint(secret: string): string {
	return createHash("sha256").update(secret, "utf8").digest("hex").slice(0, 16);
}

// Hoisted codecs: capChunk/splitChunks previously allocated a TextEncoder +
// TextDecoder per call (per chunk on multi-MB outputs).
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf8", { fatal: false });

const SECRET_PATTERNS: RegExp[] = [
	/ghp_[A-Za-z0-9]{20,}/g,
	/gho_[A-Za-z0-9]{20,}/g,
	/github_pat_[A-Za-z0-9_]{20,}/g,
	/sk-ant-[A-Za-z0-9\-_]{10,}/g,
	/\bsk-[A-Za-z0-9]{16,}\b/g,
	/\bAKIA[0-9A-Z]{16}\b/g,
	/xox[bap]-[A-Za-z0-9\-_]{8,}/g,
	/Bearer\s+[A-Za-z0-9\-._~+/=]{12,}/g,
	// Extended gaps: generic password assignments, api-key assignments,
	// PEM private keys, and sess_ session tokens.
	/\bpassword\s*[:=]\s*['"]?[^\s'"]{4,}['"]?/gi,
	/\bapi[_-]?key\s*[:=]\s*['"]?[^\s'"]{4,}['"]?/gi,
	/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
	/\bsess_[A-Za-z0-9\-_]{8,}/g,
];

// Object layer (pino's single-pass redactor): known secret paths in structured
// data. Complements — never replaces — the verbatim-secret string layer
// above (exact session tokens/keys must redact even when pattern-less).
// `*` matches a single level, so each key is covered at depths 0–2 (flat
// frames, one-deep envelopes, two-deep payloads).
const SECRET_KEYS = [
	"password",
	"passwd",
	"secret",
	"apiKey",
	"api_key",
	"access_token",
	"sessionToken",
	"authorization",
	"token",
];
const SECRET_PATHS = SECRET_KEYS.flatMap((k) => [k, `*.${k}`, `*.*.${k}`]);
const redactObjectFast = fastRedact({
	censor: "[REDACTED]",
	paths: SECRET_PATHS,
	serialize: false,
});

export class Redactor {
	private secrets: string[] = [];

	addSecret(s: string | undefined | null): void {
		if (!s || s.length < 4) return;
		if (this.secrets.includes(s)) return;
		this.secrets.push(s);
		// Keep longest-first so verbatim overlap never masks a shorter match.
		this.secrets.sort((a, b) => b.length - a.length);
	}

	addMany(list: readonly (string | undefined | null)[]): void {
		for (const s of list) {
			if (s) this.addSecret(s);
		}
	}

	redact(text: string): string {
		let out = text;
		// Verbatim secrets first (already sorted longest-first on add).
		for (const s of this.secrets) {
			out = out.split(s).join("[REDACTED]");
		}
		for (const re of SECRET_PATTERNS) {
			re.lastIndex = 0;
			out = out.replace(re, "[REDACTED]");
		}
		return out;
	}

	/**
	 * Redact secret paths in structured data (single pass via fast-redact).
	 * Fails closed: callers must buffer/drop rather than send on error.
	 */
	redactObject<T>(obj: T): T {
		try {
			return redactObjectFast(obj) as T;
		} catch (e) {
			throw new Error(
				`object redaction failed: ${e instanceof Error ? e.message : String(e)}`,
			);
		}
	}
}

/** UTF-8 sequence length from a lead byte (stray continuation → 1). */
function utf8CharLen(lead: number): number {
	if (lead < 0x80) return 1;
	if ((lead & 0xe0) === 0xc0) return 2;
	if ((lead & 0xf0) === 0xe0) return 3;
	if ((lead & 0xf8) === 0xf0) return 4;
	return 1;
}

/** Truncate a log chunk to the frame cap (UTF-8 byte length). */
export function capChunk(chunk: string, capBytes: number): string {
	const bytes = encoder.encode(chunk);
	if (bytes.length <= capBytes) return chunk;
	// Binary-safe truncation: back off to the last complete UTF-8 char so a
	// multibyte scalar straddling the cap is never torn (a torn tail would
	// decode as U+FFFD and corrupt the join in splitChunks).
	let end = capBytes;
	let start = end - 1;
	while (start > 0 && ((bytes[start] ?? 0) & 0xc0) === 0x80) start--;
	if (start + utf8CharLen(bytes[start] ?? 0) > capBytes) end = start;
	if (end === 0) {
		// Degenerate cap smaller than one char: keep the first char whole
		// (budget overrun ≤3B) rather than dropping data.
		end = start + utf8CharLen(bytes[start] ?? 0);
	}
	return decoder.decode(bytes.subarray(0, end));
}

/** Split text into <=capBytes chunks (byte-accurate, never empty/yield-less). */
export function splitChunks(text: string, capBytes: number): string[] {
	if (text.length === 0) return [];
	const out: string[] = [];
	let rest = text;
	while (rest.length > 0) {
		const chunk = capChunk(rest, capBytes);
		if (chunk.length === 0) break;
		out.push(chunk);
		if (chunk.length >= rest.length) break;
		rest = rest.slice(chunk.length);
	}
	return out;
}
