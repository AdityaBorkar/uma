// API I/O schemas (wire shapes for the oRPC API contract).
// Canonical source for procedure inputs/outputs; `contracts/api.ts` only wires
// these into `oc` procedures. `apps/web/src/schemas/schema.ts` re-exports
// these (with backwards-compatible aliases for the pre-contract names) —
// add new fields here first, the web stays in sync via the barrel.

export * from "./agents.ts";
export * from "./common.ts";
export * from "./connections.ts";
export * from "./device.ts";
export * from "./documents.ts";
export * from "./machine-frames.ts";
export * from "./machines.ts";
export * from "./primitives.ts";
export * from "./projects.ts";
export * from "./prompt-templates.ts";
export * from "./runs.ts";
export * from "./server-frames.ts";
export * from "./subagents.ts";
export * from "./task-logs.ts";
export * from "./tasks.ts";
export * from "./ws.ts";
