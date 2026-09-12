import { createFileRoute } from "@tanstack/react-router";

import {
	buildModelsUrl,
	normalizeBaseUrl,
	normalizeModelsPayload,
} from "#/lib/model-providers/detect.ts";

/**
 * `GET /api/model-providers/detect?baseUrl=…` — fetch `GET $BASE_URL/models`
 * server-side (browsers would hit CORS against arbitrary providers) and
 * return the normalized model list for the Add Provider dialog.
 */
export const Route = createFileRoute("/api/model-providers/detect")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const url = new URL(request.url);
				const baseUrlInput = url.searchParams.get("baseUrl") ?? "";
				let baseUrl: string;
				try {
					baseUrl = normalizeBaseUrl(baseUrlInput);
				} catch (error) {
					return Response.json(
						{
							error:
								error instanceof Error ? error.message : "Invalid base URL",
						},
						{ status: 400 },
					);
				}
				const modelsUrl = buildModelsUrl(baseUrl);
				let response: Response;
				try {
					response = await fetch(modelsUrl, {
						headers: { Accept: "application/json" },
						signal: AbortSignal.timeout(15_000),
					});
				} catch {
					return Response.json(
						{ error: `Could not reach ${modelsUrl}`, modelsUrl },
						{ status: 502 },
					);
				}
				if (!response.ok) {
					return Response.json(
						{
							error: `GET ${modelsUrl} returned ${response.status}`,
							modelsUrl,
						},
						{ status: 502 },
					);
				}
				let payload: unknown;
				try {
					payload = await response.json();
				} catch {
					return Response.json(
						{ error: `${modelsUrl} did not return JSON`, modelsUrl },
						{ status: 502 },
					);
				}
				const models = normalizeModelsPayload(payload);
				return Response.json({
					baseUrl,
					count: models.length,
					models,
					modelsUrl,
				});
			},
		},
	},
});
