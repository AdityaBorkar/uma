import { fingerprint } from "../execution/redact.ts";
import { getProviderKeys, setProviderKey, withDb } from "../utils/db.ts";
import { stateDbPath } from "../utils/env.ts";
import type { CheckResult, ResetOptions, ResetResult } from "./desired.ts";
import { BaseConfigKey } from "./key.ts";

export interface ProviderPush {
	key: string;
	provider: string;
}

export class ProvidersKey extends BaseConfigKey {
	readonly key = "providers";

	/**
	 * Check reachability + stored fingerprint vs desired fingerprint.
	 * Never compares or prints secrets.
	 */
	async check(): Promise<CheckResult> {
		const { corrupt, state } = this.loadDesired();
		if (corrupt) return corrupt;
		const want = state.providers?.providers ?? [];
		if (want.length === 0)
			return { detail: "no providers declared", drifted: false, key: this.key };
		let stored: Map<string, string>;
		try {
			stored = withDb(stateDbPath(), true, (db) => {
				return new Map(
					getProviderKeys(db).map((r) => [r.provider, r.fingerprint]),
				);
			});
		} catch (e) {
			return {
				detail: `state.db unreadable: ${e instanceof Error ? e.message : String(e)}`,
				drifted: true,
				key: this.key,
			};
		}
		const drifted: string[] = [];
		for (const w of want) {
			const have = stored.get(w.provider);
			if (!have) drifted.push(`${w.provider}: missing`);
			else if (have !== w.fingerprint)
				drifted.push(`${w.provider}: fingerprint mismatch`);
		}
		if (drifted.length === 0)
			return { detail: "fingerprints match", drifted: false, key: this.key };
		return { detail: drifted.join("; "), drifted: true, key: this.key };
	}

	/** Write full key material from reset-config payload into provider_keys (0600). */
	async reset(opts?: ResetOptions): Promise<ResetResult> {
		const payload = (opts?.payload ?? {}) as {
			keys?: ProviderPush[];
		};
		const keys = payload.keys ?? [];
		if (keys.length === 0) {
			// No payload: just report check state (converge requires full-keys push).
			const dry = await this.maybeDryRun(opts);
			if (dry) return dry;
			const c = await this.check();
			if (!c.drifted) return { changed: false, key: this.key, ok: true };
			return {
				error: `providers drifted: ${c.detail}. Need full-keys reset-config payload to converge.`,
				key: this.key,
				ok: false,
			};
		}
		if (opts?.dryRun) return { changed: true, key: this.key, ok: true };
		try {
			withDb(stateDbPath(), false, (db) => {
				for (const k of keys) {
					if (!k.provider || !k.key) continue;
					setProviderKey(
						db,
						k.provider,
						fingerprint(k.key),
						k.key,
						Date.now(),
					);
				}
			});
			return { changed: true, key: this.key, ok: true };
		} catch (e) {
			return {
				error: e instanceof Error ? e.message : String(e),
				key: this.key,
				ok: false,
			};
		}
	}
}

/** Export provider secrets as host env for --secret NAME@HOST refs (never argv/config). */
export function exportProviderEnv(
	dbSecrets: { provider: string; secret: string }[],
): void {
	for (const { provider, secret } of dbSecrets) {
		process.env[hostVarFor(provider)] = secret;
	}
}

export function hostVarFor(provider: string): string {
	return `MSB_SECRET_${provider.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

export function secretRefFor(provider: string): string {
	return `${provider.toUpperCase()}@${hostVarFor(provider)}`;
}

// ---------------------------------------------------------------------------
// Secret specs (--secret NAME@HOST refs)
//
// The msb runtime resolves each secret's VALUE from the host env var at
// sandbox start and stores only the source reference (never inlined in config
// or argv; inline NAME=VALUE@HOST is rejected). Guest processes see the key
// as `guestVar`, and egress to non-allowed hosts is blocked.
// ---------------------------------------------------------------------------

export interface SecretSpec {
	/** Guest-side env var visible inside the sandbox. */
	guestVar: string;
	/** Allowed egress hosts for this secret. */
	hosts: string[];
	/** Host-side env var holding the value (exported via exportProviderEnv). */
	hostVar: string;
	/** Raw value (SDK path only; passed in-process, never argv/config). */
	value: string;
}

/** Known provider -> guest var + allowed egress hosts. */
export const PROVIDER_CATALOG: Record<
	string,
	{ guestVar: string; hosts: string[] }
> = {
	anthropic: { guestVar: "ANTHROPIC_API_KEY", hosts: ["api.anthropic.com"] },
	cohere: { guestVar: "CO_API_KEY", hosts: ["api.cohere.ai"] },
	deepseek: { guestVar: "DEEPSEEK_API_KEY", hosts: ["api.deepseek.com"] },
	gemini: {
		guestVar: "GEMINI_API_KEY",
		hosts: ["generativelanguage.googleapis.com"],
	},
	github: { guestVar: "GH_TOKEN", hosts: ["api.github.com"] },
	google: {
		guestVar: "GEMINI_API_KEY",
		hosts: ["generativelanguage.googleapis.com"],
	},
	mistral: { guestVar: "MISTRAL_API_KEY", hosts: ["api.mistral.ai"] },
	openai: { guestVar: "OPENAI_API_KEY", hosts: ["api.openai.com"] },
	openrouter: { guestVar: "OPENROUTER_API_KEY", hosts: ["openrouter.ai"] },
	xai: { guestVar: "XAI_API_KEY", hosts: ["api.x.ai"] },
};

/**
 * Build --secret specs for stored keys. Unknown providers have no
 * allowed-hosts catalog entry and are SKIPPED (fail-closed: the key stays
 * stored but is never injected). Add a catalog entry to enable them.
 */
export function buildSecretSpecs(
	keys: { provider: string; secret: string }[],
): SecretSpec[] {
	const out: SecretSpec[] = [];
	for (const k of keys) {
		const entry = PROVIDER_CATALOG[k.provider.toLowerCase()];
		if (!entry || entry.hosts.length === 0) {
			console.error(
				`warn: provider '${k.provider}' has no allowed-hosts catalog entry; key stored but not injected`,
			);
			continue;
		}
		out.push({
			guestVar: entry.guestVar,
			hosts: entry.hosts,
			hostVar: hostVarFor(k.provider),
			value: k.secret,
		});
	}
	return out;
}
