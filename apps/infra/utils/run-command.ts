import { resolve } from "node:path";
import process from "node:process";
import { $, spawn } from "bun";

import { cancel, isCancel, log, password, spinner } from "@clack/prompts";
import { Command } from "commander";

import { extractEnv, type PulumiConfig } from "./extract-env.ts";

const program = new Command()
	.name("run-command")
	.description(
		"Start a command with env vars sourced from the active Pulumi stack config",
	)
	.enablePositionalOptions()
	.passThroughOptions()
	.argument("[command...]", "command to run instead of the default vite dev")
	.allowExcessArguments(true)
	.option(
		"--stack <stack>",
		"Pulumi stack whose config drives the env",
		process.env.PULUMI_STACK ?? "dev",
	)
	.option(
		"--namespace <namespace>",
		"Pulumi config namespace holding the app env vars",
	)
	.option("--verbose", "Print verbose output", false);

program.parse(process.argv);
const command = program.args;
const options = program.opts();

try {
	const PROJECT_DIR = resolve(import.meta.dir, "../../");

	const passphrase =
		process.env.PULUMI_CONFIG_PASSPHRASE ??
		(process.stdin.isTTY
			? await password({
					mask: "*",
					message: `Pulumi config passphrase for stack "${options.stack}"`,
				})
			: null);
	if (passphrase === null) {
		throw new Error(
			`PULUMI_CONFIG_PASSPHRASE is not set and no TTY is available to prompt for it (e.g. in CI). Export PULUMI_CONFIG_PASSPHRASE to run non-interactively.`,
		);
	}
	if (isCancel(passphrase)) {
		cancel("Operation cancelled.");
		process.exit(0);
	}

	const spin = spinner();
	spin.start(`Reading config for stack "${options.stack}"`);

	let env: Record<string, string>;
	try {
		const result =
			await $`pulumi config --json --show-secrets --stack ${options.stack}`
				.cwd(PROJECT_DIR)
				.env({ ...process.env, PULUMI_CONFIG_PASSPHRASE: passphrase })
				.quiet()
				.nothrow();

		if (result.exitCode !== 0) {
			const detail =
				result.stderr.toString().trim() ||
				result.stdout.toString().trim() ||
				`exited with code ${result.exitCode}`;
			throw new Error(
				`Failed to read config for stack "${options.stack}": ${detail} (is it selected? try "pulumi stack select ${options.stack}")`,
			);
		}

		const config = JSON.parse(result.stdout.toString()) as PulumiConfig;
		env = extractEnv(config, options.namespace);
	} catch (error) {
		spin.stop("Failed");
		throw error;
	}
	spin.stop(
		`Config loaded for stack "${options.stack}": ${Object.keys(env).sort().join(", ")}`,
	);

	const [commandName, ...commandArgs] = command;
	if (!commandName) {
		throw new Error("No command to run");
	}

	log.step(`${options.stack} $ ${command.join(" ")}`);
	const child = spawn([commandName, ...commandArgs], {
		cwd: PROJECT_DIR,
		env: { ...process.env, ...env },
		stdio: ["inherit", "inherit", "inherit"],
	});

	for (const signal of ["SIGINT", "SIGTERM"] as const) {
		process.on(signal, () => {
			child.kill(signal);
		});
	}

	await child.exited;

	if (child.signalCode) {
		process.kill(process.pid, child.signalCode);
	} else {
		process.exit(child.exitCode ?? 1);
	}
} catch (error) {
	log.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
