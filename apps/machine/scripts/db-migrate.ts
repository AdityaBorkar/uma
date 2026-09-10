#!/usr/bin/env bun
import { migrate } from "../src/db.ts";
/** Apply pending drizzle migrations to state.db (manual ops path). */
import { stateDbPath } from "../src/env.ts";

const target = process.argv[2] ?? stateDbPath();
migrate(target);
console.log(`migrated ${target}`);
