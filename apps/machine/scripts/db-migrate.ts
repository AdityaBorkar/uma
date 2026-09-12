#!/usr/bin/env bun
import { migrate } from "../src/db.ts";
/** Converge state.db to the schema (manual ops path). */
import { stateDbPath } from "../src/env.ts";

const target = process.argv[2] ?? stateDbPath();
migrate(target);
console.log(`migrated ${target}`);
