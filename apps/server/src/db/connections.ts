import {
	index,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth.gen.ts";

export const connectionProviderEnum = pgEnum("connection_provider", [
	"github",
	"google",
]);

export const connectionStatusEnum = pgEnum("connection_status", [
	"connected",
	"disconnected",
	"expired",
	"error",
]);

export const connectionAuthTypeEnum = pgEnum("connection_auth_type", [
	"oauth2",
	"api_key",
	"pat",
]);

export const connections = pgTable(
	"connections",
	{
		// TODO: encrypt at rest with KMS / pgcrypto before production
		accessToken: text("access_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		authType: connectionAuthTypeEnum("auth_type").notNull().default("oauth2"),
		connectedAt: timestamp("connected_at").defaultNow().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		id: text("id").primaryKey(),
		lastSyncAt: timestamp("last_sync_at"),
		metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
		provider: connectionProviderEnum("provider").notNull(),
		providerAccountEmail: text("provider_account_email"),
		providerAccountId: text("provider_account_id"),
		refreshToken: text("refresh_token"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scopes: text("scopes"),
		status: connectionStatusEnum("status").notNull().default("connected"),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull()
			.defaultNow(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		uniqueIndex("connections_user_provider_uidx").on(
			table.userId,
			table.provider,
		),
		index("connections_userId_idx").on(table.userId),
	],
);
