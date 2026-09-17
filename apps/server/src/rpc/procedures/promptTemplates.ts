import { ORPCError, os } from "@orpc/server";
import { and, eq, ilike } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db/client.ts";
import { promptTemplates } from "../../db/prompt_templates.ts";
import {
	PromptTemplateCreateInput,
	PromptTemplateListInput,
	PromptTemplateUpdateInput,
} from "../../schemas/schema.ts";
import { type RpcContext, requireUser } from "../auth.ts";

/** User-owned prompt templates (OpenCode-style slash commands `/name`). No built-ins seeded. */

export const list = os
	.input(PromptTemplateListInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const q = input?.q?.trim();
		return db
			.select()
			.from(promptTemplates)
			.where(
				and(
					eq(promptTemplates.userId, user.id),
					q ? ilike(promptTemplates.name, `%${q}%`) : undefined,
				),
			)
			.orderBy(promptTemplates.name);
	});

export const get = os
	.input(z.object({ id: z.string() }))
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const [row] = await db
			.select()
			.from(promptTemplates)
			.where(
				and(
					eq(promptTemplates.id, input.id),
					eq(promptTemplates.userId, user.id),
				),
			)
			.limit(1);
		if (!row) {
			throw new ORPCError("NOT_FOUND", {
				message: "Prompt template not found",
			});
		}
		return row;
	});

export const create = os
	.input(PromptTemplateCreateInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const name = input.name.trim().toLowerCase();
		const [existing] = await db
			.select({ id: promptTemplates.id })
			.from(promptTemplates)
			.where(
				and(
					eq(promptTemplates.userId, user.id),
					eq(promptTemplates.name, name),
				),
			)
			.limit(1);
		if (existing) {
			throw new ORPCError("CONFLICT", {
				message: "A prompt template with this name exists",
			});
		}
		const [row] = await db
			.insert(promptTemplates)
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
	.input(PromptTemplateUpdateInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const [existing] = await db
			.select()
			.from(promptTemplates)
			.where(
				and(
					eq(promptTemplates.id, input.id),
					eq(promptTemplates.userId, user.id),
				),
			)
			.limit(1);
		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Prompt template not found",
			});
		}
		const patch: Partial<typeof promptTemplates.$inferInsert> = {};
		if (input.name !== undefined) {
			const name = input.name.trim().toLowerCase();
			if (name !== existing.name) {
				const [taken] = await db
					.select({ id: promptTemplates.id })
					.from(promptTemplates)
					.where(
						and(
							eq(promptTemplates.userId, user.id),
							eq(promptTemplates.name, name),
						),
					)
					.limit(1);
				if (taken) {
					throw new ORPCError("CONFLICT", {
						message: "A prompt template with this name exists",
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
			.update(promptTemplates)
			.set({ ...patch, updatedAt: new Date() })
			.where(eq(promptTemplates.id, input.id))
			.returning();
		if (!updated) {
			throw new ORPCError("NOT_FOUND", {
				message: "Prompt template not found",
			});
		}
		return updated;
	});

export const remove = os
	.input(z.object({ id: z.string() }))
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const [existing] = await db
			.select({ id: promptTemplates.id })
			.from(promptTemplates)
			.where(
				and(
					eq(promptTemplates.id, input.id),
					eq(promptTemplates.userId, user.id),
				),
			)
			.limit(1);
		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Prompt template not found",
			});
		}
		await db.delete(promptTemplates).where(eq(promptTemplates.id, input.id));
		return { ok: true as const };
	});
