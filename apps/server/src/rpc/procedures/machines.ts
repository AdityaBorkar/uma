import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

import { db } from "../../db/client.ts";
import { machines } from "../../db/machines.ts";
import { assertSessionOwnsMachine } from "../../machines/auth.ts";
import { serializeHeartbeats } from "../../machines/heartbeat.ts";
import {
	claimTask,
	latestVersion as latestVersionService,
	heartbeatHistory as readHeartbeatHistory,
	sandboxList as readSandboxList,
	revokeMachine,
	resetState as sendResetState,
} from "../../machines/service.ts";
import { requireMachine, requireUser } from "../auth.ts";
import { implementer } from "../contract.ts";

/**
 * Machine-facing procedures (apiContract `machines.*`, contract-first).
 * Machine-auth uses the Bearer session from the device flow;
 * browser procedures use the cookie session. Inputs/outputs are the
 * frozen contract schemas.
 */

export const claim = implementer.machines.claim.handler(
	async ({ input, context, errors }) => {
		const sess = await requireMachine(context.headers);
		try {
			assertSessionOwnsMachine(sess, input.machineId);
		} catch {
			throw new ORPCError("FORBIDDEN", { message: "Machine mismatch" });
		}
		const startedAt = await claimTask(
			input.taskId,
			sess.machineId,
			sess.userId,
			input.sandboxId,
		);
		if (!startedAt) throw errors.CONFLICT();
		return { ok: true as const, startedAt: startedAt.getTime() };
	},
);

export const latestVersion = implementer.machines.latestVersion.handler(
	async () => latestVersionService(),
);

export const heartbeatHistory = implementer.machines.heartbeatHistory.handler(
	async ({ context }) => {
		const sess = await requireMachine(context.headers);
		const rows = await readHeartbeatHistory(sess.machineId, sess.userId);
		return { heartbeats: serializeHeartbeats(rows) };
	},
);

export const sandboxList = implementer.machines.sandboxList.handler(
	async ({ context }) => {
		const sess = await requireMachine(context.headers);
		const rows = await readSandboxList(sess.machineId, sess.userId);
		return {
			sandboxes: rows.map((r) => ({
				...r,
				updatedAt:
					r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
			})),
		};
	},
);

export const checkState = implementer.machines.checkState.handler(
	async ({ context }) => {
		await requireMachine(context.headers);
		// No server-side desired-state store yet; convergence is WS-driven.
		return { drift: [], version: "v1" };
	},
);

export const resetState = implementer.machines.resetState.handler(
	async ({ input, context }) => {
		const sess = await requireMachine(context.headers);
		const res = await sendResetState(sess.machineId, {
			keys: input.keys ?? "*",
		});
		return { jobId: res.jobId, keys: res.keys };
	},
);

// --- Browser-side machine registry (web UI, contract-first) ---

export const list = implementer.machines.list.handler(async ({ context }) => {
	const user = await requireUser(context.headers);
	return db
		.select({
			cliVersion: machines.cliVersion,
			configVersion: machines.configVersion,
			id: machines.id,
			lastSeenAt: machines.lastSeenAt,
			name: machines.name,
			status: machines.status,
		})
		.from(machines)
		.where(eq(machines.userId, user.id));
});

export const revoke = implementer.machines.revoke.handler(
	async ({ input, context, errors }) => {
		const user = await requireUser(context.headers);
		const ok = await revokeMachine(user.id, input.id);
		if (!ok) throw errors.NOT_FOUND();
		return { ok: true as const };
	},
);

export const get = implementer.machines.get.handler(
	async ({ input, context, errors }) => {
		const user = await requireUser(context.headers);
		const [row] = await db
			.select()
			.from(machines)
			.where(and(eq(machines.id, input.id), eq(machines.userId, user.id)))
			.limit(1);
		if (!row) throw errors.NOT_FOUND();
		return row;
	},
);

/**
 * Browser-readable heartbeats for one owned machine (contract-first:
 * `apiContract machines.heartbeatList`). The machine-auth twin
 * (`heartbeatHistory`) serves the daemon itself.
 */
export const heartbeatList = implementer.machines.heartbeatList.handler(
	async ({ input, context, errors }) => {
		const user = await requireUser(context.headers);
		const [m] = await db
			.select({ id: machines.id })
			.from(machines)
			.where(
				and(eq(machines.id, input.machineId), eq(machines.userId, user.id)),
			)
			.limit(1);
		if (!m) throw errors.NOT_FOUND();
		const rows = await readHeartbeatHistory(
			input.machineId,
			user.id,
			input.limit ?? 50,
		);
		return { heartbeats: serializeHeartbeats(rows) };
	},
);
