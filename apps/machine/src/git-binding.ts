import { branchForTask } from "@uma/orpc-contract";
import pRetry from "p-retry";

import { execInSandbox } from "./sandbox.ts";

export interface BindingOpts {
	branch?: string;
	commit?: string;
	defaultBranch?: string;
	repoUrl: string;
	sandboxName: string;
	taskId: string;
}

export interface BindingResult {
	branch: string;
	commit?: string;
	fresh: boolean;
	notesOnly: boolean;
}

function shQuote(s: string): string {
	return `'${s.replace(/'/g, `'\\''`)}'`;
}

async function execSh(
	sandboxName: string,
	script: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
	return execInSandbox(sandboxName, "sh", ["-c", script]);
}

async function gitPresent(sandboxName: string): Promise<boolean> {
	const probe = await execSh(
		sandboxName,
		`test -d ~/work/.git && echo ok || echo missing`,
	);
	return probe.stdout.includes("ok");
}

function fail(
	prefix: string,
	r: { code: number; stdout: string; stderr: string },
): never {
	throw new Error(`${prefix}: ${(r.stderr || r.stdout).slice(0, 500)}`);
}

/**
 * Network-bound git step (clone/fetch) with transient retry: 2 retries,
 * exponential backoff + jitter. On final failure, attributes via fail()
 * with the same prefix so error taxonomy is unchanged. Checkout/pin/reset
 * steps stay single-attempt (deterministic local failures, not transient).
 */
async function runNetworkGitStep(
	sandboxName: string,
	script: string,
	okMarker: string,
	failPrefix: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
	let last: { code: number; stdout: string; stderr: string } | null = null;
	try {
		return await pRetry(
			async () => {
				const r = await execSh(sandboxName, script);
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

async function cloneFresh(
	sandboxName: string,
	repo: string,
	branch: string,
	commit?: string,
): Promise<void> {
	// Discrete steps (not one && chain) so failures attribute to clone vs checkout vs pin.
	// Clone + fetch are network-bound and retry transient failures; checkout/pin
	// are deterministic local ops and stay single-attempt.
	let r = await runNetworkGitStep(
		sandboxName,
		`mkdir -p ~/work && git clone --filter=blob:none ${shQuote(repo)} ~/work && echo CLONED`,
		"CLONED",
		"clone failed",
	);
	r = await runNetworkGitStep(
		sandboxName,
		`cd ~/work && git fetch origin && echo FETCHED`,
		"FETCHED",
		"clone fetch failed",
	);
	r = await execSh(
		sandboxName,
		`cd ~/work && git checkout -B ${shQuote(branch)} && echo CHECKED`,
	);
	if (r.code !== 0 || !r.stdout.includes("CHECKED"))
		fail("clone checkout failed", r);
	if (commit) {
		r = await execSh(
			sandboxName,
			`cd ~/work && git reset --hard ${shQuote(commit)} && echo PINNED`,
		);
		if (r.code !== 0 || !r.stdout.includes("PINNED"))
			fail("clone pin failed", r);
	}
}

async function rebindExisting(
	sandboxName: string,
	repo: string,
	branch: string,
	base: string,
	commit?: string,
): Promise<void> {
	let r = await execSh(
		sandboxName,
		`cd ~/work && git remote set-url origin ${shQuote(repo)} && echo REMOTE`,
	);
	if (r.code !== 0 || !r.stdout.includes("REMOTE"))
		fail("binding failed (remote)", r);
	r = await runNetworkGitStep(
		sandboxName,
		`cd ~/work && git fetch origin ${shQuote(base)} && echo FETCHED`,
		"FETCHED",
		"binding failed (fetch)",
	);
	r = await execSh(
		sandboxName,
		`cd ~/work && git checkout -B ${shQuote(branch)} origin/${shQuote(base)} && echo CHECKED`,
	);
	if (r.code !== 0 || !r.stdout.includes("CHECKED"))
		fail("binding failed (checkout)", r);
	if (commit) {
		r = await execSh(
			sandboxName,
			`cd ~/work && git reset --hard ${shQuote(commit)} && echo PINNED`,
		);
		if (r.code !== 0 || !r.stdout.includes("PINNED"))
			fail("binding failed (pin)", r);
	}
}

/**
 * Ensure repo binding inside the Ubuntu sandbox via SDK exec.
 * - Empty repoUrl => notes-only (no clone).
 * - Absent => `git clone --filter=blob:none`.
 * - Present => `fetch + checkout -B task/<short>` off defaultBranch, pinned to commit.
 */
export async function ensureBinding(opts: BindingOpts): Promise<BindingResult> {
	const branch = branchForTask(opts.taskId, opts.branch);
	if (!opts.repoUrl || opts.repoUrl.trim() === "") {
		return { branch, commit: opts.commit, fresh: false, notesOnly: true };
	}
	if (!(await gitPresent(opts.sandboxName))) {
		await cloneFresh(opts.sandboxName, opts.repoUrl, branch, opts.commit);
		return { branch, commit: opts.commit, fresh: true, notesOnly: false };
	}
	await rebindExisting(
		opts.sandboxName,
		opts.repoUrl,
		branch,
		opts.defaultBranch ?? "main",
		opts.commit,
	);
	return { branch, commit: opts.commit, fresh: false, notesOnly: false };
}

/**
 * Fresh-start options: BindingOpts with repoUrl optional (no re-clone when
 * absent). Branch/defaultBranch are threaded through the re-clone path so an
 * explicit branch is never silently replaced by the task default.
 */
export type FreshStartOpts = Omit<BindingOpts, "repoUrl"> & {
	repoUrl?: string;
};

/** Fresh-start: `git clean -fdx && git reset --hard <commit>`; re-clone if .git corrupt. */
export async function freshStart(opts: FreshStartOpts): Promise<void> {
	const { sandboxName, commit, repoUrl } = opts;
	const clean = await execSh(
		sandboxName,
		`cd ~/work && git clean -fdx && echo CLEANED`,
	);
	if (clean.code !== 0 || !clean.stdout.includes("CLEANED")) {
		if (!repoUrl)
			throw new Error(
				`fresh-start failed and no repoUrl to re-clone: ${(clean.stderr || clean.stdout).slice(0, 300)}`,
			);
		await execSh(sandboxName, `rm -rf ~/work`);
		await ensureBinding({ ...opts, repoUrl });
		return;
	}
	const pin = commit ? shQuote(commit) : "";
	const r = await execSh(
		sandboxName,
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
	await execSh(sandboxName, `rm -rf ~/work`);
	await ensureBinding({ ...opts, repoUrl });
}
