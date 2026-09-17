import { and, eq, isNull } from "drizzle-orm";

import { db } from "../db/client.ts";
import { machineSessions, machines } from "../db/machines.ts";

export interface MachineSession {
	machineId: string;
	token: string;
	userId: string;
}

/**
 * Single Bearer parser for the machine wire: `Authorization` header first,
 * `?token=` query fallback (WS upgrades can't set headers in browsers).
 */
export function bearerToken(source: Headers | Request): string | null {
	const headers = source instanceof Request ? source.headers : source;
	const h = headers.get("authorization");
	if (h) {
		const m = h.match(/^Bearer\s+(.+)$/i);
		if (m?.[1]?.trim()) return m[1].trim();
	}
	if (source instanceof Request) {
		try {
			return new URL(source.url).searchParams.get("token");
		} catch {
			return null;
		}
	}
	return null;
}

/** Authenticate a machine Bearer token; null when unknown or revoked. */
export async function authMachine(
	token: string | null,
): Promise<(MachineSession & { name: string; status: string }) | null> {
	const clean = token?.trim();
	if (!clean) return null;
	const [row] = await db
		.select({
			machineId: machineSessions.machineId,
			name: machines.name,
			status: machines.status,
			token: machineSessions.token,
			userId: machineSessions.userId,
		})
		.from(machineSessions)
		.innerJoin(machines, eq(machines.id, machineSessions.machineId))
		.where(
			and(eq(machineSessions.token, clean), isNull(machineSessions.revoked)),
		)
		.limit(1);
	if (!row || row.status === "revoked") return null;
	return {
		machineId: row.machineId,
		name: row.name,
		status: row.status,
		token: row.token,
		userId: row.userId,
	};
}

/**
 * Assert the session owns `claimedId`. Throws a caller-mapped error so HTTP
 * (403), WS (ignore), and RPC (FORBIDDEN) share one identity check.
 */
export function assertSessionOwnsMachine(
	session: MachineSession,
	claimedId: string,
): void {
	if (session.machineId !== claimedId) {
		throw new Error(`machine mismatch: ${claimedId}`);
	}
}
