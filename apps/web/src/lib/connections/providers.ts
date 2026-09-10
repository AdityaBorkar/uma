import { env, serverUrl } from "#/env.ts";

export const GITHUB_SCOPES = [
	"read:user",
	"user:email",
	"repo",
	"read:org",
].join(" ");

// Least-privilege read-only for Google: Gmail + Calendar readonly + profile/email for identity.
// Sign-in (betterAuth) uses openid email profile only; connections adds these.
export const GOOGLE_SCOPES = [
	"openid",
	"https://www.googleapis.com/auth/userinfo.email",
	"https://www.googleapis.com/auth/userinfo.profile",
	"https://www.googleapis.com/auth/gmail.readonly",
	"https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

export const SUPPORTED_PROVIDERS = ["github", "google"] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export function isSupportedProvider(p: string): p is SupportedProvider {
	return (SUPPORTED_PROVIDERS as readonly string[]).includes(p);
}

export function getRedirectUri(provider: SupportedProvider): string {
	return `${serverUrl}/api/connections/${provider}`;
}

export function buildAuthorizationUrl(
	provider: SupportedProvider,
	args: { state: string; redirectUri: string },
): string {
	const { state, redirectUri } = args;
	if (provider === "github") {
		return buildGithubAuthUrl(state, redirectUri);
	}
	return buildGoogleAuthUrl(state, redirectUri);
}

function buildGithubAuthUrl(state: string, redirectUri: string): string {
	const clientId = env.GITHUB_CLIENT_ID;
	if (!clientId) {
		throw new Error("GITHUB_CLIENT_ID not configured");
	}
	const params = new URLSearchParams({
		allow_signup: "true",
		client_id: clientId,
		redirect_uri: redirectUri,
		scope: GITHUB_SCOPES,
		state,
	});
	return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

function buildGoogleAuthUrl(state: string, redirectUri: string): string {
	const clientId = env.GOOGLE_CLIENT_ID;
	if (!clientId) {
		throw new Error("GOOGLE_CLIENT_ID not configured");
	}
	const params = new URLSearchParams({
		access_type: "offline",
		client_id: clientId,
		include_granted_scopes: "false",
		prompt: "consent",
		redirect_uri: redirectUri,
		response_type: "code",
		scope: GOOGLE_SCOPES,
		state,
	});
	return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface TokenResult {
	access_token: string;
	expires_in?: number;
	id_token?: string;
	refresh_token?: string | null;
	scope?: string;
	token_type?: string;
}

export function exchangeCodeForTokens(
	provider: SupportedProvider,
	code: string,
	redirectUri: string,
): Promise<TokenResult> {
	if (provider === "github") {
		return exchangeGithubCode(code, redirectUri);
	}
	return exchangeGoogleCode(code, redirectUri);
}

async function exchangeGithubCode(
	code: string,
	redirectUri: string,
): Promise<TokenResult> {
	const clientId = env.GITHUB_CLIENT_ID;
	const clientSecret = env.GITHUB_CLIENT_SECRET;
	if (!(clientId && clientSecret)) {
		throw new Error("GitHub OAuth not configured");
	}
	const res = await fetch("https://github.com/login/oauth/access_token", {
		body: JSON.stringify({
			client_id: clientId,
			client_secret: clientSecret,
			code,
			redirect_uri: redirectUri,
		}),
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		method: "POST",
	});
	const data = (await res.json()) as Record<string, unknown>;
	if (!res.ok || data.error) {
		throw new Error(
			`GitHub token exchange failed: ${String(data.error_description ?? data.error ?? res.statusText)}`,
		);
	}
	const accessToken = data.access_token as string | undefined;
	if (!accessToken) {
		throw new Error("GitHub token exchange: missing access_token");
	}
	return {
		access_token: accessToken,
		scope: data.scope as string | undefined,
		token_type: data.token_type as string | undefined,
	};
}

async function exchangeGoogleCode(
	code: string,
	redirectUri: string,
): Promise<TokenResult> {
	const clientId = env.GOOGLE_CLIENT_ID;
	const clientSecret = env.GOOGLE_CLIENT_SECRET;
	if (!(clientId && clientSecret)) {
		throw new Error("Google OAuth not configured");
	}
	const body = new URLSearchParams({
		client_id: clientId,
		client_secret: clientSecret,
		code,
		grant_type: "authorization_code",
		redirect_uri: redirectUri,
	});
	const res = await fetch("https://oauth2.googleapis.com/token", {
		body: body.toString(),
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		method: "POST",
	});
	const data = (await res.json()) as Record<string, unknown>;
	if (!res.ok) {
		throw new Error(
			`Google token exchange failed: ${String((data as { error_description?: string }).error_description ?? (data as { error?: string }).error ?? res.statusText)}`,
		);
	}
	const accessToken = data.access_token as string | undefined;
	if (!accessToken) {
		throw new Error("Google token exchange: missing access_token");
	}
	return {
		access_token: accessToken,
		expires_in: data.expires_in as number | undefined,
		id_token: data.id_token as string | undefined,
		refresh_token: (data.refresh_token as string | undefined) ?? null,
		scope: data.scope as string | undefined,
		token_type: data.token_type as string | undefined,
	};
}
