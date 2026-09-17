import { z } from "zod";

// Single literal owner for connection enums: Zod schemas and Postgres enums
// (`src/db/connections.ts`) derive from these.
export const CONNECTION_PROVIDER_VALUES = ["github", "google"] as const;
export const ConnectionProviderEnum = z.enum(CONNECTION_PROVIDER_VALUES);

export const CONNECTION_STATUS_VALUES = [
	"connected",
	"disconnected",
	"expired",
	"error",
] as const;
export const ConnectionStatusEnum = z.enum(CONNECTION_STATUS_VALUES);

export const CONNECTION_AUTH_TYPE_VALUES = [
	"oauth2",
	"api_key",
	"pat",
] as const;
export const ConnectionAuthTypeEnum = z.enum(CONNECTION_AUTH_TYPE_VALUES);

export const ConnectionGetAuthUrlInput = z.object({
	provider: ConnectionProviderEnum,
});

export const ConnectionGetInput = z.object({
	provider: ConnectionProviderEnum,
});

export const ConnectionDisconnectInput = z.object({
	provider: ConnectionProviderEnum,
});
