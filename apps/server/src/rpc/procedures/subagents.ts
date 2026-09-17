import { ORPCError } from "@orpc/server";
import { and, eq, ilike } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db/client.ts";
import { subagents } from "../../db/subagents.ts";
import {
	SubagentCreateInput,
	SubagentListInput,
	SubagentUpdateInput,
} from "../../schemas/schema.ts";
import { authed } from "../auth.ts";
import { isUniqueViolation, mustReturn, toConflict } from "../scope.ts";

/** User-owned OpenCode-style subagents. No built-ins seeded. */

export const list = authed
	.input(SubagentListInput)
	.handler(async ({ input, context }) => {
		const q = input?.q?.trim();
		return db
			.select()
			.from(subagents)
			.where(
				and(
					eq(subagents.userId, context.user.id),
					q ? ilike(subagents.name, `%${q}%`) : undefined,
				),
			)
			.orderBy(subagents.name);
	});

export const get = authed
	.input(z.object({ id: z.string() }))
	.handler(async ({ input, context }) => {
		const [row] = await db
			.select()
			.from(subagents)
			.where(
				and(eq(subagents.id, input.id), eq(subagents.userId, context.user.id)),
			)
			.limit(1);
		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: "Subagent not found" });
		}
		return row;
	});

function cleanPermissions(
	value: Record<string, string | undefined> | undefined,
): Record<string, string> {
	const out: Record<string, string> = {};
	if (!value) return out;
	for (const [k, v] of Object.entries(value)) {
		if (typeof v === "string" && v !== "") out[k] = v;
	}
	return out;
}

export const create = authed
	.input(SubagentCreateInput)
	.handler(async ({ input, context }) => {
		const userId = context.user.id;
		const name = input.name.trim().toLowerCase();
		const model = input.model?.trim() ? input.model.trim() : null;
		try {
			const [row] = await db
				.insert(subagents)
				.values({
					color: input.color ?? null,
					description: input.description.trim(),
					disabled: input.disabled ?? false,
					hidden: input.hidden ?? false,
					id: crypto.randomUUID(),
					model,
					name,
					permissions: cleanPermissions(input.permissions),
					prompt: input.prompt,
					steps: input.steps ?? null,
					temperature: input.temperature ?? null,
					topP: input.topP ?? null,
					userId,
				})
				.returning();
			return mustReturn(row);
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw toConflict("A subagent with this name exists");
			}
			throw error;
		}
	});

export const update = authed
	.input(SubagentUpdateInput)
	.handler(async ({ input, context }) => {
		const userId = context.user.id;
		const [existing] = await db
			.select()
			.from(subagents)
			.where(and(eq(subagents.id, input.id), eq(subagents.userId, userId)))
			.limit(1);
		if (!existing) {
			throw new ORPCError("NOT_FOUND", { message: "Subagent not found" });
		}
		const patch: Partial<typeof subagents.$inferInsert> = {};
		if (input.name !== undefined) {
			const name = input.name.trim().toLowerCase();
			if (name !== existing.name) {
				patch.name = name;
			}
		}
		if (input.description !== undefined)
			patch.description = input.description.trim();
		if (input.prompt !== undefined) patch.prompt = input.prompt;
		if (input.model !== undefined)
			patch.model = input.model?.trim() ? input.model.trim() : null;
		if (input.temperature !== undefined) patch.temperature = input.temperature;
		if (input.steps !== undefined) patch.steps = input.steps;
		if (input.topP !== undefined) patch.topP = input.topP;
		if (input.color !== undefined) patch.color = input.color ?? null;
		if (input.hidden !== undefined) patch.hidden = input.hidden;
		if (input.disabled !== undefined) patch.disabled = input.disabled;
		if (input.permissions !== undefined)
			patch.permissions = cleanPermissions(input.permissions);
		if (Object.keys(patch).length === 0) return existing;
		try {
			const [updated] = await db
				.update(subagents)
				.set({ ...patch, updatedAt: new Date() })
				.where(and(eq(subagents.id, input.id), eq(subagents.userId, userId)))
				.returning();
			return mustReturn(updated, "Subagent not found");
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw toConflict("A subagent with this name exists");
			}
			throw error;
		}
	});

export const remove = authed
	.input(z.object({ id: z.string() }))
	.handler(async ({ input, context }) => {
		const [existing] = await db
			.select({ id: subagents.id })
			.from(subagents)
			.where(
				and(eq(subagents.id, input.id), eq(subagents.userId, context.user.id)),
			)
			.limit(1);
		if (!existing) {
			throw new ORPCError("NOT_FOUND", { message: "Subagent not found" });
		}
		await db
			.delete(subagents)
			.where(
				and(eq(subagents.id, input.id), eq(subagents.userId, context.user.id)),
			);
		return { ok: true as const };
	});
