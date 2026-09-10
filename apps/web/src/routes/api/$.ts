import { SmartCoercionPlugin } from "@orpc/json-schema";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createFileRoute } from "@tanstack/react-router";

import router from "#/rpc/router.ts";
import { ProjectSchema } from "#/schemas/schema.ts";

const handler = new OpenAPIHandler(router, {
	interceptors: [onError((_error) => {})],
	plugins: [
		new SmartCoercionPlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}),
		new OpenAPIReferencePlugin({
			docsConfig: {
				authentication: {
					securitySchemes: {
						bearerAuth: {
							token: "default-token",
						},
					},
				},
			},
			schemaConverters: [new ZodToJsonSchemaConverter()],
			specGenerateOptions: {
				commonSchemas: {
					Project: { schema: ProjectSchema },
					UndefinedError: { error: "UndefinedError" },
				},
				components: {
					securitySchemes: {
						bearerAuth: {
							scheme: "bearer",
							type: "http",
						},
					},
				},
				info: {
					title: "Planner Q3 API",
					version: "1.0.0",
				},
				security: [{ bearerAuth: [] }],
			},
		}),
	],
});

async function handle({ request }: { request: Request }) {
	const { response } = await handler.handle(request, {
		context: { headers: request.headers },
		prefix: "/api",
	});

	return response ?? new Response("Not Found", { status: 404 });
}

export const Route = createFileRoute("/api/$")({
	server: {
		handlers: {
			DELETE: handle,
			GET: handle,
			HEAD: handle,
			PATCH: handle,
			POST: handle,
			PUT: handle,
		},
	},
});
