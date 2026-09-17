import { isSafeMcpPackage } from "../mcp/mcp.ts";

const UPSTREAM_TIMEOUT_MS = 10_000;

function encodePackage(pkg: string): string {
	// Encode each path segment so `@scope/name` stays a valid registry path.
	return pkg.split("/").map(encodeURIComponent).join("/");
}

/**
 * `GET /api/mcp/versions?package=…` — resolve the `latest` dist-tag for an
 * npm package via the public registry.
 */
export async function handleMcpVersions(request: Request): Promise<Response> {
	const url = new URL(request.url);
	const pkg = (url.searchParams.get("package") ?? "").trim();
	if (!isSafeMcpPackage(pkg)) {
		return Response.json(
			{ error: "Package is required (npm name, max 214 chars)." },
			{ status: 400 },
		);
	}
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
	try {
		const res = await fetch(
			`https://registry.npmjs.org/${encodePackage(pkg)}/latest`,
			{
				headers: { accept: "application/json" },
				signal: controller.signal,
			},
		);
		if (res.status === 404) {
			return Response.json(
				{ error: `Package ${pkg} not found on npm.`, package: pkg },
				{ status: 404 },
			);
		}
		if (!res.ok) {
			return Response.json(
				{ error: `npm registry returned ${res.status}.`, package: pkg },
				{ status: 502 },
			);
		}
		const data = (await res.json()) as {
			name?: unknown;
			version?: unknown;
		};
		if (typeof data.version !== "string" || !data.version) {
			return Response.json(
				{ error: `No version found for ${pkg}.`, package: pkg },
				{ status: 502 },
			);
		}
		return Response.json({
			latest: data.version,
			name: typeof data.name === "string" ? data.name : pkg,
			package: pkg,
		});
	} catch (error) {
		const aborted = error instanceof Error && error.name === "AbortError";
		return Response.json(
			{
				error: aborted
					? "npm registry timed out."
					: "Could not reach the npm registry.",
				package: pkg,
			},
			{ status: 503 },
		);
	} finally {
		clearTimeout(timer);
	}
}
