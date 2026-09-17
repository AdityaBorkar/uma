/**
 * In-process machine socket registry: `machineId -> live WS peers`.
 *
 * Single-instance production (the web app runs as one Bun process per
 * container). If the deployment ever scales past one replica, fan-out must
 * move to Redis pub/sub — `sendToMachine` returning `false` then means "no
 * local peer", and callers treat it the same way they do today.
 */

export interface WsPeer {
	send: (data: string) => void;
}

const machineSockets = new Map<string, Set<WsPeer>>();

function getSet(machineId: string): Set<WsPeer> {
	let s = machineSockets.get(machineId);
	if (!s) {
		s = new Set();
		machineSockets.set(machineId, s);
	}
	return s;
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
		try {
			peer.send(data);
			sent = true;
		} catch {
			set.delete(peer);
		}
	}
	return sent;
}

export function trackSocket(machineId: string, peer: WsPeer): () => void {
	getSet(machineId).add(peer);
	return () => {
		machineSockets.get(machineId)?.delete(peer);
	};
}
