import { describe, expect, test } from "bun:test";

import { compareVersions, needsUpgrade } from "@uma/orpc-contract";

import { Store } from "../server-central/src/store.ts";
import { pinSatisfied } from "../src/config/adityab-agent.ts";

describe("semver migration", () => {
	test("1.10.0 > 1.9.0 (numeric, not lexicographic)", () => {
		expect(compareVersions("1.10.0", "1.9.0")).toBe(1);
		expect(compareVersions("1.9.0", "1.10.0")).toBe(-1);
		expect(compareVersions("1.10.0", "1.10.0")).toBe(0);
	});

	test("prerelease 1.0.0-beta < 1.0.0", () => {
		expect(compareVersions("1.0.0-beta", "1.0.0")).toBe(-1);
		expect(compareVersions("1.0.0", "1.0.0-beta")).toBe(1);
		expect(compareVersions("1.0.0-alpha", "1.0.0-beta")).toBe(-1);
	});

	test("needsUpgrade semver cases", () => {
		expect(needsUpgrade("0.9.0", "1.0.0")).toBe(true);
		expect(needsUpgrade("1.1.0", "1.0.0")).toBe(false);
		expect(needsUpgrade("1.9.0", "1.10.0")).toBe(true);
		expect(needsUpgrade("1.10.0", "1.9.0")).toBe(false);
		expect(needsUpgrade("1.0.0-beta", "1.0.0")).toBe(true);
		expect(needsUpgrade("1.0.0", "1.0.0")).toBe(false);
	});

	test('"10.1.0" does not satisfy "0.1.0" (no includes false-positive)', () => {
		expect(pinSatisfied("10.1.0", "0.1.0")).toBe(false);
		expect(pinSatisfied("0.1.0", "0.1.0")).toBe(true);
	});

	test("pinSatisfied handles prefixed output, ranges, latest", () => {
		expect(pinSatisfied("adityab-agent 0.1.0", "0.1.0")).toBe(true);
		expect(pinSatisfied("adityab-agent version 0.2.0", "0.1.0")).toBe(false);
		expect(pinSatisfied("0.1.5", "^0.1.0")).toBe(true);
		expect(pinSatisfied("0.2.0", "^0.1.0")).toBe(false);
		expect(pinSatisfied("anything-at-all", "latest")).toBe(true);
	});

	test("store isUpgradeRequired uses semver majors", () => {
		const s = new Store();
		s.minCliVersion = "1.0.0";
		expect(s.isUpgradeRequired("0.9.0")).toBe(true);
		expect(s.isUpgradeRequired("1.1.0")).toBe(false);
		expect(s.isUpgradeRequired("v0.5.0")).toBe(true);
	});
});
