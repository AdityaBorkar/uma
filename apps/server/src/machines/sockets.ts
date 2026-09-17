/**
 * In-process machine socket registry: `machineId -> live WS peers`.
 *
 * Single-instance production (the web app runs as one Bun process per
 * container). If the deployment ever scales past one replica, fan-out must
 * move to Redis pub/sub — `sendToMachine` returning `false` then means "no
 * local peer", and callers treat it the same way they do today.
 */

export interface WsPeer {
	/** Bun `ServerWebSocket.readyState` (1 = open); absent in tests. */
	readyState?: number;
	send: (data: string) => void;
}

const machineSockets = new Map<string, Set<WsPeer>>();
const lastSeen = new Map<string, number>();

/** Stale-socket sweep interval (ghost peers without a close frame). */
const SOCKET_TTL_MS = 90_000;

function getSet(machineId: string): Set<WsPeer> {
	let s = machineSockets.get(machineId);
	if (!s) {
		s = new Set();
		machineSockets.set(machineId, s);
	}
	return s;
}

function touch(machineId: string): void {
	lastSeen.set(machineId, Date.now());
}

/** Drop peers whose socket died without a close frame. Runs lazily. */
function sweepStale(): void {
	const now = Date.now();
	for (const [id, at] of lastSeen) {
		if (now - at < SOCKET_TTL_MS) continue;
		const set = machineSockets.get(id);
		if (!set || set.size === 0) {
			lastSeen.delete(id);
			continue;
		}
		for (const peer of [...set]) {
			if (peer.readyState !== undefined && peer.readyState !== 1) {
				set.delete(peer);
			}
		}
		if (set.size === 0) {
			machineSockets.delete(id);
			lastSeen.delete(id);
		} else {
			touch(id);
		}
	}
}

export function connectedMachineIds(): string[] {
	return [...machineSockets.keys()].filter(
		(id) => (machineSockets.get(id)?.size ?? 0) > 0,
	);
}

export function isMachineConnected(machineId: string): boolean {
	return (machineSockets.get(machineId)?.size ?? 0) > 0;
}

/** Fan out one server→machine frame to every live socket for the machine. */
export function sendToMachine(
	machineId: string,
	frame: Record<string, unknown>,
): boolean {
	const set = machineSockets.get(machineId);
	if (!set || set.size === 0) return false;
	const data = JSON.stringify(frame);
	let sent = false;
	for (const peer of [...set]) {
		// Bun `send()` returns bytes queued (no throw) — drop dead peers
		// synchronously instead of paying stringify + failed sends to corpses.
		if (peer.readyState !== undefined && peer.readyState !== 1) {
			set.delete(peer);
			continue;
		}
		try {
			peer.send(data);
			sent = true;
		} catch {
			set.delete(peer);
		}
	}
	if (set.size === 0) machineSockets.delete(machineId);
	return sent;
}

export function trackSocket(machineId: string, peer: WsPeer): () => void {
	getSet(machineId).add(peer);
	touch(machineId);
	if (lastSeen.size % 10 === 0) sweepStale();
	return () => {
		machineSockets.get(machineId)?.delete(peer);
	};
}
