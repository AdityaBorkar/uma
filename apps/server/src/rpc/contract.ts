import { implement } from "@orpc/server";
import { apiContract } from "@uma/orpc-contract";

import type { RpcContext } from "./auth.ts";

/**
 * Contract-first implementer for the web API.
 *
 * `apiContract` (`@uma/orpc-contract`) is the single source of truth for the
 * frontend↔backend surface: procedure names, inputs, outputs, errors, and
 * REST mappings. Migrated namespaces (agents, runs, machines, tasks) are
 * implemented through this implementer so the compiler enforces contract
 * conformance; the remaining namespaces (connections, device, documents,
 * projects, promptTemplates, subagents) are still plain `os` procedures
 * using the same contract *schemas* and migrate incrementally. Do not mix
 * styles within one namespace.
 */
export const implementer = implement(apiContract).$context<RpcContext>();
