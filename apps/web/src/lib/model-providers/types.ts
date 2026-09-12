/**
 * Model Providers — client-safe shared types.
 *
 * Custom providers, manual models, and provider accounts are stored in the
 * browser (`localStorage`, see `STORAGE_KEY`) in v1. These types cover
 * everything the user adds via Add Provider / Add Model / Add Account.
 */

export interface DetectedModel {
	audio?: boolean | null;
	id: string;
	image?: boolean | null;
	maxInputTokens?: number | null;
	maxOutputTokens?: number | null;
	name: string;
	pdf?: boolean | null;
	reasoningVariants: string[];
	video?: boolean | null;
}

export interface CustomProvider {
	baseUrl: string;
	createdAt: string;
	id: string;
	models: DetectedModel[];
	name: string;
}

/** A manually added model attached to a user-added provider. */
export interface CustomModel extends DetectedModel {
	customId: string;
	provider: string;
}

export interface ProviderAccount {
	apiKey: string;
	createdAt: string;
	id: string;
	label: string;
	/** Provider name. */
	provider: string;
}

export interface ModelProviderStore {
	accounts: ProviderAccount[];
	models: CustomModel[];
	providers: CustomProvider[];
}

export const STORAGE_KEY = "uma:model-providers:v1";

export const EMPTY_STORE: ModelProviderStore = {
	accounts: [],
	models: [],
	providers: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
		.map((v) => v.trim());
}

function asTriState(value: unknown): boolean | null {
	return typeof value === "boolean" ? value : null;
}

function asPositiveInt(value: unknown): number | null {
	const n = typeof value === "string" ? Number(value) : value;
	return typeof n === "number" && Number.isFinite(n) && n >= 0
		? Math.floor(n)
		: null;
}

function asModel(value: unknown): DetectedModel | null {
	if (!isRecord(value)) return null;
	const id = typeof value.id === "string" ? value.id.trim() : "";
	if (!id) return null;
	const name =
		typeof value.name === "string" && value.name.trim()
			? value.name.trim()
			: id;
	return {
		audio: asTriState(value.audio),
		id,
		image: asTriState(value.image),
		maxInputTokens: asPositiveInt(value.maxInputTokens),
		maxOutputTokens: asPositiveInt(value.maxOutputTokens),
		name,
		pdf: asTriState(value.pdf),
		reasoningVariants: asStringArray(value.reasoningVariants),
		video: asTriState(value.video),
	};
}

/** Parse + validate the persisted store; returns empty store on any problem. */
export function parseStore(raw: unknown): ModelProviderStore {
	if (typeof raw !== "string") return EMPTY_STORE;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!isRecord(parsed)) return EMPTY_STORE;
		const providers = Array.isArray(parsed.providers)
			? parsed.providers.flatMap((p) => {
					if (!isRecord(p)) return [];
					const name = typeof p.name === "string" ? p.name.trim() : "";
					const baseUrl = typeof p.baseUrl === "string" ? p.baseUrl.trim() : "";
					const id = typeof p.id === "string" ? p.id : "";
					if (!name || !baseUrl || !id) return [];
					const models = Array.isArray(p.models)
						? p.models.flatMap((m) => {
								const model = asModel(m);
								return model ? [model] : [];
							})
						: [];
					return [
						{
							baseUrl,
							createdAt: typeof p.createdAt === "string" ? p.createdAt : "",
							id,
							models,
							name,
						} satisfies CustomProvider,
					];
				})
			: [];
		const models = Array.isArray(parsed.models)
			? parsed.models.flatMap((m) => {
					if (!isRecord(m)) return [];
					const model = asModel(m);
					if (!model) return [];
					const provider =
						typeof m.provider === "string" ? m.provider.trim() : "";
					const customId = typeof m.customId === "string" ? m.customId : "";
					if (!provider || !customId) return [];
					return [{ ...model, customId, provider } satisfies CustomModel];
				})
			: [];
		const accounts = Array.isArray(parsed.accounts)
			? parsed.accounts.flatMap((a) => {
					if (!isRecord(a)) return [];
					const provider =
						typeof a.provider === "string" ? a.provider.trim() : "";
					const label = typeof a.label === "string" ? a.label.trim() : "";
					const apiKey = typeof a.apiKey === "string" ? a.apiKey : "";
					const id = typeof a.id === "string" ? a.id : "";
					if (!provider || !label || !apiKey || !id) return [];
					return [
						{
							apiKey,
							createdAt: typeof a.createdAt === "string" ? a.createdAt : "",
							id,
							label,
							provider,
						} satisfies ProviderAccount,
					];
				})
			: [];
		return { accounts, models, providers };
	} catch {
		return EMPTY_STORE;
	}
}

export function loadStore(): ModelProviderStore {
	try {
		if (typeof window === "undefined" || !window.localStorage) {
			return EMPTY_STORE;
		}
		return parseStore(window.localStorage.getItem(STORAGE_KEY));
	} catch {
		return EMPTY_STORE;
	}
}

export function saveStore(store: ModelProviderStore): void {
	try {
		if (typeof window === "undefined" || !window.localStorage) return;
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
	} catch {
		// Storage full or unavailable — the page keeps working in memory.
	}
}

/** Mask an API key for display: `••••abcd`. */
export function maskKey(apiKey: string): string {
	const tail = apiKey.slice(-4);
	return `••••${tail}`;
}
