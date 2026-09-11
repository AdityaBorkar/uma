import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { dbUrl } from "#/env.ts";
import { authRelations } from "#/schemas/db/auth.gen.ts";
import { relations } from "#/schemas/db/relations.ts";

const pool = new Pool({ connectionString: dbUrl });

export const db = drizzle({
	client: pool,
	relations: { ...relations, ...authRelations },
});
