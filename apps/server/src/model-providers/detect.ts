import type { DetectedModel } from "./types.ts";

/**
 * Normalize `GET $BASE_URL/models` payloads.
 *
 * Providers disagree on shape: OpenAI-compatible gateways return
 * `{ data: [{ id, ... }] }` with no capability metadata, while richer
 * gateways (OpenRouter-style) return per-model `architecture`/`modalities`
 * and reasoning info under various key spellings. Every lookup
 * below is lenient — unknown fields degrade to `null`/`[]` and render as
 * "—" in the UI instead of failing the whole detection.
 */

export function normalizeBaseUrl(input: string): string {
	const trimmed = input.trim().replace(/\/+$/, "");
	if (!trimmed) throw new Error("Base URL is required");
	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		throw new Error("Base URL must be a valid http(s) URL");
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error("Base URL must start with http:// or https://");
	}
	return trimmed;
}

export function buildModelsUrl(baseUrl: string): string {
	return /\/models\/?$/.test(baseUrl) ? baseUrl : `${baseUrl}/models`;
}

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick(record: RecordLike, keys: string[]): unknown {
	for (const key of keys) {
		const value = record[key];
		if (value !== undefined && value !== null && value !== "") return value;
	}
	return undefined;
}

function toNumber(value: unknown): number | null {
	const n =
		typeof value === "string" && value.trim() !== ""
			? Number(value)
			: typeof value === "number"
				? value
				: null;
	return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
}

function toTriState(value: unknown): boolean | null {
	if (typeof value === "boolean") return value;
	if (typeof value === "string") {
		const v = value.trim().toLowerCase();
		if (["true", "yes", "1", "supported"].includes(v)) return true;
		if (["false", "no", "0", "unsupported"].includes(v)) return false;
	}
	return null;
}

function toStringArray(value: unknown): string[] {
	const list = Array.isArray(value) ? value : [value];
	return list
		.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
		.map((v) => v.trim());
}

const MAX_INPUT_KEYS = [
	"max_input_tokens",
	"maxInputTokens",
	"max_input",
	"context_length",
	"contextLength",
	"max_context_length",
	"maxContextLength",
	"context_window",
	"contextWindow",
	"input_limit",
	"inputLimit",
	"maxInput",
];

const MAX_OUTPUT_KEYS = [
	"max_output_tokens",
	"maxOutputTokens",
	"max_completion_tokens",
	"maxCompletionTokens",
	"output_limit",
	"outputLimit",
	"max_output",
	"maxOutput",
	"max_tokens",
	"maxTokens",
];

const IMAGE_KEYS = ["supports_image", "support_image", "image", "vision"];
const VIDEO_KEYS = ["supports_video", "support_video", "video"];
const AUDIO_KEYS = ["supports_audio", "support_audio", "audio", "voice"];
const PDF_KEYS = ["supports_pdf", "support_pdf", "pdf"];

const REASONING_KEYS = [
	"reasoning_variants",
	"reasoningVariants",
	"supported_reasoning_efforts",
	"reasoning_efforts",
	"reasoningEfforts",
	"supported_efforts",
	"efforts",
];

/** Split OpenRouter-style modality strings like `"text+image->text"`. */
function splitModality(value: string): string[] {
	return value
		.split(/[^a-z0-9]+/i)
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
}

function modalityTokens(entry: RecordLike): string[] {
	const tokens: string[] = [];
	const arch = entry.architecture;
	const archRecord = isRecord(arch) ? arch : null;
	const candidates: unknown[] = [
		entry.input_modalities,
		entry.inputModalities,
		entry.supported_modalities,
		entry.supportedModalities,
		entry.modalities,
		archRecord?.input_modalities,
		archRecord?.inputModalities,
		archRecord?.modality,
		entry.modality,
	];
	for (const candidate of candidates) {
		if (typeof candidate === "string") tokens.push(...splitModality(candidate));
		else if (Array.isArray(candidate)) {
			for (const item of candidate) {
				if (typeof item === "string") tokens.push(...splitModality(item));
			}
		}
	}
	return tokens;
}

function supportFromTokens(tokens: string[], match: string[]): boolean | null {
	if (tokens.length === 0) return null;
	return tokens.some((t) => match.includes(t)) ? true : null;
}

function supportFromCapabilities(
	entry: RecordLike,
	keys: string[],
): boolean | null {
	const caps = entry.capabilities;
	if (!isRecord(caps)) return null;
	for (const key of keys) {
		const v = toTriState(caps[key]);
		if (v !== null) return v;
	}
	return null;
}

function detectSupport(
	entry: RecordLike,
	tokens: string[],
	directKeys: string[],
	capabilityKeys: string[],
	modalityMatch: string[],
): boolean | null {
	const direct = toTriState(pick(entry, directKeys));
	if (direct !== null) return direct;
	const caps = supportFromCapabilities(entry, capabilityKeys);
	if (caps !== null) return caps;
	return supportFromTokens(tokens, modalityMatch);
}

function normalizeReasoning(entry: RecordLike): string[] {
	for (const key of REASONING_KEYS) {
		const variants = toStringArray(entry[key]);
		if (variants.length > 0) return [...new Set(variants)];
	}
	const nested = entry.reasoning;
	if (isRecord(nested)) {
		for (const key of ["variants", "efforts", "supported_efforts", "levels"]) {
			const variants = toStringArray(nested[key]);
			if (variants.length > 0) return [...new Set(variants)];
		}
		const supported = toTriState(nested.supported);
		if (supported === true) return ["supported"];
	}
	if (toTriState(entry.supports_reasoning) === true) return ["supported"];
	return [];
}

export function normalizeModel(entry: unknown): DetectedModel | null {
	if (!isRecord(entry)) return null;
	const rawId = pick(entry, ["id", "model_id", "modelId", "slug"]);
	if (typeof rawId !== "string" || !rawId.trim()) return null;
	const id = rawId.trim();
	const rawName = pick(entry, ["name", "display_name", "displayName", "title"]);
	const name =
		typeof rawName === "string" && rawName.trim() ? rawName.trim() : id;

	const tokens = modalityTokens(entry);

	return {
		audio: detectSupport(
			entry,
			tokens,
			AUDIO_KEYS,
			["audio", "voice"],
			["audio", "voice", "speech"],
		),
		id,
		image: detectSupport(
			entry,
			tokens,
			IMAGE_KEYS,
			["vision", "image"],
			["image", "vision"],
		),
		maxInputTokens: toNumber(pick(entry, MAX_INPUT_KEYS)),
		maxOutputTokens: toNumber(pick(entry, MAX_OUTPUT_KEYS)),
		name,
		pdf: detectSupport(
			entry,
			tokens,
			PDF_KEYS,
			["pdf", "documents"],
			["pdf", "file", "document"],
		),
		reasoningVariants: normalizeReasoning(entry),
		video: detectSupport(entry, tokens, VIDEO_KEYS, ["video"], ["video"]),
	};
}

export function normalizeModelsPayload(payload: unknown): DetectedModel[] {
	const list: unknown = isRecord(payload)
		? Array.isArray(payload.data)
			? payload.data
			: Array.isArray(payload.models)
				? payload.models
				: []
		: Array.isArray(payload)
			? payload
			: [];
	if (!Array.isArray(list)) return [];
	const seen = new Set<string>();
	const models: DetectedModel[] = [];
	for (const entry of list) {
		const model = normalizeModel(entry);
		if (!model || seen.has(model.id)) continue;
		seen.add(model.id);
		models.push(model);
	}
	return models.sort((a, b) => a.id.localeCompare(b.id));
}
