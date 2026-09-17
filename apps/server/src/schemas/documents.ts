import { z } from "zod";

import { pageInput } from "./shared.ts";

// --- Documents (docs/adr/004-documents-single-primitive.md + docs/CONTEXT.md) ---

export const DOCUMENT_KIND_VALUES = [
	"wiki",
	"spec",
	"bug_report",
	"update",
	"changelog",
	"release",
	"deployment",
	"action_log",
] as const;
export const DocumentKindEnum = z.enum(DOCUMENT_KIND_VALUES);
export type DocumentKind = z.infer<typeof DocumentKindEnum>;

/** One table for kind knowledge: label + meta schema + UI fields. */
const DOCUMENT_KIND_TABLE = {
	action_log: {
		fields: [],
		label: "Action log",
		meta: z.looseObject({}),
	},
	bug_report: {
		fields: [
			{
				label: "Severity",
				name: "severity",
				options: ["info", "warning", "critical"],
			},
		],
		label: "Bug report",
		meta: z.looseObject({
			severity: z.enum(["info", "warning", "critical"]).optional(),
		}),
	},
	changelog: {
		fields: [],
		label: "Changelog",
		meta: z.looseObject({}),
	},
	deployment: {
		fields: [{ label: "Environment", name: "environment" }],
		label: "Deployment",
		meta: z.looseObject({ environment: z.string().max(100).optional() }),
	},
	release: {
		fields: [{ label: "Tag Name", name: "tagName" }],
		label: "Release",
		meta: z.looseObject({ tagName: z.string().max(100).optional() }),
	},
	spec: {
		fields: [
			{
				label: "Status",
				name: "status",
				options: ["draft", "review", "approved"],
			},
		],
		label: "Specification",
		meta: z.looseObject({
			status: z.enum(["draft", "review", "approved"]).optional(),
		}),
	},
	update: {
		fields: [],
		label: "Update",
		meta: z.looseObject({}),
	},
	wiki: {
		fields: [],
		label: "Wiki",
		meta: z.looseObject({}),
	},
} as const satisfies Record<
	DocumentKind,
	{ fields: DocumentMetaField[]; label: string; meta: z.ZodType }
>;

/** UI option list for the kind picker — labels checked exhaustive by type. */
export const DOCUMENT_KINDS = DOCUMENT_KIND_VALUES.map((value) => ({
	label: DOCUMENT_KIND_TABLE[value].label,
	value,
}));

export function kindLabel(kind: string): string {
	return DOCUMENT_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export const DOCUMENT_STATE_VALUES = ["open", "closed"] as const;
export const DocumentStateEnum = z.enum(DOCUMENT_STATE_VALUES);
export type DocumentState = z.infer<typeof DocumentStateEnum>;

/** Validated per-kind frontmatter extras (`meta` column mirror). */
export function documentMetaSchema(kind: string) {
	const row: { meta: z.ZodType } | undefined = (
		DOCUMENT_KIND_TABLE as Record<string, { meta: z.ZodType } | undefined>
	)[kind];
	return row?.meta ?? z.record(z.string(), z.unknown());
}

export interface DocumentMetaField {
	label: string;
	name: string;
	options?: string[];
}

/** Explicit per-kind field descriptors — no Zod introspection in the UI. */
export function documentMetaFields(kind: string): DocumentMetaField[] {
	const row: { fields: readonly DocumentMetaField[] } | undefined = (
		DOCUMENT_KIND_TABLE as Record<
			string,
			{ fields: readonly DocumentMetaField[] } | undefined
		>
	)[kind];
	return row ? [...row.fields] : [];
}

const DocumentBridgeInput = z.object({
	body: z.string().min(1).max(200_000),
	// Free-form frontmatter extras; validated against the kind schema.
	kind: DocumentKindEnum,
	labels: z.array(z.string().min(1).max(50)).max(20).optional(),
	meta: z.record(z.string(), z.unknown()).optional(),
	projectId: z.string().optional(),
	title: z
		.string()
		.min(2, "Must be at least 2 characters")
		.max(200, "Max 200 characters"),
});

export const DocumentCreateInput = DocumentBridgeInput.extend({
	projectId: z.string().min(1),
});

export const DocumentUpdateInput = z.object({
	body: z.string().min(1).max(200_000).optional(),
	labels: z.array(z.string().min(1).max(50)).max(20).optional(),
	meta: z.record(z.string(), z.unknown()).optional(),
	number: z.number().int().positive(),
	title: z.string().min(2).max(200).optional(),
});

export const DocumentListInput = pageInput({
	kind: DocumentKindEnum.optional(),
	kinds: DocumentKindEnum.array().optional(),
	label: z.string().optional(),
	projectId: z.string().optional(),
	state: DocumentStateEnum.optional(),
});

export const DocumentNumberInput = z.object({
	number: z.number().int().positive(),
});
