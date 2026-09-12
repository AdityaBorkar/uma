import { describe, expect, test } from "bun:test";

import { effectiveLimits, quotaDefaultsFromRam } from "@uma/orpc-contract";

import { isQuotaError, quotaPreCheck } from "../src/sandboxes/sandbox.ts";

describe("quota (2x/5x defaults + server override)", () => {
	test("defaults computed from RAM: 2x/5x per GB, floor 1", () => {
		expect(quotaDefaultsFromRam(4)).toEqual({ maxRunning: 8, maxTotal: 20 });
		expect(quotaDefaultsFromRam(1)).toEqual({ maxRunning: 2, maxTotal: 5 });
		expect(quotaDefaultsFromRam(0)).toEqual({ maxRunning: 2, maxTotal: 5 });
		expect(quotaDefaultsFromRam(16)).toEqual({ maxRunning: 32, maxTotal: 80 });
	});

	test("effective = server override ?? limits.json", () => {
		const defaults = quotaDefaultsFromRam(4);
		expect(effectiveLimits(defaults, null)).toEqual(defaults);
		expect(effectiveLimits(defaults, { maxRunning: 1, maxTotal: 1 })).toEqual({
			cpu: undefined,
			maxRunning: 1,
			maxTotal: 1,
			ram: undefined,
		});
	});

	test("pre-check refuses over-limit assign with QUOTA_EXCEEDED", () => {
		const limits = { maxRunning: 2, maxTotal: 5 };
		expect(() => quotaPreCheck(1, 1, limits)).not.toThrow();
		try {
			quotaPreCheck(2, 1, limits);
			expect(false).toBe(true);
		} catch (e) {
			expect(isQuotaError(e)).toBe(true);
		}
		try {
			quotaPreCheck(0, 5, limits);
			expect(false).toBe(true);
		} catch (e) {
			expect(isQuotaError(e)).toBe(true);
		}
	});
});
