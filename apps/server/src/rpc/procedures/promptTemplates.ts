import { ORPCError } from "@orpc/server";
import { and, eq, ilike } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db/client.ts";
import { promptTemplates } from "../../db/prompt_templates.ts";
import {
	PromptTemplateCreateInput,
	PromptTemplateListInput,
	PromptTemplateUpdateInput,
} from "../../schemas/schema.ts";
import { authed } from "../auth.ts";
import { isUniqueViolation, mustReturn, toConflict } from "../scope.ts";

/** User-owned prompt templates (OpenCode-style slash commands `/name`). No built-ins seeded. */

export const list = authed
	.input(PromptTemplateListInput)
	.handler(async ({ input, context }) => {
		const q = input?.q?.trim();
		return db
			.select()
			.from(promptTemplates)
			.where(
				and(
					eq(promptTemplates.userId, context.user.id),
					q ? ilike(promptTemplates.name, `%${q}%`) : undefined,
				),
			)
			.orderBy(promptTemplates.name);
	});

export const get = authed
	.input(z.object({ id: z.string() }))
	.handler(async ({ input, context }) => {
		const [row] = await db
			.select()
			.from(promptTemplates)
			.where(
				and(
					eq(promptTemplates.id, input.id),
					eq(promptTemplates.userId, context.user.id),
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

export const create = authed
	.input(PromptTemplateCreateInput)
	.handler(async ({ input, context }) => {
		const userId = context.user.id;
		const name = input.name.trim().toLowerCase();
		try {
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
					userId,
				})
				.returning();
			return mustReturn(row);
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw toConflict("A prompt template with this name exists");
			}
			throw error;
		}
	});

export const update = authed
	.input(PromptTemplateUpdateInput)
	.handler(async ({ input, context }) => {
		const userId = context.user.id;
		const [existing] = await db
			.select()
			.from(promptTemplates)
			.where(
				and(
					eq(promptTemplates.id, input.id),
					eq(promptTemplates.userId, userId),
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
		try {
			const [updated] = await db
				.update(promptTemplates)
				.set({ ...patch, updatedAt: new Date() })
				.where(
					and(
						eq(promptTemplates.id, input.id),
						eq(promptTemplates.userId, userId),
					),
				)
				.returning();
			return mustReturn(updated, "Prompt template not found");
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw toConflict("A prompt template with this name exists");
			}
			throw error;
		}
	});

export const remove = authed
	.input(z.object({ id: z.string() }))
	.handler(async ({ input, context }) => {
		const [existing] = await db
			.select({ id: promptTemplates.id })
			.from(promptTemplates)
			.where(
				and(
					eq(promptTemplates.id, input.id),
					eq(promptTemplates.userId, context.user.id),
				),
			)
			.limit(1);
		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Prompt template not found",
			});
		}
		await db
			.delete(promptTemplates)
			.where(
				and(
					eq(promptTemplates.id, input.id),
					eq(promptTemplates.userId, context.user.id),
				),
			);
		return { ok: true as const };
	});
