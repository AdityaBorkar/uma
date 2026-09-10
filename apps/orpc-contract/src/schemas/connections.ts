import { z } from "zod";

export const ConnectionProviderEnum = z.enum(["github", "google"]);
export type ConnectionProvider = z.infer<typeof ConnectionProviderEnum>;

export const ConnectionGetAuthUrlInputSchema = z.object({
	provider: ConnectionProviderEnum,
});
export type ConnectionGetAuthUrlInput = z.infer<
	typeof ConnectionGetAuthUrlInputSchema
>;

export const ConnectionGetInputSchema = z.object({
	provider: ConnectionProviderEnum,
});
export type ConnectionGetInput = z.infer<typeof ConnectionGetInputSchema>;

export const ConnectionDisconnectInputSchema = z.object({
	provider: ConnectionProviderEnum,
});
export type ConnectionDisconnectInput = z.infer<
	typeof ConnectionDisconnectInputSchema
>;

export const ConnectionAuthUrlOutputSchema = z.object({
	redirectUri: z.string(),
	state: z.string(),
	url: z.string(),
});
export type ConnectionAuthUrlOutput = z.infer<
	typeof ConnectionAuthUrlOutputSchema
>;

export const ConnectionProvidersOutputSchema = z.object({
	providers: z.array(z.object({ id: z.string() })),
});
export type ConnectionProvidersOutput = z.infer<
	typeof ConnectionProvidersOutputSchema
>;

export const DisconnectOutputSchema = z.object({ success: z.literal(true) });
export type DisconnectOutput = z.infer<typeof DisconnectOutputSchema>;
