/**
 * Model Providers — server-safe shared types and validators. Browser
 * persistence lives in `apps/web` (`localStorage`); this module must never
 * touch `window`.
 */

import { z } from "zod";

export const DetectedModelSchema = z.object({
	audio: z.boolean().nullable().default(null),
	id: z.string().min(1),
	image: z.boolean().nullable().default(null),
	maxInputTokens: z.number().int().nonnegative().nullable().default(null),
	maxOutputTokens: z.number().int().nonnegative().nullable().default(null),
	name: z.string().min(1),
	pdf: z.boolean().nullable().default(null),
	reasoningVariants: z.array(z.string()).default([]),
	video: z.boolean().nullable().default(null),
});

export type DetectedModel = z.infer<typeof DetectedModelSchema>;

export const CustomProviderSchema = z.object({
	baseUrl: z.string().min(1),
	createdAt: z.string().default(""),
	id: z.string().min(1),
	models: z.array(DetectedModelSchema).default([]),
	name: z.string().min(1),
});

export type CustomProvider = z.infer<typeof CustomProviderSchema>;

/** A manually added model attached to a user-added provider. */
export const CustomModelSchema = DetectedModelSchema.extend({
	customId: z.string().min(1),
	provider: z.string().min(1),
});

export type CustomModel = z.infer<typeof CustomModelSchema>;

export const ProviderAccountSchema = z.object({
	apiKey: z.string().min(1),
	createdAt: z.string().default(""),
	id: z.string().min(1),
	label: z.string().min(1),
	provider: z.string().min(1),
});

export type ProviderAccount = z.infer<typeof ProviderAccountSchema>;

export const ModelProviderStoreSchema = z.object({
	accounts: z.array(ProviderAccountSchema).default([]),
	models: z.array(CustomModelSchema).default([]),
	providers: z.array(CustomProviderSchema).default([]),
});

export type ModelProviderStore = z.infer<typeof ModelProviderStoreSchema>;

/** Mask an API key for display: `••••abcd`. */
export function maskKey(apiKey: string): string {
	const tail = apiKey.slice(-4);
	return `••••${tail}`;
}
