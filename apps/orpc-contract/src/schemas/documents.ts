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

export const DOCUMENT_STATE_VALUES = ["open", "closed"] as const;
export const DocumentStateEnum = z.enum(DOCUMENT_STATE_VALUES);
export type DocumentState = z.infer<typeof DocumentStateEnum>;

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
