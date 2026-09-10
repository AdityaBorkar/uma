import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "#/env.ts";
import type { SupportedProvider } from "./providers.ts";
import { isSupportedProvider } from "./providers.ts";

export interface StatePayload {
	e: number; // expiry epoch ms
	n: string; // nonce
	p: SupportedProvider;
	u: string; // userId
}

function b64urlEncode(s: string): string {
	return Buffer.from(s, "utf8").toString("base64url");
}

function b64urlDecode(s: string): string {
	return Buffer.from(s, "base64url").toString("utf8");
}

function hmacHex(data: string): string {
	return createHmac("sha256", env.AUTH_SECRET).update(data).digest("hex");
}

export function signState(provider: SupportedProvider, userId: string): string {
	const payload: StatePayload = {
		e: Date.now() + 10 * 60 * 1000, // 10 min
		n: crypto.randomUUID(),
		p: provider,
		u: userId,
	};
	const payloadB64 = b64urlEncode(JSON.stringify(payload));
	const sig = hmacHex(payloadB64);
	return `${payloadB64}.${sig}`;
}

export function verifyState(state: string): StatePayload | null {
	const dot = state.lastIndexOf(".");
	if (dot === -1) {
		return null;
	}
	const payloadB64 = state.slice(0, dot);
	const sig = state.slice(dot + 1);
	if (!(payloadB64 && sig)) {
		return null;
	}
	const expected = hmacHex(payloadB64);
	// timing-safe compare on hex strings (equal length 64)
	const a = Buffer.from(sig, "hex");
	const b = Buffer.from(expected, "hex");
	if (a.length !== b.length || !timingSafeEqual(a, b)) {
		return null;
	}
	let payload: StatePayload;
	try {
		payload = JSON.parse(b64urlDecode(payloadB64)) as StatePayload;
	} catch {
		return null;
	}
	if (!isSupportedProvider(payload.p)) {
		return null;
	}
	if (!(payload.u && payload.n) || typeof payload.e !== "number") {
		return null;
	}
	if (payload.e < Date.now()) {
		return null;
	}
	return payload;
}
