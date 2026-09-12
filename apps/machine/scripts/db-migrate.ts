#!/usr/bin/env bun
/** Converge state.db to the schema (manual ops path). */
import { stateDbPath } from "../src/env.ts";
import { migrate } from "../src/utils/db.ts";

const target = process.argv[2] ?? stateDbPath();
migrate(target);
console.log(`migrated ${target}`);
