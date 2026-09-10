import { env } from "#/env.ts";
import type { SupportedProvider } from "./providers.ts";

export interface ProviderProfile {
	metadata: Record<string, unknown>;
	providerAccountEmail: string | null;
	providerAccountId: string | null;
}

export function fetchProviderProfile(
	provider: SupportedProvider,
	accessToken: string,
): Promise<ProviderProfile> {
	if (provider === "github") {
		return fetchGithubProfile(accessToken);
	}
	return fetchGoogleProfile(accessToken);
}

async function fetchGithubProfile(
	accessToken: string,
): Promise<ProviderProfile> {
	const res = await fetch("https://api.github.com/user", {
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${accessToken}`,
			"User-Agent": "planner-q3",
		},
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(
			`GitHub profile fetch failed: ${res.status} ${text.slice(0, 200)}`,
		);
	}
	const data = (await res.json()) as Record<string, unknown>;
	const id = data.id === null ? null : String(data.id);
	const login = data.login as string | undefined;
	const email =
		(data.email as string | null | undefined) ??
		(await fetchGithubPrimaryEmail(accessToken));
	return {
		metadata: {
			githubAvatarUrl: (data.avatar_url as string | undefined) ?? null,
			githubName: (data.name as string | undefined) ?? null,
			githubUsername: login ?? null,
		},
		providerAccountEmail: email,
		providerAccountId: id,
	};
}

async function fetchGithubPrimaryEmail(
	accessToken: string,
): Promise<string | null> {
	try {
		const er = await fetch("https://api.github.com/user/emails", {
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${accessToken}`,
				"User-Agent": "planner-q3",
			},
		});
		if (!er.ok) {
			return null;
		}
		const emails = (await er.json()) as Array<{
			email: string;
			primary: boolean;
			verified: boolean;
		}>;
		const primary = emails.find((e) => e.primary) ?? emails[0];
		return primary?.email ?? null;
	} catch {
		return null;
	}
}

async function fetchGoogleProfile(
	accessToken: string,
): Promise<ProviderProfile> {
	// google — use userinfo endpoint; id_token not trusted without verification
	const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(
			`Google profile fetch failed: ${res.status} ${text.slice(0, 200)}`,
		);
	}
	const data = (await res.json()) as Record<string, unknown>;
	return {
		metadata: {
			googleHd: (data.hd as string | undefined) ?? null,
			googleName: (data.name as string | undefined) ?? null,
			googlePicture: (data.picture as string | undefined) ?? null,
		},
		providerAccountEmail: (data.email as string | undefined) ?? null,
		providerAccountId:
			(data.id as string | undefined) ??
			(data.sub as string | undefined) ??
			null,
	};
}

// Optional revoke helpers (best-effort, not blocking disconnect)
export async function revokeToken(
	provider: SupportedProvider,
	token: string,
): Promise<void> {
	try {
		if (provider === "google") {
			await fetch(
				`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
				{
					headers: { "Content-Type": "application/x-www-form-urlencoded" },
					method: "POST",
				},
			);
		} else if (provider === "github") {
			// GitHub OAuth token revoke requires clientId/secret via DELETE /applications/:client_id/token
			const clientId = env.GITHUB_CLIENT_ID;
			const clientSecret = env.GITHUB_CLIENT_SECRET;
			if (clientId && clientSecret) {
				const creds = Buffer.from(`${clientId}:${clientSecret}`).toString(
					"base64",
				);
				await fetch(`https://api.github.com/applications/${clientId}/token`, {
					body: JSON.stringify({ access_token: token }),
					headers: {
						Accept: "application/vnd.github+json",
						Authorization: `Basic ${creds}`,
						"Content-Type": "application/json",
						"User-Agent": "planner-q3",
					},
					method: "DELETE",
				});
			}
		}
	} catch {
		// ignore revoke errors
	}
}
