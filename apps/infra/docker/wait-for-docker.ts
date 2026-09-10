import { spawn } from "bun";

const PROBE_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 5000;

export interface WaitForDockerOptions {
	/** SSH option flags for `ssh://` hosts, passed straight to the local `ssh` binary (mirrors docker.Provider `sshOpts`). */
	sshOpts?: string[];
	/** How long to keep polling before failing. */
	timeoutMs?: number;
}

/**
 * Waits until `docker version` answers on the given daemon address, then resolves.
 *
 * The address is the same `host` string the docker provider accepts:
 * - `unix://…` / `npipe://…` / empty — local daemon via the Docker CLI
 * - `ssh://[user@]host[:port]` — remote daemon over the local OpenSSH client
 * - `tcp://…`, `http(s)://…` — any other address, passed through to `docker -H`
 */
export function waitForDocker(
	host: string,
	{ sshOpts = [], timeoutMs = 300_000 }: WaitForDockerOptions = {},
): Promise<void> {
	const probe = probeFor(host, sshOpts);
	const deadline = Date.now() + timeoutMs;

	const poll = async (): Promise<void> => {
		if (Date.now() >= deadline) {
			throw new Error(
				`Timed out after ${Math.round(timeoutMs / 1000)}s waiting for Docker at ${probe.label} — ${
					probe.command === "ssh"
						? "check vps:sshPublicKey and /var/log/cloud-init-output.log on the instance"
						: "check that the daemon is running and the address is reachable"
				}`,
			);
		}
		try {
			const proc = spawn([probe.command, ...probe.args], {
				signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
			});
			await new Response(proc.stdout).text();
			await new Response(proc.stderr).text();
			await proc.exited;
		} catch (error) {
			const err = error as NodeJS.ErrnoException;
			if (err.code === "ENOENT") {
				throw new Error(
					probe.command === "ssh"
						? "The machine needs an OpenSSH client (`ssh`) to wait for remote Docker."
						: "The machine needs the Docker CLI (`docker`) to check the daemon.",
				);
			}
			await sleep(POLL_INTERVAL_MS);
			return poll();
		}
	};

	return poll();
}

function sleep(ms: number): Promise<void> {
	const { promise, resolve } = Promise.withResolvers<void>();
	setTimeout(resolve, ms);
	return promise;
}

const SSH_HOST = /^ssh:\/\/(?:([^@/]+)@)?([^:/]+)(?::(\d+))?/;

function probeFor(host: string, sshOpts: string[]) {
	const ssh = SSH_HOST.exec(host);
	if (ssh) {
		const [, user, address, port] = ssh;
		const args = [...sshOpts];
		if (port) {
			args.push("-p", port);
		}
		args.push(`${user ? `${user}@` : ""}${address}`, "docker", "version");
		return { args, command: "ssh", label: host };
	}

	if (!host || host.startsWith("unix://") || host.startsWith("npipe://")) {
		return {
			args: host ? ["-H", host, "version"] : ["version"],
			command: "docker",
			label: host || "the local daemon",
		};
	}
	return { args: ["-H", host, "version"], command: "docker", label: host };
}
