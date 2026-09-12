import { describe, expect, test } from "bun:test";

import {
	capChunk,
	fingerprint,
	Redactor,
	splitChunks,
} from "../src/execution/redact.ts";

describe("redact", () => {
	test("verbatim secrets redacted", () => {
		const r = new Redactor();
		r.addSecret("super-secret-token-123");
		expect(r.redact("token is super-secret-token-123 here")).toBe(
			"token is [REDACTED] here",
		);
	});

	test("gh + openai patterns redacted", () => {
		const r = new Redactor();
		expect(r.redact("key ghp_abcdefghij1234567890 done")).toContain(
			"[REDACTED]",
		);
		expect(r.redact("key sk-ant-abcdefghij123456 done")).toContain(
			"[REDACTED]",
		);
		expect(r.redact("Bearer abcdefghijklmnop here")).toContain("[REDACTED]");
	});

	test("short secrets ignored, session token covered", () => {
		const r = new Redactor();
		r.addSecret("abc"); // too short
		expect(r.redact("abc")).toBe("abc");
		r.addSecret("sess_ABCDEFGH12345678");
		expect(r.redact("auth sess_ABCDEFGH12345678 end")).toContain("[REDACTED]");
	});

	test("capChunk respects byte cap", () => {
		expect(capChunk("hello", 256 * 1024)).toBe("hello");
		const big = "x".repeat(300 * 1024);
		expect(
			Buffer.byteLength(capChunk(big, 256 * 1024), "utf8"),
		).toBeLessThanOrEqual(256 * 1024);
	});

	test("fingerprint stable, never equals secret", () => {
		const f1 = fingerprint("secret-1");
		expect(f1).toBe(fingerprint("secret-1"));
		expect(f1).not.toContain("secret-1");
		expect(f1.length).toBe(16);
	});

	test("extended patterns: password/api-key/PRIVATE KEY/sess_", () => {
		const r = new Redactor();
		expect(r.redact("login password=hunter2 ok")).not.toContain("hunter2");
		expect(r.redact("api-key: AK-1234567890 done")).not.toContain(
			"AK-1234567890",
		);
		expect(r.redact("key api_key=abcdef123456 end")).not.toContain(
			"abcdef123456",
		);
		expect(
			r.redact(
				"k -----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY----- k",
			),
		).not.toContain("abc\n");
		expect(r.redact("auth sess_ABCDEFGH12345678 end")).toContain("[REDACTED]");
	});

	test("redactObject covers secret paths in structured data", () => {
		const r = new Redactor();
		const out = r.redactObject({
			nested: { apiKey: "live-key", depth: { password: "pw" } },
			ok: "visible",
			token: "tok-123",
		});
		expect(out).toEqual({
			nested: { apiKey: "[REDACTED]", depth: { password: "[REDACTED]" } },
			ok: "visible",
			token: "[REDACTED]",
		});
	});

	test("splitChunks byte-accurate incl. emoji at the boundary", () => {
		// 4-byte emoji straddling a tiny cap: every chunk stays within budget
		// and the join loses no scalar values (no U+FFFD corruption).
		const text = `ab${"😀".repeat(10)}cd`;
		const chunks = splitChunks(text, 8);
		expect(chunks.length).toBeGreaterThan(1);
		for (const c of chunks) {
			expect(Buffer.byteLength(c, "utf8")).toBeLessThanOrEqual(8);
			expect(c).not.toContain("�");
		}
		expect(chunks.join("")).toBe(text);
		expect(splitChunks("", 8)).toEqual([]);
		expect(splitChunks("hi", 8)).toEqual(["hi"]);
	});

	test("capChunk multibyte clamp never exceeds budget", () => {
		const out = capChunk(`x${"é".repeat(100)}`, 10);
		expect(Buffer.byteLength(out, "utf8")).toBeLessThanOrEqual(10);
		expect(out.startsWith("x")).toBe(true);
	});
});
