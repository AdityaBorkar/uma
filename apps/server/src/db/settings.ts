import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth.gen.ts";

// Workspace-level preferences (one row per user). This shell remains the
// future home for preferences such as timezone (SOW §6.3, D3).
export const workspaceSettings = pgTable("workspace_settings", {
	id: text("id").primaryKey(),
	updatedAt: timestamp("updated_at")
		.$onUpdate(() => new Date())
		.notNull()
		.defaultNow(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" })
		.unique(),
});
