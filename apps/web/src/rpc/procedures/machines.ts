import { ORPCError, os } from "@orpc/server";
import {
	CheckStateResponseSchema,
	HeartbeatHistoryResponseSchema,
	LatestVersionResponseSchema,
	ResetStateRequestSchema,
	ResetStateResponseSchema,
	SandboxListResponseSchema,
	TaskClaimRequestSchema,
	TaskClaimResponseSchema,
} from "@uma/orpc-contract";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

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
 * Machine-facing procedures (apiContract `machines.*`).
 * Auth is the machine Bearer session from the device flow — not the browser
 * cookie session. Inputs/outputs are the frozen contract schemas.
 */

export const claim = os
	.input(TaskClaimRequestSchema)
	.output(TaskClaimResponseSchema)
	.errors({ CONFLICT: {} })
	.handler(async ({ input, context, errors }) => {
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
	});

export const latestVersion = os
	.output(LatestVersionResponseSchema)
	.handler(async () => latestVersionService());

export const heartbeatHistoryProc = os
	.output(HeartbeatHistoryResponseSchema)
	.handler(async ({ context }) => {
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

export const sandboxListProc = os
	.output(SandboxListResponseSchema)
	.handler(async ({ context }) => {
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
	});

export const checkState = os
	.output(CheckStateResponseSchema)
	.handler(async ({ context }) => {
		const ctx = context as RpcContext;
		await requireMachine(ctx.headers);
		// No server-side desired-state store yet; convergence is WS-driven.
		return { drift: [], version: "v1" };
	});

export const resetStateProc = os
	.input(ResetStateRequestSchema)
	.output(ResetStateResponseSchema)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const sess = await requireMachine(ctx.headers);
		const res = await resetState(sess.machineId, {
			keys: input.keys ?? "*",
		});
		return { jobId: res.jobId, keys: res.keys };
	});

// --- Browser-side machine registry (web UI, not part of the wire contract) ---

export const list = os.handler(async ({ context }) => {
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

export const revoke = os
	.input(z.object({ id: z.string().min(1) }))
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const { revokeMachine } = await import("#/lib/machines/service.ts");
		const ok = await revokeMachine(user.id, input.id);
		if (!ok) throw new ORPCError("NOT_FOUND", { message: "Machine not found" });
		return { ok: true as const };
	});

export const get = os
	.input(z.object({ id: z.string().min(1) }))
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const [row] = await db
			.select()
			.from(machines)
			.where(and(eq(machines.id, input.id), eq(machines.userId, user.id)))
			.limit(1);
		if (!row)
			throw new ORPCError("NOT_FOUND", { message: "Machine not found" });
		return row;
	});

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
