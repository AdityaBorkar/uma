import { whichBin } from "../utils/proc.ts";
import type { CheckResult, ResetOptions, ResetResult } from "./desired.ts";
import { BaseConfigKey } from "./key.ts";

export class AgentsKey extends BaseConfigKey {
	readonly key = "agents";

	async check(): Promise<CheckResult> {
		const { corrupt, state } = this.loadDesired();
		if (corrupt) return corrupt;
		const bins = state.agents?.bins ?? [];
		if (bins.length === 0)
			return { detail: "no agents declared", drifted: false, key: this.key };
		const found = await Promise.all(
			bins.map(async (b) => ({ b, path: await whichBin(b) })),
		);
		const missing = found.filter((f) => !f.path).map((f) => f.b);
		if (missing.length > 0) {
			return {
				detail: `missing agents: ${missing.join(",")}`,
				drifted: true,
				key: this.key,
			};
		}
		return {
			detail: `agents present: ${bins.join(",")}`,
			drifted: false,
			key: this.key,
		};
	}

	async reset(opts?: ResetOptions): Promise<ResetResult> {
		const dry = await this.maybeDryRun(opts);
		if (dry) return dry;
		const c = await this.check();
		if (!c.drifted) return { changed: false, key: this.key, ok: true };
		return {
			error: `agents drifted: ${c.detail}. Install via /settings/agents instructions.`,
			key: this.key,
			ok: false,
		};
	}
}
