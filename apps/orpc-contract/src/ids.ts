import { customAlphabet } from "nanoid";

// Crypto-backed RNG over the legacy no-lookalikes alphabet (uppercase, no
// 0/1/I/L/O). Prefixes/lengths/formats are wire-visible (device flow), so
// they live here next to the schemas that parse them.

const RAND_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randId = customAlphabet(RAND_ALPHABET, 32);

export function rand(n = 16): string {
	return randId(n);
}

export function deviceCode(): string {
	return `dev_${rand(24)}`;
}

export function userCode(): string {
	return `${rand(4)}-${rand(4)}`;
}

export function sessionToken(): string {
	return `sess_${rand(32)}`;
}
