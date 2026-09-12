import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

import {
	DeviceCodeResponseSchema,
	DeviceTokenErrorSchema,
	DeviceTokenResponseSchema,
	MachineNameSchema,
	quotaDefaultsFromRam,
} from "@uma/orpc-contract";
import ms from "ms";
import pRetry from "p-retry";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

import { writeUnitFile } from "../config/systemd.ts";
import { migrate } from "../utils/db.ts";
import { identityPath, limitsPath, stateDbPath } from "../utils/env.ts";
import { ensureParentDir, saveJson0600 } from "../utils/fs-utils.ts";

export const IdentitySchema = z.object({
	enrolledAt: z.number().int(),
	machineId: z.string().min(1),
	machineName: z.string().optional(),
	serverUrl: z.string().min(1),
	sessionToken: z.string().min(1),
});
export type Identity = z.infer<typeof IdentitySchema>;

export const LimitsFileSchema = z.object({
	computedAt: z.number().int(),
	maxRunning: z.number().int().min(1),
	maxTotal: z.number().int().min(1),
	ramGB: z.number(),
	source: z.string(),
});
export type LimitsFile = z.infer<typeof LimitsFileSchema>;

export function loadIdentity(): Identity | null {
	const p = identityPath();
	if (!existsSync(p)) return null;
	try {
		const raw = readFileSync(p, "utf8");
		const parsed = IdentitySchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

export function saveIdentity(id: Identity): void {
	saveJson0600(identityPath(), id);
}

export function loadLimits(): LimitsFile | null {
	const p = limitsPath();
	if (!existsSync(p)) return null;
	try {
		const raw = readFileSync(p, "utf8");
		const parsed = LimitsFileSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

export function saveLimits(l: LimitsFile): void {
	saveJson0600(limitsPath(), l);
}

export async function probeRamGB(): Promise<number> {
	try {
		const meminfo = await readFile("/proc/meminfo", "utf8");
		const m = meminfo.match(/MemTotal:\s+(\d+)\s+kB/);
		if (m?.[1]) {
			const kb = parseInt(m[1], 10);
			return Math.max(1, Math.round(kb / 1024 / 1024));
		}
	} catch {
		// fall through (macOS / containers without /proc)
	}
	// Fallback: 4GB default so 2x/5x math stays testable.
	return z.coerce.number().int().min(1).catch(4).parse(process.env.UMA_RAM_GB);
}

export interface EnrollOptions {
	clientId?: string | undefined;
	machineName?: string | undefined;
	pollTimeoutMs?: number | undefined;
	server: string;
	writeSystemd?: boolean | undefined;
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

// Poll-loop hardening constants (device-token flow).
const TOKEN_FETCH_TIMEOUT_MS = 10_000;
const MAX_INTERVAL_MS = 30_000;

/** Jittered delay: 50–100% of base (same shape as ws-client jitter). */
function jitteredDelay(ms: number): number {
	return Math.floor(ms * (0.5 + Math.random() * 0.5));
}

export async function enroll(opts: EnrollOptions): Promise<Identity> {
	const server = opts.server.replace(/\/$/, "");
	const clientId = opts.clientId ?? "uma-machine";
	const machineName = opts.machineName;

	// Client-side name validation (mirror of server slug.ts RESERVED list).
	if (machineName !== undefined) {
		const v = MachineNameSchema.safeParse(machineName);
		if (!v.success) {
			throw new Error(
				`invalid machine name '${machineName}': ${fromZodError(v.error).message}`,
			);
		}
	}

	// 1. device.code
	const codeRes = await fetch(`${server}/device/code`, {
		body: JSON.stringify({
			client_id: clientId,
			scope: "machine:heartbeat machine:claim machine:logs",
			...(machineName ? { machineName } : {}),
		}),
		headers: { "content-type": "application/json" },
		method: "POST",
		signal: AbortSignal.timeout(TOKEN_FETCH_TIMEOUT_MS),
	});
	if (!codeRes.ok) {
		throw new Error(`device.code failed: HTTP ${codeRes.status}`);
	}
	const codeJson = await codeRes.json();
	const code = DeviceCodeResponseSchema.parse(codeJson);

	console.log(`\nApprove this machine in your browser:\n`);
	console.log(`  Code: ${code.user_code}`);
	console.log(`  URL:  ${code.verification_uri_complete}`);
	console.log(`\nWaiting for approval (polling every ${code.interval}s)...\n`);

	// 2. poll device.token (deadline = explicit pollTimeoutMs ?? expires_in).
	// authorization_pending/slow_down/expired_token/access_denied semantics
	// preserved; slow_down still +=5000 (capped) with jitter on the sleep.
	// Individual token-fetch attempts retry transient network/5xx via p-retry
	// (400-level OAuth responses return normally for the poll logic below);
	// each fetch aborts after TOKEN_FETCH_TIMEOUT_MS.
	const deadline =
		Date.now() + (opts.pollTimeoutMs ?? code.expires_in * ms("1s"));
	let intervalMs = Math.max(ms("1s"), code.interval * ms("1s"));
	let token: z.infer<typeof DeviceTokenResponseSchema> | null = null;
	for (;;) {
		if (Date.now() > deadline)
			throw new Error("device flow expired (expired_token)");
		await sleep(jitteredDelay(Math.min(MAX_INTERVAL_MS, intervalMs)));
		if (Date.now() > deadline)
			throw new Error("device flow expired (expired_token)");
		const tokRes = await pRetry(
			async () => {
				const r = await fetch(`${server}/device/token`, {
					body: JSON.stringify({
						client_id: clientId,
						device_code: code.device_code,
						grant_type: "urn:ietf:params:oauth:grant-type:device_code",
					}),
					headers: { "content-type": "application/json" },
					method: "POST",
					signal: AbortSignal.timeout(TOKEN_FETCH_TIMEOUT_MS),
				});
				// Retry transient 5xx; 400-level OAuth errors (authorization_pending,
				// slow_down, expired_token, access_denied) are normal poll states.
				if (r.status >= 500)
					throw new Error(`device.token transient: HTTP ${r.status}`);
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
		const tokJson = await tokRes.json().catch(() => ({}));
		if (tokRes.ok) {
			token = DeviceTokenResponseSchema.parse(tokJson);
			break;
		}
		const err = DeviceTokenErrorSchema.safeParse(tokJson);
		const code_err = err.success ? err.data.error : "unknown";
		if (code_err === "authorization_pending") continue;
		if (code_err === "slow_down") {
			intervalMs = Math.min(MAX_INTERVAL_MS, intervalMs + 5000);
			continue;
		}
		if (code_err === "expired_token")
			throw new Error("device flow expired (expired_token)");
		if (code_err === "access_denied")
			throw new Error("enrollment denied by user (access_denied)");
		throw new Error(
			`device.token failed: HTTP ${tokRes.status} ${JSON.stringify(tokJson).slice(0, 200)}`,
		);
	}
	if (!token) throw new Error("device flow failed with no token");

	// 3. persist identity (0600) + limits.json (RAM probe 2x/5x) + init SQLite
	const identity: Identity = {
		enrolledAt: Date.now(),
		machineId: token.machine_id,
		serverUrl: server,
		sessionToken: token.access_token,
		...(machineName ? { machineName } : {}),
	};
	ensureParentDir(identityPath());
	ensureParentDir(stateDbPath());
	saveIdentity(identity);
	const ramGB = await probeRamGB();
	const defaults = quotaDefaultsFromRam(ramGB);
	saveLimits({
		computedAt: Date.now(),
		maxRunning: defaults.maxRunning,
		maxTotal: defaults.maxTotal,
		ramGB,
		source: "install-probe",
	});
	migrate(stateDbPath());

	console.log(
		`\nEnrolled machine ${identity.machineId} (RAM ${ramGB}GB -> maxRunning=${defaults.maxRunning} maxTotal=${defaults.maxTotal})`,
	);
	console.log(`Identity: ${identityPath()} (0600)`);
	console.log(`Limits:   ${limitsPath()}`);
	console.log(`DB:       ${stateDbPath()}`);

	if (opts.writeSystemd) {
		const p = writeUnitFile();
		console.log(`\nSystemd unit written to ${p}. Then run:`);
		console.log(`  loginctl enable-linger`);
		console.log(
			`  systemctl --user daemon-reload && systemctl --user enable --now uma-machine`,
		);
	} else {
		console.log(
			`\nTo autostart: uma-machine enroll --systemd (writes unit + enable-linger)`,
		);
	}
	return identity;
}
