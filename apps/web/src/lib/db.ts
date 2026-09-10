import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { dbUrl } from "#/env.ts";
import * as schema from "#/schemas/db/index.ts";

const pool = new Pool({ connectionString: dbUrl });

export const db = drizzle(pool, { schema });
