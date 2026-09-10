import { parseServerFrame, type ServerFrame } from "@uma/orpc-contract";

import { loadIdentity } from "./enroll.ts";
import { assertMachineFrame } from "./protocol.ts";

export interface WsHandlers {
	onClose?: (code: number, reason: string) => void;
	onError?: (err: unknown) => void;
	onFrame: (
		frame: ServerFrame,
		send: (f: Record<string, unknown>) => void,
	) => void | Promise<void>;
	onOpen?: (send: (f: Record<string, unknown>) => void) => void;
}

export interface WsClientOpts {
	heartbeatIntervalMs?: number;
	maxBackoffMs?: number;
	shouldStop?: () => boolean;
	url?: string;
}

function wsUrl(serverUrl: string): string {
	const u = serverUrl.replace(/\/$/, "");
	if (u.startsWith("https://"))
		return `${u.replace("https://", "wss://")}/api/machines/ws`;
	if (u.startsWith("http://"))
		return `${u.replace("http://", "ws://")}/api/machines/ws`;
	return `${u}/api/machines/ws`;
}

function jitter(ms: number): number {
	return Math.floor(ms * (0.5 + Math.random() * 0.5));
}

/**
 * One ws per machine (Bearer session auth), multiplexed channels over v1 JSON
 * frames. Jittered-backoff reconnect. Unknown inbound frames logged + ignored.
 */
export async function connectWithBackoff(
	handlers: WsHandlers,
	opts?: WsClientOpts,
): Promise<() => void> {
	const identity = loadIdentity();
	if (!identity) throw new Error("not enrolled (missing identity.json)");
	const url = opts?.url ?? wsUrl(identity.serverUrl);
	const maxBackoff = opts?.maxBackoffMs ?? 30000;
	let backoff = 1000;
	let stopped = false;
	let current: WebSocket | null = null;

	const stop = () => {
		stopped = true;
		try {
			current?.close();
		} catch {
			// ignore
		}
	};

	const loop = async () => {
		while (!stopped && !opts?.shouldStop?.()) {
			try {
				await connectOnce(url, identity.sessionToken, handlers, (ws) => {
					current = ws;
				});
				backoff = 1000;
			} catch (e) {
				handlers.onError?.(e);
			}
			if (stopped || opts?.shouldStop?.()) break;
			const wait = Math.min(maxBackoff, jitter(backoff));
			backoff = Math.min(maxBackoff, backoff * 2);
			await new Promise((r) => setTimeout(r, wait));
		}
	};
	void loop();
	return stop;
}

function connectOnce(
	url: string,
	token: string,
	handlers: WsHandlers,
	onSocket: (ws: WebSocket) => void,
): Promise<void> {
	return new Promise((resolve) => {
		let ws: WebSocket;
		try {
			ws = new WebSocket(url, {
				// Bun WebSocket client supports headers option.
				headers: { authorization: `Bearer ${token}` },
			} as never);
		} catch (e) {
			handlers.onError?.(e);
			resolve();
			return;
		}
		onSocket(ws);
		const send = (f: Record<string, unknown>) => {
			// Enforce outbound shape (never send unknown); invalid frames fail
			// closed here so callers buffer/fallback instead of sending garbage.
			assertMachineFrame(f);
			if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(f));
			else throw new Error("ws not open (buffered to SQLite by caller)");
		};
		ws.addEventListener("open", () => {
			handlers.onOpen?.(send);
		});
		ws.addEventListener("message", (ev) => {
			let data: unknown;
			try {
				data = JSON.parse(String(ev.data));
			} catch {
				console.error("warn: non-JSON ws frame ignored");
				return;
			}
			const frame = parseServerFrame(data);
			if (!frame) {
				console.error(
					`warn: unknown ws frame ignored: ${String(ev.data).slice(0, 200)}`,
				);
				return;
			}
			void Promise.resolve(handlers.onFrame(frame, send)).catch((e) =>
				handlers.onError?.(e),
			);
		});
		const done = (code: number, reason: string) => {
			handlers.onClose?.(code, reason);
			resolve();
		};
		ws.addEventListener("close", (ev) => {
			const e = ev as CloseEvent & { code: number; reason: string };
			done(e.code ?? 1000, String(e.reason ?? ""));
		});
		ws.addEventListener("error", (ev) => {
			handlers.onError?.(ev);
		});
	});
}

export { wsUrl };
