import { SmartCoercionHandlerPlugin } from "@orpc/json-schema";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferenceHandlerPlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod";

import router from "../rpc/router.ts";

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

/** OpenAPI surface at `/api/openapi` (same router as `/api/rpc`). */
export async function handleOpenapi(request: Request): Promise<Response> {
	const { response } = await handler.handle(request, {
		context: { headers: request.headers },
		prefix: "/api/openapi",
	});
	return response ?? new Response("Not Found", { status: 404 });
}
