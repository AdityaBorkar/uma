/**
 * Canonical process runner: spawn, capture stdout/stderr, kill on timeout.
 * Used by sandbox drivers, host metrics, and config probes.
 */
export async function runCapture(
	bin: string,
	args: string[],
	timeoutMs = 8000,
): Promise<{ code: number; stdout: string; stderr: string } | null> {
	try {
		const proc = Bun.spawn([bin, ...args], {
			stderr: "pipe",
			stdout: "pipe",
		});
		const timer = setTimeout(() => {
			try {
				proc.kill();
			} catch {
				// ignore
			}
		}, timeoutMs);
		const [so, se, code] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		]);
		clearTimeout(timer);
		return { code, stderr: se, stdout: so };
	} catch {
		return null;
	}
}

export async function whichBin(bin: string): Promise<string | null> {
	const r = await runCapture("which", [bin], 3000);
	if (r?.code !== 0) return null;
	const p = r.stdout.trim().split("\n")[0]?.trim();
	return p && p.length > 0 ? p : null;
}
