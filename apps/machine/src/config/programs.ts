import { coerce, satisfies, valid } from "semver";

import { msbBin } from "../utils/env.ts";
import { runCapture, whichBin } from "../utils/proc.ts";
import type { CheckResult, ResetOptions, ResetResult } from "./desired.ts";
import { BaseConfigKey } from "./key.ts";

export class ProgramsKey extends BaseConfigKey {
	readonly key = "programs";

	/** Check msb doctor + version + required bins + SDK import. */
	async check(): Promise<CheckResult> {
		const { corrupt, state } = this.loadDesired();
		if (corrupt) return corrupt;
		const bins: string[] = state.programs?.bins ?? ["git", "gh", "bun"];
		const bin = msbBin();
		// All probes are independent: N `which` + msb version + doctor + SDK import.
		const [found, versionOut, doctorOut, sdkProbe] = await Promise.all([
			Promise.all(bins.map(async (b) => ({ b, path: await whichBin(b) }))),
			runCapture(bin, ["--version"], 8000),
			runCapture(bin, ["doctor"], 8000),
			import("microsandbox")
				.then((m) => ({
					error: "",
					ok: typeof (m as Record<string, unknown>).Sandbox !== "undefined",
				}))
				.catch((e) => ({
					error: e instanceof Error ? e.message : String(e),
					ok: false,
				})),
		]);
		const missing = found.filter((f) => !f.path).map((f) => f.b);
		// msb runtime check
		const msbMissing = versionOut?.code !== 0;
		// SDK import check (Bun compat gate). The compiled single-file binary cannot
		// bundle the SDK's native .cjs, so it uses the system `msb` CLI fallback
		// (see ADR 0003) — SDK failure + CLI success is healthy, not drift.
		const { error: sdkError, ok: sdkOk } = sdkProbe;
		const cliOk = !msbMissing; // msb --version already probed above
		const runtimeOk = sdkOk || cliOk;
		// Enforce desired.programs.msbVersion when present.
		let msbVersionMismatch: string | null = null;
		const wantMsb = state.programs?.msbVersion;
		if (wantMsb && !msbMissing) {
			const raw = (
				(versionOut?.stdout || "") +
				"\n" +
				(versionOut?.stderr || "")
			).trim();
			const v = valid(raw) ?? coerce(raw)?.version ?? null;
			let ok: boolean;
			if (v) {
				try {
					ok = satisfies(v, wantMsb);
				} catch {
					ok = raw.includes(wantMsb);
				}
			} else {
				ok = raw.includes(wantMsb);
			}
			if (!ok)
				msbVersionMismatch = `msb version '${raw.slice(0, 100)}' != desired '${wantMsb}'`;
		}
		const drifted =
			missing.length > 0 ||
			msbMissing ||
			(!msbMissing && doctorOut?.code !== 0) ||
			!runtimeOk ||
			msbVersionMismatch !== null;
		const parts: string[] = [];
		if (missing.length > 0) parts.push(`missing bins: ${missing.join(",")}`);
		if (msbMissing) parts.push(`msb runtime missing (${bin} --version failed)`);
		else if (doctorOut?.code !== 0)
			parts.push(
				`msb doctor non-zero: ${(doctorOut?.stderr || "").slice(0, 200)}`,
			);
		if (!runtimeOk)
			parts.push(`microsandbox SDK import failed: ${sdkError.slice(0, 200)}`);
		else if (!sdkOk && cliOk)
			parts.push(`note: SDK unavailable, using system msb CLI fallback`);
		if (msbVersionMismatch) parts.push(msbVersionMismatch);
		if (!drifted)
			return { detail: "all programs ok", drifted: false, key: this.key };
		return { detail: parts.join("; "), drifted: true, key: this.key };
	}

	async reset(opts?: ResetOptions): Promise<ResetResult> {
		if (opts?.dryRun) {
			const c = await this.check();
			return {
				changed: c.drifted,
				error: c.drifted ? `would converge: ${c.detail}` : undefined,
				key: this.key,
				ok: true,
			};
		}
		// Converge = verify; actual installs are system-level and reported as error
		// with remediation rather than silently curl-piping.
		const c = await this.check();
		if (!c.drifted) return { changed: false, key: this.key, ok: true };
		// Attempt Ubuntu pre-pull best-effort if msb exists.
		const bin = msbBin();
		const v = await runCapture(bin, ["--version"], 5000);
		if (v?.code !== 0) {
			return {
				error:
					`programs drifted: ${c.detail}. Remediation: install msb runtime ` +
					`(see install.sh / install.microsandbox.dev) then re-run sync.`,
				key: this.key,
				ok: false,
			};
		}
		return {
			error: `programs drifted: ${c.detail}. Automatic install not attempted (system install required).`,
			key: this.key,
			ok: false,
		};
	}
}
