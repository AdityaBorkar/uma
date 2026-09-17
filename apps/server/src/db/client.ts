import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { dbUrl } from "../env.ts";
import { authRelations } from "./auth.gen.ts";
import { relations } from "./relations.ts";

const pool = new Pool({ connectionString: dbUrl });

export const db = drizzle({
	client: pool,
	relations: { ...relations, ...authRelations },
});

/** Transaction handle type for procedures that run multi-statement writes. */
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
