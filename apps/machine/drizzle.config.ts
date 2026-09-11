import { defineConfig } from "drizzle-kit";

// Dev-only: used by `drizzle-kit generate` to diff `src/db/schema.ts`.
// Runtime migrations never read `./drizzle` — the compiled single binary has
// no repo checkout on the machine. Runtime DDL is embedded in
// `src/db/migrations.ts` and applied directly to the XDG state.db
// (`stateDbPath()`). When the schema changes, add an embedded migration AND
// regenerate here for review history.
export default defineConfig({
	dbCredentials: {
		url: "./drizzle/local.db",
	},
	dialect: "sqlite",
	out: "./drizzle",
	schema: "./src/db/schema.ts",
});
