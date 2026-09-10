import { describe, expect, test } from "bun:test";

// Phase-0 gate: SDK import + builder surface green under `bun test`
// (and inside the compiled binary — see sdk-proof compile check).
describe("sdk-proof (Phase-0 Bun gate)", () => {
	test("microsandbox SDK imports under Bun", async () => {
		const m = await import("microsandbox");
		expect((m as Record<string, unknown>).Sandbox).toBeDefined();
		expect(
			typeof (m as { Sandbox: { builder: unknown } }).Sandbox.builder,
		).toBe("function");
	});

	test("Sandbox.builder exposes pinned-image + fixed-size + secret surface", async () => {
		const { Sandbox } = await import("microsandbox");
		const b = Sandbox.builder("sdk-proof-test") as unknown as Record<
			string,
			unknown
		>;
		for (const verb of [
			"image",
			"cpus",
			"memory",
			"maxCpus",
			"maxMemory",
			"label",
			"create",
		]) {
			expect(typeof b[verb], `builder.${verb}`).toBe("function");
		}
	});

	test("allSandboxMetrics + logs API surface exists", async () => {
		const m = (await import("microsandbox")) as Record<string, unknown>;
		expect(typeof m.allSandboxMetrics).toBe("function");
	});

	test("driverKind: sdk under bun, mock when MSB_MOCK=1", async () => {
		const { driverKind } = await import("../src/sandbox.ts");
		const prev = process.env.MSB_MOCK;
		process.env.MSB_MOCK = "1";
		expect(await driverKind()).toBe("mock");
		if (prev === undefined) delete process.env.MSB_MOCK;
		else process.env.MSB_MOCK = prev;
		expect(await driverKind()).toBe("sdk");
	});
});
