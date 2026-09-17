import { z } from "zod";

import { env } from "../env.ts";
import type { SupportedProvider } from "./providers.ts";

const GithubProfileSchema = z
	.object({
		avatar_url: z.string().nullable().optional(),
		email: z.string().nullable().optional(),
		id: z.union([z.number(), z.string()]).nullable().optional(),
		login: z.string().optional(),
		name: z.string().nullable().optional(),
	})
	.passthrough();

const GithubEmailSchema = z.object({
	email: z.string(),
	primary: z.boolean().optional(),
	verified: z.boolean().optional(),
});

const GoogleProfileSchema = z
	.object({
		email: z.string().optional(),
		hd: z.string().optional(),
		id: z.string().optional(),
		name: z.string().optional(),
		picture: z.string().optional(),
		sub: z.string().optional(),
	})
	.passthrough();

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
	const parsed = GithubProfileSchema.safeParse(await res.json());
	if (!parsed.success) {
		throw new Error("GitHub profile fetch failed: unexpected shape");
	}
	const data = parsed.data;
	const id = data.id === null || data.id === undefined ? null : String(data.id);
	const email =
		(data.email ?? (await fetchGithubPrimaryEmail(accessToken))) || null;
	return {
		metadata: {
			githubAvatarUrl: data.avatar_url ?? null,
			githubName: data.name ?? null,
			githubUsername: data.login ?? null,
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
		const parsed = z.array(GithubEmailSchema).safeParse(await er.json());
		if (!parsed.success) return null;
		const emails = parsed.data;
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
	const parsed = GoogleProfileSchema.safeParse(await res.json());
	if (!parsed.success) {
		throw new Error("Google profile fetch failed: unexpected shape");
	}
	const data = parsed.data;
	return {
		metadata: {
			googleHd: data.hd ?? null,
			googleName: data.name ?? null,
			googlePicture: data.picture ?? null,
		},
		providerAccountEmail: data.email ?? null,
		providerAccountId: data.id ?? data.sub ?? null,
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
