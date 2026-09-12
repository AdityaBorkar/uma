/**
 * Barrel for the device-side SQLite schema.
 *
 * Import drizzle tables (`heartbeats`, `sandboxEvents`, `configReceipts`,
 * `providerKeys`, `logBuffer`, `schema`) from here; the DDL engine
 * (`schema-sync.ts`) and the open/migrate helpers (`../../utils/client.ts`)
 * live in their own modules.
 */
export * from "./schema.ts";
