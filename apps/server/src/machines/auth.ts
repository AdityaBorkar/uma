import { eq } from "drizzle-orm";

import { db } from "../db/client.ts";
import { machineSessions, machines } from "../db/machines.ts";

export interface MachineSession {
	machineId: string;
	token: string;
	userId: string;
}

export function bearerToken(headers: Headers): string | null {
	const h = headers.get("authorization");
	if (!h) return null;
	const m = h.match(/^Bearer\s+(.+)$/i);
	return m?.[1]?.trim() || null;
}

/** Authenticate a machine Bearer token; null when unknown or revoked. */
export async function authMachine(
	token: string | null,
): Promise<(MachineSession & { name: string; status: string }) | null> {
	if (!token) return null;
	const clean = token.replace(/^Bearer\s+/i, "").trim();
	if (!clean) return null;
	const [sess] = await db
		.select()
		.from(machineSessions)
		.where(eq(machineSessions.token, clean))
		.limit(1);
	if (!sess || sess.revoked) return null;
	const [m] = await db
		.select({ name: machines.name, status: machines.status })
		.from(machines)
		.where(eq(machines.id, sess.machineId))
		.limit(1);
	if (!m || m.status === "revoked") return null;
	return {
		machineId: sess.machineId,
		name: m.name,
		status: m.status,
		token: clean,
		userId: sess.userId,
	};
}
