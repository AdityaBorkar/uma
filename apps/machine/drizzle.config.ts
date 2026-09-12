import { defineConfig } from "drizzle-kit";

// Source of truth for SQL: `src/db/schema.ts` via `drizzle-kit generate`
// (`bun run db:generate`). Runtime never reads `./drizzle` from disk — the
// compiled single binary has no repo checkout, so
// `scripts/generate-embedded-migrations.ts` embeds the SQL into
// `src/db/migrations.ts`, applied via drizzle-orm's embedded-journal mode
// to the XDG state.db (`stateDbPath()`).
export default defineConfig({
	dbCredentials: {
		url: "./drizzle/local.db",
	},
	dialect: "sqlite",
	out: "./drizzle",
	schema: "./src/db/schema.ts",
});
