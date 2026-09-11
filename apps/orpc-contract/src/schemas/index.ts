// API I/O schemas (wire shapes for the oRPC API contract).
// Canonical source for procedure inputs/outputs; `contracts/api.ts` only wires
// these into `oc` procedures. Web form inputs in
// `apps/web/src/schemas/schema.ts` mirror these shapes (that file stays free
// of this package so it can ship in the browser bundle) — add new fields here
// first, then mirror there.

export * from "./agents.ts";
export * from "./common.ts";
export * from "./connections.ts";
export * from "./device.ts";
export * from "./documents.ts";
export * from "./machine-frames.ts";
export * from "./machines.ts";
export * from "./primitives.ts";
export * from "./projects.ts";
export * from "./runs.ts";
export * from "./server-frames.ts";
export * from "./signals.ts";
export * from "./task-logs.ts";
export * from "./tasks.ts";
export * from "./ws.ts";
