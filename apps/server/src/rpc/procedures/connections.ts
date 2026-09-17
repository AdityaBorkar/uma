import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
	fetchGithubRepos,
	requireGithubAccessToken,
} from "../../connections/github.ts";
import { revokeToken } from "../../connections/profile.ts";
import {
	buildAuthorizationUrl,
	getRedirectUri,
	isSupportedProvider,
	SUPPORTED_PROVIDERS,
} from "../../connections/providers.ts";
import { signState } from "../../connections/state.ts";
import { db } from "../../db/client.ts";
import { connections } from "../../db/connections.ts";
import {
	ConnectionDisconnectInput,
	ConnectionGetAuthUrlInput,
	ConnectionGetInput,
} from "../../schemas/schema.ts";
import { authed } from "../auth.ts";

function stripTokens(row: typeof connections.$inferSelect) {
	const { accessToken: _a, refreshToken: _r, ...safe } = row;
	return safe;
}

export const list = authed.handler(async ({ context }) => {
	const rows = await db
		.select()
		.from(connections)
		.where(eq(connections.userId, context.user.id))
		.orderBy(connections.provider);
	return rows.map(stripTokens);
});

export const get = authed
	.input(ConnectionGetInput)
	.handler(async ({ input, context }) => {
		const [row] = await db
			.select()
			.from(connections)
			.where(
				and(
					eq(connections.userId, context.user.id),
					eq(connections.provider, input.provider),
				),
			)
			.limit(1);
		if (!row) {
			return null;
		}
		return stripTokens(row);
	});

export const getAuthUrl = authed
	.input(ConnectionGetAuthUrlInput)
	.handler(async ({ input, context }) => {
		if (!isSupportedProvider(input.provider)) {
			throw new ORPCError("BAD_REQUEST", { message: "Unsupported provider" });
		}
		const redirectUri = getRedirectUri(input.provider);
		const state = signState(input.provider, context.user.id);
		const url = buildAuthorizationUrl(input.provider, { redirectUri, state });
		return { redirectUri, state, url };
	});

export const providers = authed.input(z.void()).handler(async () => {
	return {
		providers: SUPPORTED_PROVIDERS.map((id) => ({ id })),
	};
});

export const githubRepos = authed.handler(async ({ context }) => {
	const accessToken = await requireGithubAccessToken(context.user.id);
	const repos = await fetchGithubRepos(accessToken);
	return repos;
});

export const disconnect = authed
	.input(ConnectionDisconnectInput)
	.handler(async ({ input, context }) => {
		const [existing] = await db
			.select()
			.from(connections)
			.where(
				and(
					eq(connections.userId, context.user.id),
					eq(connections.provider, input.provider),
				),
			)
			.limit(1);
		if (!existing) {
			return { success: true as const };
		}
		if (existing.accessToken) {
			// Awaited: a failed provider revocation must surface instead of
			// leaving the user believing disconnect propagated. Best-effort
			// inside (never throws), so this only costs latency on success.
			await revokeToken(input.provider, existing.accessToken);
		}
		await db
			.delete(connections)
			.where(
				and(
					eq(connections.userId, context.user.id),
					eq(connections.provider, input.provider),
				),
			);
		return { success: true as const };
	});
