import { describe, expect, test } from "bun:test";

import { collectPids, evaluateScopeHint } from "../src/heartbeat.ts";

describe("pressure rule (90%/10min + 60% attribution + cooldown)", () => {
	test("no breach => no hint", () => {
		const r = evaluateScopeHint(10, 20, []);
		expect(r.breached).toBe(false);
		expect(r.scopeHint).toBeNull();
	});

	test("attributable (one sandbox >60%) => scoped hint", () => {
		const r = evaluateScopeHint(95, 30, [
			{ cpu: 80, disk: 10, id: "sbx1", projectId: "proj_1" },
		]);
		expect(r.breached).toBe(true);
		expect(r.scopeHint).toBe("proj_1");
	});

	test("host-global => null hint", () => {
		const r = evaluateScopeHint(95, 30, [
			{ cpu: 10, disk: 5, id: "sbx1", projectId: "proj_1" },
			{ cpu: 10, disk: 5, id: "sbx2", projectId: "proj_2" },
		]);
		expect(r.breached).toBe(true);
		expect(r.scopeHint).toBeNull();
	});

	test("disk pressure attributable => scoped", () => {
		const r = evaluateScopeHint(20, 95, [
			{ cpu: 5, disk: 80, id: "sbx1", projectId: "proj_9" },
		]);
		expect(r.scopeHint).toBe("proj_9");
	});

	test("attribution picks the linear max (no sort, no copy)", () => {
		// Tie/ordering: first max wins, matching the old sort()[0] result.
		const r = evaluateScopeHint(95, 95, [
			{ cpu: 1, disk: 1, id: "small", projectId: "p_small" },
			{ cpu: 80, disk: 80, id: "big", projectId: "p_big" },
			{ cpu: 2, disk: 2, id: "mid", projectId: "p_mid" },
		]);
		expect(r.scopeHint).toBe("p_big");
		const empty = evaluateScopeHint(95, 30, []);
		expect(empty).toEqual({ breached: true, scopeHint: null });
	});
});

describe("collectPids (uniq dedup)", () => {
	test("filters non-positive/non-integer, dedups, caps at 256", () => {
		expect(collectPids([1, 2, 2, 3, -1, 0, 1.5, NaN])).toEqual([1, 2, 3]);
		const many = Array.from({ length: 300 }, (_, i) => i + 1);
		const capped = collectPids(many);
		expect(capped.length).toBe(256);
		expect(capped[0]).toBe(1);
		expect(capped[255]).toBe(256);
	});
});
