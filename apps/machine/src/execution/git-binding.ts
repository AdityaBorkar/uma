import { branchForTask } from "@uma/orpc-contract";
import pRetry from "p-retry";

import { type ExecResult, Sandbox } from "../sandboxes/sandbox.ts";

export interface BindingOpts {
	branch?: string | undefined;
	commit?: string | undefined;
	defaultBranch?: string | undefined;
	repoUrl: string;
	sandboxName: string;
	taskId: string;
}

export interface BindingResult {
	branch: string;
	commit?: string | undefined;
	fresh: boolean;
	notesOnly: boolean;
}

/**
 * Fresh-start options: ensure options with repoUrl optional (no re-clone when
 * absent). Branch/defaultBranch are threaded through the re-clone path so an
 * explicit branch is never silently replaced by the task default.
 */
export type FreshStartOpts = Omit<BindingOpts, "repoUrl"> & {
	repoUrl?: string | undefined;
};

/** Ensure/fresh options minus the sandbox (carried by the RepoBinding handle). */
type EnsureOpts = Omit<BindingOpts, "sandboxName">;
type FreshOpts = Omit<FreshStartOpts, "sandboxName">;

function shQuote(s: string): string {
	return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** Attribution: same error shape across steps (prefix + first 500 chars). */
function fail(prefix: string, r: ExecResult): never {
	throw new Error(`${prefix}: ${(r.stderr || r.stdout).slice(0, 500)}`);
}

/**
 * Repo binding for one sandbox. All git work runs through `Sandbox.exec`
 * (driver-agnostic, not SDK-only). `ensure()` clones or rebinds ~/work;
 * `freshStart()` hard-resets a dirty/corrupt worktree.
 */
export class RepoBinding {
	private readonly sandbox: Sandbox;

	constructor(sandboxName: string) {
		this.sandbox = new Sandbox(sandboxName);
	}

	/**
	 * Ensure repo binding inside the sandbox.
	 * - Empty repoUrl => notes-only (no clone).
	 * - Absent => `git clone --filter=blob:none`.
	 * - Present => `fetch + checkout -B task/<short>` off defaultBranch, pinned to commit.
	 */
	async ensure(opts: EnsureOpts): Promise<BindingResult> {
		const branch = branchForTask(opts.taskId, opts.branch);
		if (!opts.repoUrl || opts.repoUrl.trim() === "") {
			return { branch, commit: opts.commit, fresh: false, notesOnly: true };
		}
		if (!(await this.gitPresent())) {
			await this.cloneFresh(opts.repoUrl, branch, opts.commit);
			return { branch, commit: opts.commit, fresh: true, notesOnly: false };
		}
		await this.rebind(
			opts.repoUrl,
			branch,
			opts.defaultBranch ?? "main",
			opts.commit,
		);
		return { branch, commit: opts.commit, fresh: false, notesOnly: false };
	}

	/** Fresh-start: `git clean -fdx && git reset --hard <commit>`; re-clone if .git corrupt. */
	async freshStart(opts: FreshOpts): Promise<void> {
		const { commit, repoUrl } = opts;
		const clean = await this.execSh(
			`cd ~/work && git clean -fdx && echo CLEANED`,
		);
		if (clean.code !== 0 || !clean.stdout.includes("CLEANED")) {
			if (!repoUrl)
				throw new Error(
					`fresh-start failed and no repoUrl to re-clone: ${(clean.stderr || clean.stdout).slice(0, 300)}`,
				);
			await this.wipeWork();
			await this.ensure({ ...opts, repoUrl });
			return;
		}
		const pin = commit ? shQuote(commit) : "";
		const r = await this.execSh(
			pin
				? `cd ~/work && git reset --hard ${pin} && echo CLEAN`
				: `cd ~/work && git reset --hard && echo CLEAN`,
		);
		if (r.code === 0 && r.stdout.includes("CLEAN")) return;
		// .git corrupt => re-clone if we have a repoUrl (branch re-derived from task).
		if (!repoUrl)
			throw new Error(
				`fresh-start failed and no repoUrl to re-clone: ${(r.stderr || r.stdout).slice(0, 300)}`,
			);
		await this.wipeWork();
		await this.ensure({ ...opts, repoUrl });
	}

	private wipeWork(): Promise<ExecResult> {
		return this.execSh(`rm -rf ~/work`);
	}

	private execSh(script: string): Promise<ExecResult> {
		return this.sandbox.exec("sh", ["-c", script]);
	}

	private async gitPresent(): Promise<boolean> {
		const probe = await this.execSh(
			`test -d ~/work/.git && echo ok || echo missing`,
		);
		return probe.stdout.includes("ok");
	}

	/**
	 * Network-bound git step (clone/fetch) with transient retry: 2 retries,
	 * exponential backoff + jitter. On final failure, attributes via fail()
	 * with the same prefix so error taxonomy is unchanged. Checkout/pin/reset
	 * steps stay single-attempt (deterministic local failures, not transient).
	 */
	private async networkStep(
		script: string,
		okMarker: string,
		failPrefix: string,
	): Promise<ExecResult> {
		let last: ExecResult | null = null;
		try {
			return await pRetry(
				async () => {
					const r = await this.execSh(script);
					last = r;
					if (r.code !== 0 || !r.stdout.includes(okMarker)) {
						throw new Error((r.stderr || r.stdout).slice(0, 500));
					}
					return r;
				},
				{
					factor: 2,
					maxTimeout: 4000,
					minTimeout: 500,
					randomize: true,
					retries: 2,
				},
			);
		} catch {
			fail(
				failPrefix,
				last ?? { code: 1, stderr: "git step failed", stdout: "" },
			);
		}
	}

	private async cloneFresh(
		repo: string,
		branch: string,
		commit?: string,
	): Promise<void> {
		// Discrete steps (not one && chain) so failures attribute to clone vs checkout vs pin.
		// Clone + fetch are network-bound and retry transient failures; checkout/pin
		// are deterministic local ops and stay single-attempt.
		let r = await this.networkStep(
			`mkdir -p ~/work && git clone --filter=blob:none ${shQuote(repo)} ~/work && echo CLONED`,
			"CLONED",
			"clone failed",
		);
		r = await this.networkStep(
			`cd ~/work && git fetch origin && echo FETCHED`,
			"FETCHED",
			"clone fetch failed",
		);
		r = await this.execSh(
			`cd ~/work && git checkout -B ${shQuote(branch)} && echo CHECKED`,
		);
		if (r.code !== 0 || !r.stdout.includes("CHECKED"))
			fail("clone checkout failed", r);
		if (commit) {
			r = await this.execSh(
				`cd ~/work && git reset --hard ${shQuote(commit)} && echo PINNED`,
			);
			if (r.code !== 0 || !r.stdout.includes("PINNED"))
				fail("clone pin failed", r);
		}
	}

	private async rebind(
		repo: string,
		branch: string,
		base: string,
		commit?: string,
	): Promise<void> {
		let r = await this.execSh(
			`cd ~/work && git remote set-url origin ${shQuote(repo)} && echo REMOTE`,
		);
		if (r.code !== 0 || !r.stdout.includes("REMOTE"))
			fail("binding failed (remote)", r);
		r = await this.networkStep(
			`cd ~/work && git fetch origin ${shQuote(base)} && echo FETCHED`,
			"FETCHED",
			"binding failed (fetch)",
		);
		r = await this.execSh(
			`cd ~/work && git checkout -B ${shQuote(branch)} origin/${shQuote(base)} && echo CHECKED`,
		);
		if (r.code !== 0 || !r.stdout.includes("CHECKED"))
			fail("binding failed (checkout)", r);
		if (commit) {
			r = await this.execSh(
				`cd ~/work && git reset --hard ${shQuote(commit)} && echo PINNED`,
			);
			if (r.code !== 0 || !r.stdout.includes("PINNED"))
				fail("binding failed (pin)", r);
		}
	}
}

// ---------------------------------------------------------------------------
// Legacy function facade — thin delegates kept for existing callers/tests.
// Prefer the RepoBinding class.
// ---------------------------------------------------------------------------

export async function ensureBinding(opts: BindingOpts): Promise<BindingResult> {
	const { sandboxName, ...rest } = opts;
	return new RepoBinding(sandboxName).ensure(rest);
}

export async function freshStart(opts: FreshStartOpts): Promise<void> {
	const { sandboxName, ...rest } = opts;
	return new RepoBinding(sandboxName).freshStart(rest);
}
