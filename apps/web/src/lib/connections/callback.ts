import { and, eq } from "drizzle-orm";

import { getAuthSession } from "#/lib/auth/server.ts";
import { db } from "#/lib/db.ts";
import { connections } from "#/schemas/db/connections.ts";
import { fetchProviderProfile } from "./profile.ts";
import {
	exchangeCodeForTokens,
	GITHUB_SCOPES,
	GOOGLE_SCOPES,
	getRedirectUri,
	type SupportedProvider,
} from "./providers.ts";
import { verifyState } from "./state.ts";

/**
 * Connections are an API-only surface (no in-app settings page), so OAuth
 * callbacks return to Account with the outcome in the query string.
 */
function redirectToAccount(
	request: Request,
	params: URLSearchParams,
): Response {
	const url = new URL(request.url);
	const base = `${url.protocol}//${url.host}`;
	return Response.redirect(
		`${base}/settings/account?${params.toString()}`,
		302,
	);
}

export async function handleConnectionCallback(
	provider: SupportedProvider,
	request: Request,
): Promise<Response> {
	const url = new URL(request.url);

	const error = url.searchParams.get("error");
	if (error) {
		const desc = url.searchParams.get("error_description") ?? error;
		return redirectToAccount(request, new URLSearchParams({ error: desc }));
	}

	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");

	if (!(code && state)) {
		return redirectToAccount(
			request,
			new URLSearchParams({ error: "missing_code_or_state" }),
		);
	}

	const statePayload = verifyState(state);
	if (!statePayload) {
		return redirectToAccount(
			request,
			new URLSearchParams({ error: "invalid_state" }),
		);
	}
	if (statePayload.p !== provider) {
		return redirectToAccount(
			request,
			new URLSearchParams({ error: "state_provider_mismatch" }),
		);
	}

	// Verify session matches state userId
	let sessionUserId: string | null = null;
	try {
		const session = await getAuthSession(request.headers);
		sessionUserId = session?.user?.id ?? null;
	} catch {
		sessionUserId = null;
	}
	if (!sessionUserId) {
		return redirectToAccount(
			request,
			new URLSearchParams({ error: "not_authenticated" }),
		);
	}
	if (sessionUserId !== statePayload.u) {
		return redirectToAccount(
			request,
			new URLSearchParams({ error: "session_mismatch" }),
		);
	}

	const redirectUri = getRedirectUri(provider);

	let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>;
	try {
		tokens = await exchangeCodeForTokens(provider, code, redirectUri);
	} catch {
		return redirectToAccount(
			request,
			new URLSearchParams({ error: "token_exchange_failed" }),
		);
	}

	let profile: Awaited<ReturnType<typeof fetchProviderProfile>> | null = null;
	try {
		profile = await fetchProviderProfile(provider, tokens.access_token);
	} catch {
		// profile is best-effort; we still store connection without it
		profile = null;
	}

	const scopes =
		tokens.scope ?? (provider === "github" ? GITHUB_SCOPES : GOOGLE_SCOPES);
	const now = new Date();
	const expiresAt = tokens.expires_in
		? new Date(Date.now() + tokens.expires_in * 1000)
		: null;

	// Upsert connections row
	try {
		const [row] = await db
			.select()
			.from(connections)
			.where(
				and(
					eq(connections.userId, sessionUserId),
					eq(connections.provider, provider),
				),
			)
			.limit(1);

		const metadata = {
			...(row?.metadata ?? {}),
			...(profile?.metadata ?? {}),
			lastScope: scopes,
			tokenType: tokens.token_type ?? null,
		};

		if (row) {
			await db
				.update(connections)
				.set({
					accessToken: tokens.access_token,
					accessTokenExpiresAt: expiresAt,
					connectedAt: now,
					metadata,
					providerAccountEmail:
						profile?.providerAccountEmail ?? row.providerAccountEmail,
					providerAccountId:
						profile?.providerAccountId ?? row.providerAccountId,
					refreshToken: tokens.refresh_token ?? row.refreshToken,
					scopes,
					status: "connected",
					updatedAt: now,
				})
				.where(
					and(
						eq(connections.userId, sessionUserId),
						eq(connections.provider, provider),
					),
				);
		} else {
			const id = crypto.randomUUID();
			await db.insert(connections).values({
				accessToken: tokens.access_token,
				accessTokenExpiresAt: expiresAt,
				authType: "oauth2",
				connectedAt: now,
				id,
				metadata,
				provider,
				providerAccountEmail: profile?.providerAccountEmail ?? null,
				providerAccountId: profile?.providerAccountId ?? null,
				refreshToken: tokens.refresh_token ?? null,
				scopes,
				status: "connected",
				userId: sessionUserId,
			});
		}
	} catch {
		return redirectToAccount(
			request,
			new URLSearchParams({ error: "db_upsert_failed" }),
		);
	}

	return redirectToAccount(
		request,
		new URLSearchParams({ connected: provider }),
	);
}
