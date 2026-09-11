import { SmartCoercionHandlerPlugin } from "@orpc/json-schema";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferenceHandlerPlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { createFileRoute } from "@tanstack/react-router";

import router from "#/rpc/router.ts";

const generator = new OpenAPIGenerator({
	converters: [new ZodToJsonSchemaConverter()],
});

const handler = new OpenAPIHandler(router, {
	interceptors: [onError((_error) => {})],
	plugins: [
		new SmartCoercionHandlerPlugin({
			converters: [new ZodToJsonSchemaConverter()],
		}),
		new OpenAPIReferenceHandlerPlugin({
			providerConfig: {
				authentication: {
					securitySchemes: {
						bearerAuth: {
							token: "default-token",
						},
					},
				},
			},
			spec: () =>
				generator.generate(router, {
					base: {
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
