import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

import { db } from "../db/client.ts";
import { connections } from "../db/connections.ts";

export interface GithubRepo {
	defaultBranch: string | null;
	description: string | null;
	fullName: string;
	htmlUrl: string;
	id: number;
	name: string;
	private: boolean;
	updatedAt: string | null;
}

interface GithubApiRepo {
	default_branch?: string;
	description: string | null;
	full_name: string;
	html_url: string;
	id: number;
	name: string;
	private: boolean;
	updated_at?: string;
}

function toGithubRepo(data: GithubApiRepo): GithubRepo {
	return {
		defaultBranch: data.default_branch ?? null,
		description: data.description ?? null,
		fullName: data.full_name,
		htmlUrl: data.html_url,
		id: data.id,
		name: data.name,
		private: data.private,
		updatedAt: data.updated_at ?? null,
	};
}

export const GITHUB_REPO_FULL_NAME_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function normalizeGithubRepoFullName(fullName: string): string {
	return fullName.trim();
}

export function assertValidGithubRepoFullName(fullName: string): string {
	const normalized = normalizeGithubRepoFullName(fullName);
	if (!GITHUB_REPO_FULL_NAME_RE.test(normalized)) {
		throw new ORPCError("BAD_REQUEST", {
			message: "GitHub repository must be in the form owner/repo",
		});
	}
	return normalized;
}

/** Load the stored GitHub OAuth token, or throw a clear connection error. */
export async function requireGithubAccessToken(
	userId: string,
): Promise<string> {
	const [row] = await db
		.select()
		.from(connections)
		.where(
			and(eq(connections.userId, userId), eq(connections.provider, "github")),
		)
		.limit(1);
	if (row?.status !== "connected" || !row?.accessToken) {
		throw new ORPCError("NOT_FOUND", {
			message:
				"GitHub connection not available. Connect GitHub in Settings → Account to create a project.",
		});
	}
	return row.accessToken;
}

function githubHeaders(accessToken: string): HeadersInit {
	return {
		Accept: "application/vnd.github+json",
		Authorization: `Bearer ${accessToken}`,
		"User-Agent": "planner-q3",
		"X-GitHub-Api-Version": "2022-11-28",
	};
}

function throwForGithubStatus(status: number, bodyText: string): never {
	if (status === 401 || status === 403) {
		throw new ORPCError("UNAUTHORIZED", {
			message:
				"GitHub connection expired or invalid. Please reconnect GitHub in Settings → Account.",
		});
	}
	if (status === 404) {
		throw new ORPCError("NOT_FOUND", {
			message: "GitHub repository not found or not accessible.",
		});
	}
	throw new ORPCError("INTERNAL_SERVER_ERROR", {
		message: `GitHub request failed: ${status} ${bodyText.slice(0, 200)}`,
	});
}

/** List repositories the connected GitHub account can access. */
export async function fetchGithubRepos(
	accessToken: string,
): Promise<GithubRepo[]> {
	const url =
		"https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member";
	const res = await fetch(url, { headers: githubHeaders(accessToken) });
	if (!res.ok) {
		const text = await res.text();
		throwForGithubStatus(res.status, text);
	}
	const data = (await res.json()) as GithubApiRepo[];
	return data.map(toGithubRepo);
}

/** Fetch one repository by `owner/repo` using the stored connection token. */
export async function fetchGithubRepo(
	accessToken: string,
	fullName: string,
): Promise<GithubRepo> {
	const normalized = assertValidGithubRepoFullName(fullName);
	const res = await fetch(`https://api.github.com/repos/${normalized}`, {
		headers: githubHeaders(accessToken),
	});
	if (!res.ok) {
		const text = await res.text();
		throwForGithubStatus(res.status, text);
	}
	const data = (await res.json()) as GithubApiRepo;
	return toGithubRepo(data);
}
