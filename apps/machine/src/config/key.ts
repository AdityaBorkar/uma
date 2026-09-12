import type { CheckResult, ResetOptions, ResetResult } from "./desired.ts";
import { loadDesiredResult, type DesiredState } from "./desired.ts";

/**
 * Uniform contract for one §7 config key. The ordered registry in mod.ts
 * drives check/reset/sync over instances of these classes.
 */
export interface ConfigKey {
	check(): Promise<CheckResult>;
	readonly key: string;
	reset(opts?: ResetOptions): Promise<ResetResult>;
}

export abstract class BaseConfigKey implements ConfigKey {
	abstract check(): Promise<CheckResult>;

	abstract readonly key: string;

	abstract reset(opts?: ResetOptions): Promise<ResetResult>;

	/**
	 * Shared dry-run gate: returns a ResetResult when opts.dryRun is set
	 * (caller must return it), else null to continue converging.
	 */
	protected async maybeDryRun(
		opts: ResetOptions | undefined,
		extra?: Partial<ResetResult>,
	): Promise<ResetResult | null> {
		if (!opts?.dryRun) return null;
		const c = await this.check();
		return { changed: c.drifted, key: this.key, ok: true, ...extra };
	}

	/**
	 * Load the desired cache with the shared corrupt gate: `corrupt` is a
	 * failed CheckResult when desired.json is unreadable (caller must return
	 * it instead of converging from garbage), else null.
	 */
	protected loadDesired(): {
		corrupt: CheckResult | null;
		state: DesiredState;
	} {
		const loaded = loadDesiredResult();
		if (loaded.status === "corrupt") {
			return {
				corrupt: {
					detail: `desired.json corrupt: ${loaded.error ?? "unreadable"}`,
					drifted: true,
					key: this.key,
				},
				state: loaded.state,
			};
		}
		return { corrupt: null, state: loaded.state };
	}
}
