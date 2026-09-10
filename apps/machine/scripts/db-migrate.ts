#!/usr/bin/env bun
/** Apply pending drizzle migrations to state.db (manual ops path). */
import { stateDbPath } from "../src/env.ts";
import { migrate } from "../src/db.ts";

const target = process.argv[2] ?? stateDbPath();
migrate(target);
console.log(`migrated ${target}`);
