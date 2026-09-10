import { ORPCError, os } from "@orpc/server";
import { and, desc, eq, ilike, type SQL, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "#/lib/db.ts";
import { type RpcContext, requireUser } from "#/rpc/auth.ts";
import {
	afterCursor,
	assertProjectOwned,
	pageCursor,
	paginate,
} from "#/rpc/scope.ts";
import { projects, signals } from "#/schemas/db/index.ts";
import {
	SignalCreateInput,
	SignalListInput,
	SignalUpdateInput,
} from "#/schemas/schema.ts";

export const list = os
	.input(SignalListInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const q = input?.q?.trim();
		const status = input?.status;
		const severity = input?.severity;
		const limit = input?.limit ?? 20;

		const projectId = input?.projectId;
		const conditions: SQL[] = [eq(signals.userId, user.id)];
		if (projectId) {
			conditions.push(eq(signals.projectId, projectId));
		}
		if (status) {
			conditions.push(eq(signals.status, status));
		}
		if (severity) {
			conditions.push(eq(signals.severity, severity));
		}
		if (q) {
			conditions.push(ilike(signals.title, `%${q}%`));
		}

		const cursor = await pageCursor(input?.cursor, async (id) => {
			const [row] = await db
				.select({ createdAt: signals.createdAt })
				.from(signals)
				.where(and(eq(signals.id, id), eq(signals.userId, user.id)))
				.limit(1);
			return row?.createdAt;
		});

		const rows = await db
			.select({
				body: signals.body,
				createdAt: signals.createdAt,
				externalRef: signals.externalRef,
				id: signals.id,
				projectId: signals.projectId,
				projectName: projects.name,
				severity: signals.severity,
				source: signals.source,
				status: signals.status,
				title: signals.title,
				triagedAt: signals.triagedAt,
				updatedAt: signals.updatedAt,
				url: signals.url,
			})
			.from(signals)
			.leftJoin(projects, eq(signals.projectId, projects.id))
			.where(
				and(
					...conditions,
					cursor
						? afterCursor(signals.createdAt, signals.id, cursor)
						: undefined,
				),
			)
			.orderBy(desc(signals.createdAt), desc(signals.id))
			.limit(limit + 1);

		const { items, nextCursor } = paginate(rows, limit, (last) => last.id);
		return { items, nextCursor };
	});

export const stats = os
	.input(z.object({ projectId: z.string().optional() }).optional())
	.handler(async ({ context, input }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const conditions: SQL[] = [eq(signals.userId, user.id)];
		if (input?.projectId) {
			conditions.push(eq(signals.projectId, input.projectId));
		}
		const rows = await db
			.select({ count: sql<number>`count(*)::int`, status: signals.status })
			.from(signals)
			.where(and(...conditions))
			.groupBy(signals.status);
		const byStatus = new Map(rows.map((r) => [r.status, r.count]));
		return {
			dismissed: byStatus.get("dismissed") ?? 0,
			new: byStatus.get("new") ?? 0,
			triaged: byStatus.get("triaged") ?? 0,
		};
	});

export const get = os
	.input(z.object({ id: z.string() }))
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const [row] = await db
			.select()
			.from(signals)
			.where(and(eq(signals.id, input.id), eq(signals.userId, user.id)))
			.limit(1);
		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: "Signal not found" });
		}
		return row;
	});

export const create = os
	.input(SignalCreateInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		if (input.projectId) {
			await assertProjectOwned(input.projectId, user.id);
		}
		const id = crypto.randomUUID();
		const [row] = await db
			.insert(signals)
			.values({
				body: input.body ?? null,
				id,
				projectId: input.projectId ?? null,
				severity: input.severity ?? "info",
				// Ingestion sources arrive later; v1 writes manual captures only.
				source: "manual",
				status: "new",
				title: input.title,
				url: input.url ?? null,
				userId: user.id,
			})
			.returning();
		if (!row) {
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
		return row;
	});

export const update = os
	.input(SignalUpdateInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const [existing] = await db
			.select()
			.from(signals)
			.where(and(eq(signals.id, input.id), eq(signals.userId, user.id)))
			.limit(1);
		if (!existing) {
			throw new ORPCError("NOT_FOUND", { message: "Signal not found" });
		}

		const patch: Partial<typeof signals.$inferInsert> = {};
		if (input.title !== undefined) {
			patch.title = input.title;
		}
		if (input.body !== undefined) {
			patch.body = input.body ?? null;
		}
		if (input.url !== undefined) {
			patch.url = input.url ?? null;
		}
		if (input.severity !== undefined) {
			patch.severity = input.severity;
		}
		if (input.projectId !== undefined) {
			if (input.projectId) {
				await assertProjectOwned(input.projectId, user.id);
			}
			patch.projectId = input.projectId ?? null;
		}

		// Guarded lifecycle: new → triaged|dismissed, triaged → dismissed.
		if (input.status !== undefined && input.status !== existing.status) {
			const allowed =
				(existing.status === "new" &&
					(input.status === "triaged" || input.status === "dismissed")) ||
				(existing.status === "triaged" && input.status === "dismissed");
			if (!allowed) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Cannot move signal from ${existing.status} to ${input.status}`,
				});
			}
			patch.status = input.status;
			if (input.status === "triaged") {
				patch.triagedAt = new Date();
			}
		}

		if (Object.keys(patch).length === 0) {
			return existing;
		}

		const [updated] = await db
			.update(signals)
			.set({ ...patch, updatedAt: new Date() })
			.where(eq(signals.id, input.id))
			.returning();
		if (!updated) {
			throw new ORPCError("NOT_FOUND");
		}
		return updated;
	});
