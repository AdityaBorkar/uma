import { msbPath } from "../../utils/env.ts";
import { MsbCliDriver } from "./cli.ts";
import { MsbMockDriver, useMock } from "./mock.ts";
import { MsbSdkDriver } from "./sdk.ts";
import { runCli } from "./shared.ts";
import type { SandboxDriver } from "./types.ts";

export type DriverKind = "sdk" | "cli" | "mock" | "unavailable";

/**
 * Resolves the active SandboxDriver (SDK → CLI → mock) and owns the sticky
 * availability probes. Instance state (not module state) so tests can get a
 * fresh selector or `reset()` between env changes.
 *
 * Fails closed when no runtime is installed — the mock driver must never
 * silently execute tasks on the host.
 */
export class DriverSelector {
	private sdkAvailable: boolean | null = null;
	private cliAvailable: boolean | null = null;
	private cliDriver: MsbCliDriver | null = null;
	private mockDriver: MsbMockDriver | null = null;

	/** Forget probed availability (new runtimes installed, env toggled). */
	reset(): void {
		this.sdkAvailable = null;
		this.cliAvailable = null;
	}

	/** Import the native SDK once; sticky result (positive and negative). */
	private async realSdk(): Promise<typeof import("microsandbox") | null> {
		if (useMock()) return null;
		if (this.sdkAvailable === false) return null;
		try {
			if (msbPath()) process.env.MSB_PATH = msbPath();
			const m = (await import("microsandbox")) as typeof import("microsandbox");
			this.sdkAvailable = true;
			return m;
		} catch {
			this.sdkAvailable = false;
			return null;
		}
	}

	private async cliUsable(): Promise<boolean> {
		if (useMock()) return false;
		if (this.cliAvailable !== null) return this.cliAvailable;
		try {
			const r = await runCli(["--version"], 8000);
			this.cliAvailable = r.code === 0;
		} catch {
			this.cliAvailable = false;
		}
		return this.cliAvailable;
	}

	/** Driver kind for diagnostics/tests; "unavailable" when no runtime exists. */
	async kind(): Promise<DriverKind> {
		if (useMock()) return "mock";
		if (await this.realSdk()) return "sdk";
		if (await this.cliUsable()) return "cli";
		return "unavailable";
	}

	async resolve(): Promise<SandboxDriver> {
		if (useMock()) {
			this.mockDriver ??= new MsbMockDriver();
			return this.mockDriver;
		}
		const sdk = await this.realSdk();
		if (sdk) return new MsbSdkDriver(sdk);
		if (await this.cliUsable()) {
			this.cliDriver ??= new MsbCliDriver();
			return this.cliDriver;
		}
		throw new Error(
			"no sandbox runtime available (microsandbox SDK and `msb` CLI both missing); set MSB_MOCK=1 for mock mode",
		);
	}
}

/** Process-wide selector used by the Sandbox handle and daemon wiring. */
export const defaultSelector = new DriverSelector();
