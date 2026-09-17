import { defineConfig } from "drizzle-kit";

import { dbUrl } from "./src/env.ts";

export default defineConfig({
	dbCredentials: { url: dbUrl },
	dialect: "postgresql",
	out: "./drizzle",
	schema: "./src/db/index.ts",
});
