import { z } from "zod";

// Shared envelopes and generic inputs.
//
// Row outputs are intentionally loose records: procedures return Drizzle rows
// today, so the contract pins the envelope shape (items/nextCursor, stats,
// auth-url) while row contents pass through. Tighten to entity schemas when
// the web app adopts `implement(apiContract)`.

/** Passthrough for a DB row object. */
export const DbRecordSchema = z.record(z.string(), z.unknown());
export type DbRecord = z.infer<typeof DbRecordSchema>;

/** Cursor-page envelope shared by all `list` procedures. */
export const PageOutputSchema = z.object({
	items: z.array(DbRecordSchema),
	nextCursor: z.string().nullable(),
});
export type PageOutput = z.infer<typeof PageOutputSchema>;

export const StatsInputSchema = z
	.object({ projectId: z.string().optional() })
	.optional();
export type StatsInput = z.infer<typeof StatsInputSchema>;

export const IdInputSchema = z.object({ id: z.string() });
export type IdInput = z.infer<typeof IdInputSchema>;

export const RemoveOutputSchema = z.object({ ok: z.literal(true) });
export type RemoveOutput = z.infer<typeof RemoveOutputSchema>;
