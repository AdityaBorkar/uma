import { ORPCError, os } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { revokeToken } from "#/lib/connections/profile.ts";
import {
	buildAuthorizationUrl,
	getRedirectUri,
	isSupportedProvider,
	SUPPORTED_PROVIDERS,
} from "#/lib/connections/providers.ts";
import { signState } from "#/lib/connections/state.ts";
import { db } from "#/lib/db.ts";
import { type RpcContext, requireUser } from "#/rpc/auth.ts";
import { connections } from "#/schemas/db/connections.ts";
import {
	ConnectionDisconnectInput,
	ConnectionGetAuthUrlInput,
	ConnectionGetInput,
} from "#/schemas/schema.ts";

function stripTokens(row: typeof connections.$inferSelect) {
	const { accessToken: _a, refreshToken: _r, ...safe } = row;
	return safe;
}

export const list = os.handler(async ({ context }) => {
	const ctx = context as RpcContext;
	const user = await requireUser(ctx.headers);
	const rows = await db
		.select()
		.from(connections)
		.where(eq(connections.userId, user.id))
		.orderBy(connections.provider);
	return rows.map(stripTokens);
});

export const get = os
	.input(ConnectionGetInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const [row] = await db
			.select()
			.from(connections)
			.where(
				and(
					eq(connections.userId, user.id),
					eq(connections.provider, input.provider),
				),
			)
			.limit(1);
		if (!row) {
			return null;
		}
		return stripTokens(row);
	});

export const getAuthUrl = os
	.input(ConnectionGetAuthUrlInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		if (!isSupportedProvider(input.provider)) {
			throw new ORPCError("BAD_REQUEST", { message: "Unsupported provider" });
		}
		const redirectUri = getRedirectUri(input.provider);
		const state = signState(input.provider, user.id);
		const url = buildAuthorizationUrl(input.provider, { redirectUri, state });
		return { redirectUri, state, url };
	});

export const providers = os.input(z.void()).handler(async ({ context }) => {
	const ctx = context as RpcContext;
	await requireUser(ctx.headers);
	return {
		providers: SUPPORTED_PROVIDERS.map((id) => ({ id })),
	};
});

export const disconnect = os
	.input(ConnectionDisconnectInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const [existing] = await db
			.select()
			.from(connections)
			.where(
				and(
					eq(connections.userId, user.id),
					eq(connections.provider, input.provider),
				),
			)
			.limit(1);
		if (!existing) {
			return { success: true as const };
		}
		if (existing.accessToken) {
			void revokeToken(input.provider, existing.accessToken);
		}
		await db
			.delete(connections)
			.where(
				and(
					eq(connections.userId, user.id),
					eq(connections.provider, input.provider),
				),
			);
		return { success: true as const };
	});
