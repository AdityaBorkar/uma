/**
 * Machine WebSocket endpoint (`MACHINES_WS_PATH`).
 *
 * Registered as a Nitro handler (see `vite.config.ts` `nitro.handlers`) —
 * TanStack file routes only cover HTTP, so the raw multiplexed v1 frame
 * channel lives here. Auth is the machine Bearer session (header or
 * `?token=`), validated in `upgrade` before the socket opens.
 *
 * Transport stays raw JSON frames per the frozen v1 contract — not an oRPC
 * envelope (`wsContract` models the same channel for typed clients only).
 */
import { defineWebSocketHandler } from "nitro";

import { handleMachineFrame } from "../src/lib/machines/frames.ts";
import {
	authMachine,
	markConnected,
	markDisconnected,
} from "../src/lib/machines/service.ts";
import { trackSocket } from "../src/lib/machines/sockets.ts";

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

export default defineWebSocketHandler({
	close(peer) {
		try {
			(peer as unknown as { __untrack?: () => void }).__untrack?.();
		} catch {
			// ignore
		}
	},

	error(_peer, error) {
		console.error(
			`ws error: ${error instanceof Error ? error.message : String(error).slice(0, 200)}`,
		);
	},

	async message(peer, message) {
		const ctx = peer.context as { machineId: string; userId: string };
		let raw: unknown;
		try {
			raw = message.json();
		} catch {
			try {
				raw = JSON.parse(message.text());
			} catch {
				return;
			}
		}
		const reply = await handleMachineFrame(
			ctx.machineId,
			ctx.userId,
			raw,
		).catch(() => null);
		if (reply) {
			try {
				peer.send(JSON.stringify(reply));
			} catch {
				// ignore dead socket
			}
		}
	},

	async open(peer) {
		const ctx = peer.context as { machineId: string; userId: string };
		await markConnected(ctx.machineId).catch(() => undefined);
		const untrack = trackSocket(ctx.machineId, {
			send: (data: string) => {
				peer.send(data);
			},
		});
		(peer as unknown as { __untrack?: () => void }).__untrack = () => {
			untrack();
			void markDisconnected(ctx.machineId).catch(() => undefined);
		};
	},
	async upgrade(request) {
		const sess = await authMachine(bearerOrQuery(request));
		if (!sess) {
			throw new Response("unauthorized", { status: 401 });
		}
		return { context: { machineId: sess.machineId, userId: sess.userId } };
	},
});
