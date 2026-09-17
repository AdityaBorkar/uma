/**
 * Model Providers — client-safe shared types.
 *
 * Custom providers, manual models, and provider accounts are stored in the
 * browser (`localStorage`, see `STORAGE_KEY`) in v1.
 */

import { z } from "zod";

import { defineLocalStore } from "../lib/local-store.ts";

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

export const STORAGE_KEY = "uma:model-providers:v1";

export const EMPTY_STORE: ModelProviderStore = {
	accounts: [],
	models: [],
	providers: [],
};

const storeDef = defineLocalStore(
	STORAGE_KEY,
	ModelProviderStoreSchema,
	EMPTY_STORE,
);

/** Parse + validate the persisted store; returns empty store on any problem. */
export function parseStore(raw: unknown): ModelProviderStore {
	if (typeof raw !== "string") return EMPTY_STORE;
	try {
		const parsed: unknown = JSON.parse(raw);
		const result = ModelProviderStoreSchema.safeParse(parsed);
		if (!result.success) return EMPTY_STORE;
		return result.data;
	} catch {
		return EMPTY_STORE;
	}
}

export function loadStore(): ModelProviderStore {
	return storeDef.load();
}

export function saveStore(store: ModelProviderStore): void {
	storeDef.save(store);
}

/** Mask an API key for display: `••••abcd`. */
export function maskKey(apiKey: string): string {
	const tail = apiKey.slice(-4);
	return `••••${tail}`;
}
