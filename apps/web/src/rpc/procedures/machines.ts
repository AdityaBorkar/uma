import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

import { db } from "#/lib/db.ts";
import {
	claimTask,
	heartbeatHistory,
	latestVersion as latestVersionService,
	resetState,
	sandboxList,
} from "#/lib/machines/service.ts";
import { type RpcContext, requireMachine, requireUser } from "#/rpc/auth.ts";
import { implementer } from "#/rpc/contract.ts";
import { machines } from "#/schemas/db/machines.ts";

/**
 * Machine-facing procedures (apiContract `machines.*`, contract-first).
 * Machine-auth uses the Bearer session from the device flow;
 * browser procedures use the cookie session. Inputs/outputs are the
 * frozen contract schemas.
 */

export const claim = implementer.machines.claim.handler(
	async ({ input, context, errors }) => {
		const ctx = context as RpcContext;
		const sess = await requireMachine(ctx.headers);
		if (input.machineId !== sess.machineId) {
			throw new ORPCError("FORBIDDEN", { message: "Machine mismatch" });
		}
		const ok = await claimTask(
			input.taskId,
			sess.machineId,
			sess.userId,
			input.sandboxId,
		);
		if (!ok) throw errors.CONFLICT();
		return { ok: true as const, startedAt: Date.now() };
	},
);

export const latestVersion = implementer.machines.latestVersion.handler(
	async () => latestVersionService(),
);

export const heartbeatHistoryProc =
	implementer.machines.heartbeatHistory.handler(async ({ context }) => {
		const ctx = context as RpcContext;
		const sess = await requireMachine(ctx.headers);
		const rows = await heartbeatHistory(sess.machineId, sess.userId);
		return {
			heartbeats: rows.map((r) => ({
				...r,
				createdAt:
					r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
				ts: r.ts instanceof Date ? r.ts.toISOString() : r.ts,
			})),
		};
	});

export const sandboxListProc = implementer.machines.sandboxList.handler(
	async ({ context }) => {
		const ctx = context as RpcContext;
		const sess = await requireMachine(ctx.headers);
		const rows = await sandboxList(sess.machineId);
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
		const ctx = context as RpcContext;
		await requireMachine(ctx.headers);
		// No server-side desired-state store yet; convergence is WS-driven.
		return { drift: [], version: "v1" };
	},
);

export const resetStateProc = implementer.machines.resetState.handler(
	async ({ input, context }) => {
		const ctx = context as RpcContext;
		const sess = await requireMachine(ctx.headers);
		const res = await resetState(sess.machineId, {
			keys: input.keys ?? "*",
		});
		return { jobId: res.jobId, keys: res.keys };
	},
);

// --- Browser-side machine registry (web UI, contract-first) ---

export const list = implementer.machines.list.handler(async ({ context }) => {
	const ctx = context as RpcContext;
	const user = await requireUser(ctx.headers);
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
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const { revokeMachine } = await import("#/lib/machines/service.ts");
		const ok = await revokeMachine(user.id, input.id);
		if (!ok) throw errors.NOT_FOUND();
		return { ok: true as const };
	},
);

export const get = implementer.machines.get.handler(
	async ({ input, context, errors }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
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
 * (`heartbeatHistoryProc`) serves the daemon itself.
 */
export const heartbeatListProc = implementer.machines.heartbeatList.handler(
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
		const rows = await heartbeatHistory(
			input.machineId,
			user.id,
			input.limit ?? 50,
		);
		return {
			heartbeats: rows.map((r) => ({
				...r,
				createdAt:
					r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
				ts: r.ts instanceof Date ? r.ts.toISOString() : r.ts,
			})),
		};
	},
);
