import { msbPath } from "../env.ts";
import { cliDriver } from "./cli.ts";
import { mockDriver, useMock } from "./mock.ts";
import { sdkDriver } from "./sdk.ts";
import { runCli } from "./shared.ts";
import type { SandboxDriver } from "./types.ts";

let sdkAvailable: boolean | null = null;
let cliAvailable: boolean | null = null;

/** Import the native SDK once; sticky result (positive and negative). */
export async function realSdk(): Promise<typeof import("microsandbox") | null> {
	if (useMock()) return null;
	if (sdkAvailable === false) return null;
	try {
		if (msbPath()) process.env.MSB_PATH = msbPath();
		const m = (await import("microsandbox")) as typeof import("microsandbox");
		sdkAvailable = true;
		return m;
	} catch {
		sdkAvailable = false;
		return null;
	}
}

export async function cliUsable(): Promise<boolean> {
	if (useMock()) return false;
	if (cliAvailable !== null) return cliAvailable;
	try {
		const r = await runCli(["--version"], 8000);
		cliAvailable = r.code === 0;
	} catch {
		cliAvailable = false;
	}
	return cliAvailable;
}

/** Driver kind for diagnostics/tests; "unavailable" when no runtime exists. */
export async function driverKind(): Promise<
	"sdk" | "cli" | "mock" | "unavailable"
> {
	if (useMock()) return "mock";
	if (await realSdk()) return "sdk";
	if (await cliUsable()) return "cli";
	return "unavailable";
}

/**
 * Resolve the active driver. Fails closed when no runtime is installed —
 * the mock driver must never silently execute tasks on the host.
 */
export async function driver(): Promise<SandboxDriver> {
	if (useMock()) return mockDriver;
	const sdk = await realSdk();
	if (sdk) return sdkDriver(sdk);
	if (await cliUsable()) return cliDriver;
	throw new Error(
		"no sandbox runtime available (microsandbox SDK and `msb` CLI both missing); set MSB_MOCK=1 for mock mode",
	);
}
