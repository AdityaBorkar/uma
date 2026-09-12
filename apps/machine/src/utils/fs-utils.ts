import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import writeFileAtomic from "write-file-atomic";

const SAFE_FILE_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

/**
 * Reject server-declared file names that could escape their target dir.
 * Leading dot and path separators are excluded by the allowlist.
 */
export function isSafeFileName(name: string): boolean {
	return SAFE_FILE_NAME_RE.test(name);
}

export function assertSafeFileName(name: string): void {
	if (!isSafeFileName(name)) {
		throw new Error(`unsafe file name: ${JSON.stringify(name)}`);
	}
}

/** Ensure the parent dir of `path` exists (shared by secret/state/db writers). */
export function ensureParentDir(path: string): void {
	mkdirSync(dirname(path), { recursive: true });
}

/**
 * chmod 0600 a file, optionally including SQLite sidecars (`-wal`, `-shm`,
 * `-journal`). Ignores errors on non-POSIX platforms.
 */
export function chmod0600(path: string, sidecars: string[] = []): void {
	try {
		chmodSync(path, 0o600);
	} catch {
		// ignore on non-POSIX platforms
	}
	for (const suffix of sidecars) {
		try {
			chmodSync(path + suffix, 0o600);
		} catch {
			// sidecar may not exist; ignore
		}
	}
}

/**
 * Write a file with 0600 perms (secrets, identity, desired-state).
 * Atomic: tmp file in the same dir + rename + fsync (crash yields old or
 * new, never partial). Parent dirs are created first.
 */
export function writeFile0600(path: string, content: string | Buffer): void {
	ensureParentDir(path);
	writeFileAtomic.sync(path, content, { mode: 0o600 });
}

/** Write pretty-printed JSON with 0600 perms. */
export function saveJson0600(path: string, value: unknown): void {
	writeFile0600(path, `${JSON.stringify(value, null, 2)}\n`);
}
