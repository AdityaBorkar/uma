import { implement } from "@orpc/server";
import { apiContract } from "@uma/orpc-contract";

import type { RpcContext } from "#/rpc/auth.ts";

/**
 * Contract-first implementer for the web API.
 *
 * `apiContract` (`@uma/orpc-contract`) is the single source of truth for the
 * frontend↔backend surface: procedure names, inputs, outputs, errors, and
 * REST mappings. New namespaces (agents, runs, browser machine registry,
 * task logs) are implemented through this implementer so the compiler
 * enforces contract conformance; the older namespaces are still plain `os`
 * procedures using the same contract *schemas* and migrate incrementally.
 */
export const implementer = implement(apiContract).$context<RpcContext>();
