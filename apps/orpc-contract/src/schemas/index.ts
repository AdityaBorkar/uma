// API I/O schemas (wire shapes for the oRPC API contract).
// Canonical source for procedure inputs/outputs; `contracts/api.ts` only wires
// these into `oc` procedures. Web domain inputs mirror
// `apps/web/src/schemas/schema.ts` — that file is the implementation-side copy
// until it migrates to import from here.

export * from "./common.ts";
export * from "./connections.ts";
export * from "./documents.ts";
export * from "./machine-frames.ts";
export * from "./machines.ts";
export * from "./primitives.ts";
export * from "./projects.ts";
export * from "./server-frames.ts";
export * from "./signals.ts";
export * from "./tasks.ts";
export * from "./ws.ts";
