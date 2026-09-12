import { ORPCError, os } from "@orpc/server";
import { and, eq, ilike } from "drizzle-orm";
import { z } from "zod";

import { db } from "#/lib/db.ts";
import { type RpcContext, requireUser } from "#/rpc/auth.ts";
import { commands } from "#/schemas/db/commands.ts";
import {
	CommandCreateInput,
	CommandListInput,
	CommandUpdateInput,
} from "#/schemas/schema.ts";

/** User-owned OpenCode-style slash commands (`/name`). No built-ins seeded. */

export const list = os
	.input(CommandListInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const q = input?.q?.trim();
		return db
			.select()
			.from(commands)
			.where(
				and(
					eq(commands.userId, user.id),
					q ? ilike(commands.name, `%${q}%`) : undefined,
				),
			)
			.orderBy(commands.name);
	});

export const get = os
	.input(z.object({ id: z.string() }))
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const [row] = await db
			.select()
			.from(commands)
			.where(and(eq(commands.id, input.id), eq(commands.userId, user.id)))
			.limit(1);
		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: "Command not found" });
		}
		return row;
	});

export const create = os
	.input(CommandCreateInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const name = input.name.trim().toLowerCase();
		const [existing] = await db
			.select({ id: commands.id })
			.from(commands)
			.where(and(eq(commands.userId, user.id), eq(commands.name, name)))
			.limit(1);
		if (existing) {
			throw new ORPCError("CONFLICT", {
				message: "A command with this name exists",
			});
		}
		const [row] = await db
			.insert(commands)
			.values({
				agent: input.agent?.trim() ? input.agent.trim() : null,
				description: input.description?.trim() ?? "",
				id: crypto.randomUUID(),
				model: input.model?.trim() ? input.model.trim() : null,
				name,
				subtask: input.subtask ?? false,
				template: input.template,
				userId: user.id,
			})
			.returning();
		if (!row) {
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
		return row;
	});

export const update = os
	.input(CommandUpdateInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const [existing] = await db
			.select()
			.from(commands)
			.where(and(eq(commands.id, input.id), eq(commands.userId, user.id)))
			.limit(1);
		if (!existing) {
			throw new ORPCError("NOT_FOUND", { message: "Command not found" });
		}
		const patch: Partial<typeof commands.$inferInsert> = {};
		if (input.name !== undefined) {
			const name = input.name.trim().toLowerCase();
			if (name !== existing.name) {
				const [taken] = await db
					.select({ id: commands.id })
					.from(commands)
					.where(and(eq(commands.userId, user.id), eq(commands.name, name)))
					.limit(1);
				if (taken) {
					throw new ORPCError("CONFLICT", {
						message: "A command with this name exists",
					});
				}
				patch.name = name;
			}
		}
		if (input.description !== undefined)
			patch.description = input.description.trim();
		if (input.template !== undefined) patch.template = input.template;
		if (input.agent !== undefined)
			patch.agent = input.agent?.trim() ? input.agent.trim() : null;
		if (input.model !== undefined)
			patch.model = input.model?.trim() ? input.model.trim() : null;
		if (input.subtask !== undefined) patch.subtask = input.subtask;
		if (Object.keys(patch).length === 0) return existing;
		const [updated] = await db
			.update(commands)
			.set({ ...patch, updatedAt: new Date() })
			.where(eq(commands.id, input.id))
			.returning();
		if (!updated) {
			throw new ORPCError("NOT_FOUND", { message: "Command not found" });
		}
		return updated;
	});

export const remove = os
	.input(z.object({ id: z.string() }))
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const [existing] = await db
			.select({ id: commands.id })
			.from(commands)
			.where(and(eq(commands.id, input.id), eq(commands.userId, user.id)))
			.limit(1);
		if (!existing) {
			throw new ORPCError("NOT_FOUND", { message: "Command not found" });
		}
		await db.delete(commands).where(eq(commands.id, input.id));
		return { ok: true as const };
	});
