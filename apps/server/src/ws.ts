import type { ServerWebSocket } from "bun";

import { env } from "./env.ts";
import { handleMachineFrame } from "./machines/frames.ts";
import {
	authMachine,
	markConnected,
	markDisconnected,
} from "./machines/service.ts";
import { trackSocket } from "./machines/sockets.ts";

export interface WsData {
	machineId: string;
	userId: string;
}

function bearerOrQuery(request: Request): string | null {
	const h = request.headers.get("authorization");
	if (h) {
		const m = h.match(/^Bearer\s+(.+)$/i);
		if (m?.[1]) return m[1].trim();
	}
	try {
		return new URL(request.url).searchParams.get("token");
	} catch {
		return null;
	}
}

/**
 * Machine WebSocket channel (`MACHINES_WS_PATH`, raw multiplexed v1 frames).
 * Transport stays raw JSON frames per the frozen v1 contract — not an oRPC
 * envelope. Auth is the machine Bearer session (header or `?token=`),
 * validated before upgrade.
 */
export async function handleWsUpgrade(
	request: Request,
	server: Bun.Server<WsData>,
): Promise<Response | undefined> {
	// Bun's upgrade() consults the `websocket` handlers below; only upgrade
	// when the client actually asked for a socket.
	if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
		return Response.json({ error: "websocket required" }, { status: 426 });
	}
	const sess = await authMachine(bearerOrQuery(request));
	if (!sess) {
		return Response.json({ error: "unauthorized" }, { status: 401 });
	}
	const upgraded = server.upgrade(request, {
		data: { machineId: sess.machineId, userId: sess.userId },
	});
	if (!upgraded) {
		return Response.json({ error: "upgrade failed" }, { status: 500 });
	}
	return undefined;
}

type Ws = ServerWebSocket<WsData> & { __untrack?: () => void };

export const wsHandlers = {
	async close(ws: Ws) {
		try {
			ws.__untrack?.();
		} catch {
			// ignore
		}
	},

	error(_ws: Ws, error: Error) {
		console.error(
			`ws error: ${error instanceof Error ? error.message : String(error).slice(0, 200)}`,
		);
	},

	async message(ws: Ws, message: string | Buffer) {
		const { machineId, userId } = ws.data;
		let raw: unknown;
		try {
			raw =
				typeof message === "string"
					? JSON.parse(message)
					: JSON.parse(Buffer.from(message).toString("utf8"));
		} catch {
			return;
		}
		const reply = await handleMachineFrame(machineId, userId, raw).catch(
			() => null,
		);
		if (reply) {
			try {
				ws.send(JSON.stringify(reply));
			} catch {
				// ignore dead socket
			}
		}
	},

	async open(ws: Ws) {
		const { machineId } = ws.data;
		await markConnected(machineId).catch(() => undefined);
		const untrack = trackSocket(machineId, {
			send: (data: string) => {
				try {
					ws.send(data);
				} catch {
					// pruned on next fan-out
				}
			},
		});
		ws.__untrack = () => {
			untrack();
			void markDisconnected(machineId).catch(() => undefined);
		};
	},
};

export function wsPort(): number {
	return env.PORT;
}
