import { ORPCError } from "@orpc/server";
import { KNOWN_AGENT_NAMES } from "@uma/orpc-contract";
import { and, eq, ilike } from "drizzle-orm";

import { db } from "#/lib/db.ts";
import { requireUser } from "#/rpc/auth.ts";
import { implementer } from "#/rpc/contract.ts";
import { agents, KNOWN_AGENT_DESCRIPTIONS } from "#/schemas/db/agents.ts";

/**
 * Coding-agent registry (contract-first: `apiContract agents.*`).
 * Browser cookie auth. Well-known agents are seeded per user on first list.
 */

async function ensureDefaults(userId: string): Promise<void> {
	await db
		.insert(agents)
		.values(
			KNOWN_AGENT_NAMES.map((name) => ({
				binary: name,
				description: KNOWN_AGENT_DESCRIPTIONS[name],
				id: crypto.randomUUID(),
				name,
				userId,
			})),
		)
		.onConflictDoNothing();
}

export const list = implementer.agents.list.handler(
	async ({ input, context }) => {
		const user = await requireUser(context.headers);
		await ensureDefaults(user.id);
		const q = input?.q?.trim();
		return db
			.select()
			.from(agents)
			.where(
				and(
					eq(agents.userId, user.id),
					input?.status ? eq(agents.status, input.status) : undefined,
					q ? ilike(agents.name, `%${q}%`) : undefined,
				),
			)
			.orderBy(agents.name);
	},
);

export const get = implementer.agents.get.handler(
	async ({ input, context, errors }) => {
		const user = await requireUser(context.headers);
		const [row] = await db
			.select()
			.from(agents)
			.where(and(eq(agents.id, input.id), eq(agents.userId, user.id)))
			.limit(1);
		if (!row) throw errors.NOT_FOUND();
		return row;
	},
);

export const create = implementer.agents.create.handler(
	async ({ input, context, errors }) => {
		const user = await requireUser(context.headers);
		const name = input.name.trim();
		const [existing] = await db
			.select({ id: agents.id })
			.from(agents)
			.where(and(eq(agents.userId, user.id), eq(agents.name, name)))
			.limit(1);
		if (existing) throw errors.CONFLICT();
		const [row] = await db
			.insert(agents)
			.values({
				binary: input.binary ?? name,
				description: input.description ?? null,
				id: crypto.randomUUID(),
				name,
				userId: user.id,
				version: input.version ?? null,
			})
			.returning();
		if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR");
		return row;
	},
);

export const update = implementer.agents.update.handler(
	async ({ input, context, errors }) => {
		const user = await requireUser(context.headers);
		const [existing] = await db
			.select()
			.from(agents)
			.where(and(eq(agents.id, input.id), eq(agents.userId, user.id)))
			.limit(1);
		if (!existing) throw errors.NOT_FOUND();
		const patch: Partial<typeof agents.$inferInsert> = {};
		if (input.name !== undefined) {
			const name = input.name.trim();
			if (name !== existing.name) {
				const [taken] = await db
					.select({ id: agents.id })
					.from(agents)
					.where(and(eq(agents.userId, user.id), eq(agents.name, name)))
					.limit(1);
				if (taken) throw errors.CONFLICT();
				patch.name = name;
			}
		}
		if (input.binary !== undefined) patch.binary = input.binary ?? null;
		if (input.description !== undefined)
			patch.description = input.description ?? null;
		if (input.version !== undefined) patch.version = input.version ?? null;
		if (input.status !== undefined) patch.status = input.status;
		if (Object.keys(patch).length === 0) return existing;
		const [updated] = await db
			.update(agents)
			.set({ ...patch, updatedAt: new Date() })
			.where(eq(agents.id, input.id))
			.returning();
		if (!updated) throw errors.NOT_FOUND();
		return updated;
	},
);

export const remove = implementer.agents.remove.handler(
	async ({ input, context, errors }) => {
		const user = await requireUser(context.headers);
		const [existing] = await db
			.select({ id: agents.id, name: agents.name })
			.from(agents)
			.where(and(eq(agents.id, input.id), eq(agents.userId, user.id)))
			.limit(1);
		if (!existing) throw errors.NOT_FOUND();
		if ((KNOWN_AGENT_NAMES as readonly string[]).includes(existing.name)) {
			throw errors.BAD_REQUEST();
		}
		await db.delete(agents).where(eq(agents.id, input.id));
		return { ok: true as const };
	},
);
