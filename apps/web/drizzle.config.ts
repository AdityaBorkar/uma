import { defineConfig } from "drizzle-kit";

import { dbUrl } from "#/env.ts";

export default defineConfig({
	dbCredentials: { url: dbUrl },
	dialect: "postgresql",
	out: "./drizzle",
	schema: "./src/schemas/db",
});
