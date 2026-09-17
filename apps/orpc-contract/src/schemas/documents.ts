import { z } from "zod";

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

const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
	action_log: "Action log",
	bug_report: "Bug report",
	changelog: "Changelog",
	deployment: "Deployment",
	release: "Release",
	spec: "Specification",
	update: "Update",
	wiki: "Wiki",
};

/** UI option list for the kind picker — labels checked exhaustive by type. */
export const DOCUMENT_KINDS = DOCUMENT_KIND_VALUES.map((value) => ({
	label: DOCUMENT_KIND_LABELS[value],
	value,
}));

export function kindLabel(kind: string): string {
	return DOCUMENT_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export const DOCUMENT_STATE_VALUES = ["open", "closed"] as const;
export const DocumentStateEnum = z.enum(DOCUMENT_STATE_VALUES);
export type DocumentState = z.infer<typeof DocumentStateEnum>;

// Kind-specific frontmatter extras (ADR 004). Common fields (title, labels,
// projectId) are shared columns; these schemas only govern `meta`.
export function documentMetaSchema(kind: string) {
	const base = z.record(z.string(), z.unknown());
	switch (kind) {
		case "bug_report":
			return z.looseObject({
				severity: z.enum(["info", "warning", "critical"]).optional(),
			});
		case "deployment":
			return z.looseObject({ environment: z.string().max(100).optional() });
		case "release":
			return z.looseObject({ tagName: z.string().max(100).optional() });
		case "spec":
			return z.looseObject({
				status: z.enum(["draft", "review", "approved"]).optional(),
			});
		default:
			return base;
	}
}

export interface DocumentMetaField {
	label: string;
	name: string;
	options?: string[];
}

/** Explicit per-kind field descriptors — no Zod introspection in the UI. */
export function documentMetaFields(kind: string): DocumentMetaField[] {
	switch (kind) {
		case "bug_report":
			return [
				{
					label: "Severity",
					name: "severity",
					options: ["info", "warning", "critical"],
				},
			];
		case "deployment":
			return [{ label: "Environment", name: "environment" }];
		case "release":
			return [{ label: "Tag Name", name: "tagName" }];
		case "spec":
			return [
				{
					label: "Status",
					name: "status",
					options: ["draft", "review", "approved"],
				},
			];
		default:
			return [];
	}
}

const DocumentBridgeInputSchema = z.object({
	body: z.string().min(1).max(200_000),
	kind: DocumentKindEnum,
	labels: z.array(z.string().min(1).max(50)).max(20).optional(),
	meta: z.record(z.string(), z.unknown()).optional(),
	projectId: z.string().optional(),
	title: z
		.string()
		.min(2, "Must be at least 2 characters")
		.max(200, "Max 200 characters"),
});

export const DocumentCreateInputSchema = DocumentBridgeInputSchema.extend({
	projectId: z.string().min(1),
});
export type DocumentCreateInput = z.infer<typeof DocumentCreateInputSchema>;

export const DocumentUpdateInputSchema = z.object({
	body: z.string().min(1).max(200_000).optional(),
	labels: z.array(z.string().min(1).max(50)).max(20).optional(),
	meta: z.record(z.string(), z.unknown()).optional(),
	number: z.number().int().positive(),
	title: z.string().min(2).max(200).optional(),
});
export type DocumentUpdateInput = z.infer<typeof DocumentUpdateInputSchema>;

export const DocumentListInputSchema = z
	.object({
		cursor: z.string().optional(),
		kind: DocumentKindEnum.optional(),
		kinds: DocumentKindEnum.array().optional(),
		label: z.string().optional(),
		limit: z.number().int().min(1).max(100).default(20),
		projectId: z.string().optional(),
		q: z.string().optional(),
		state: DocumentStateEnum.optional(),
	})
	.optional();
export type DocumentListInput = z.infer<typeof DocumentListInputSchema>;

export const DocumentNumberInputSchema = z.object({
	number: z.number().int().positive(),
});
export type DocumentNumberInput = z.infer<typeof DocumentNumberInputSchema>;

export const CommentCreateInputSchema = z.object({
	body: z.string().min(1).max(10_000),
	documentNumber: z.number().int().positive(),
});
export type CommentCreateInput = z.infer<typeof CommentCreateInputSchema>;
