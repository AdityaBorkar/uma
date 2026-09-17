import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { FormDialog } from "#/components/forms/FormDialog.tsx";
import { FormField } from "#/components/forms/FormField.tsx";
import { DialogFooter } from "#/components/forms/FormFooter.tsx";
import { FilterBar } from "#/components/lists/FilterBar.tsx";
import {
	ListRow,
	ListRowActions,
	ListRowMain,
	ListRowSubtitle,
	ListRowTitle,
} from "#/components/lists/ListRow.tsx";
import {
	ListEmptyCard,
	ListResultCard,
	PageHeader,
} from "#/components/lists/shared.tsx";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert.tsx";
import { Badge } from "#/components/ui/badge.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Input } from "#/components/ui/input.tsx";
import { useToast } from "#/components/ui/toaster.tsx";
import { apiUrl } from "#/env.ts";
import { VERSION_PIN_ERROR } from "#/lib/forms.ts";
import { useFilteredByQuery } from "#/lib/lists.ts";
import {
	buildInstallCommand,
	buildRemoveCommand,
	buildUpdateCommand,
	buildVerifyCommand,
	defaultNameForSource,
	type InstalledSkillEntry,
	isSafeSkillSource,
	isSafeSkillVersion,
	normalizeSkillSource,
	type VerifiedSkill,
} from "#/lib/skills/skills.ts";
import { copyText } from "#/stores/clipboard.ts";
import { useLocalSearchInput } from "#/stores/filters.ts";
import { hydrateSkillsStore, useSkillsStore } from "#/stores/registries.ts";

export const Route = createFileRoute("/(app)/settings/skills")({
	component: SkillsPage,
	head: () => ({
		meta: [
			{ title: "Skills — Planner" },
			{
				content:
					"Install agent skills from GitHub via skills.sh, verify with bunx, and pin versions.",
				name: "description",
			},
		],
	}),
});

type VerifyState =
	| { status: "idle" }
	| { status: "verifying" }
	| { status: "ok"; count: number; skills: VerifiedSkill[] }
	| { status: "error"; message: string };

type VerifyResult =
	| { status: "ok"; count: number; skills: VerifiedSkill[] }
	| { status: "error"; message: string };

async function verifySource(source: string): Promise<VerifyResult> {
	const res = await fetch(
		apiUrl(`/api/skills/verify?source=${encodeURIComponent(source)}`),
	);
	const data = (await res.json()) as {
		count?: number;
		error?: string;
		skills?: VerifiedSkill[];
	};
	if (!res.ok) {
		return {
			message: data.error ?? "Verification failed",
			status: "error",
		};
	}
	return {
		count: data.count ?? data.skills?.length ?? 0,
		skills: Array.isArray(data.skills) ? data.skills : [],
		status: "ok",
	};
}

function InstallDialog({
	existingSources,
	onClose,
	onSave,
	open,
}: {
	existingSources: string[];
	onClose: () => void;
	onSave: (item: InstalledSkillEntry) => void;
	open: boolean;
}) {
	const [sourceInput, setSourceInput] = useState("");
	const [versionInput, setVersionInput] = useState("");
	const [verify, setVerify] = useState<VerifyState>({ status: "idle" });

	useEffect(() => {
		if (open) {
			setSourceInput("");
			setVersionInput("");
			setVerify({ status: "idle" });
		}
	}, [open]);

	const source = sourceInput.trim();
	const version = versionInput.trim();
	const normalized = source ? normalizeSkillSource(source) : null;
	const sourceError =
		source && !isSafeSkillSource(source)
			? "No whitespace, max 512 characters."
			: null;
	const duplicate =
		source !== "" &&
		existingSources.some((s) => s.toLowerCase() === source.toLowerCase());
	const versionError =
		version && !isSafeSkillVersion(version) ? VERSION_PIN_ERROR : null;
	const valid = source !== "" && !sourceError && !duplicate && !versionError;

	async function handleVerify() {
		if (!valid) return;
		setVerify({ status: "verifying" });
		try {
			setVerify(await verifySource(source));
		} catch {
			setVerify({
				message: "Could not reach the verify endpoint.",
				status: "error",
			});
		}
	}

	function handleSave() {
		if (!valid || !normalized) return;
		onSave({
			availableSkills: verify.status === "ok" ? verify.skills : [],
			githubUrl: normalized.githubUrl,
			id: crypto.randomUUID(),
			installedAt: new Date().toISOString(),
			lastCheckedAt: verify.status === "ok" ? new Date().toISOString() : null,
			name: defaultNameForSource(source),
			source,
			verified: verify.status === "ok",
			version: version === "" ? null : version,
		});
	}

	return (
		<FormDialog
			description={
				<>
					Paste a GitHub link, verify it with{" "}
					<code className="font-mono">bunx skills add</code>, optionally pin a
					version, then save.
				</>
			}
			maxWidth="lg"
			onClose={onClose}
			onOpenChange={(next) => {
				if (!next) {
					onClose();
				}
			}}
			open={open}
			title="Install skill"
		>
			<FormField error={sourceError} id="skill-source" label="GitHub link">
				<Input
					id="skill-source"
					onChange={(e) => {
						setSourceInput(e.target.value);
						setVerify({ status: "idle" });
					}}
					placeholder="vercel-labs/agent-skills or https://github.com/vercel-labs/agent-skills"
					value={sourceInput}
				/>
				{duplicate ? (
					<p className="text-destructive text-xs">
						This source is already installed.
					</p>
				) : null}
				{normalized?.githubUrl ? (
					<p className="text-muted-foreground text-xs">
						Repo:{" "}
						<a
							className="underline"
							href={normalized.githubUrl}
							rel="noreferrer"
							target="_blank"
						>
							{normalized.githubUrl}
						</a>
					</p>
				) : null}
			</FormField>

			<FormField
				error={versionError}
				hint={
					<>
						The CLI has no version flag, so the pin is stored as metadata.
						Upgrading pulls latest via{" "}
						<code className="font-mono">bunx skills update</code>.
					</>
				}
				id="skill-version"
				label="Version pin (optional)"
			>
				<Input
					id="skill-version"
					onChange={(e) => setVersionInput(e.target.value)}
					placeholder="v1.2.0 or commit SHA — empty means floating latest"
					value={versionInput}
				/>
			</FormField>

			<div className="flex items-center gap-2">
				<Button
					disabled={!valid || verify.status === "verifying"}
					onClick={() => void handleVerify()}
					size="sm"
					type="button"
					variant="outline"
				>
					{verify.status === "verifying" ? "Verifying…" : "Verify"}
				</Button>
				{source && !sourceError ? (
					<code className="truncate font-mono text-muted-foreground text-xs">
						{buildVerifyCommand(source)}
					</code>
				) : null}
			</div>

			{verify.status === "error" ? (
				<Alert variant="destructive">
					<AlertTitle>Verification failed</AlertTitle>
					<AlertDescription>{verify.message}</AlertDescription>
				</Alert>
			) : null}

			{verify.status === "ok" ? (
				<Alert>
					<AlertTitle>
						{verify.count} skill{verify.count === 1 ? "" : "s"} found
					</AlertTitle>
					<AlertDescription>
						{verify.skills.length > 0 ? (
							<ul className="mt-1 list-disc space-y-1 pl-4">
								{verify.skills.slice(0, 10).map((s) => (
									<li key={s.name}>
										<span className="font-mono">{s.name}</span>
										{s.description ? ` — ${s.description}` : ""}
									</li>
								))}
							</ul>
						) : (
							"Source resolves."
						)}
					</AlertDescription>
				</Alert>
			) : null}

			{source && !sourceError ? (
				<FormField id="skill-install-command" label="Install command">
					<code className="block rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs break-all">
						{buildInstallCommand(source)}
					</code>
				</FormField>
			) : null}

			<DialogFooter
				disabled={!valid}
				onCancel={onClose}
				onSave={handleSave}
				saveLabel={
					verify.status === "ok" ? "Save verified skill" : "Save skill"
				}
			/>
		</FormDialog>
	);
}

function PinDialog({
	item,
	onClose,
	onSave,
	open,
}: {
	item: InstalledSkillEntry;
	onClose: () => void;
	onSave: (version: string | null) => void;
	open: boolean;
}) {
	const [versionInput, setVersionInput] = useState(item.version ?? "");

	useEffect(() => {
		if (open) setVersionInput(item.version ?? "");
	}, [open, item.version]);

	const version = versionInput.trim();
	const error =
		version && !isSafeSkillVersion(version) ? VERSION_PIN_ERROR : null;

	return (
		<FormDialog
			description="Empty clears the pin and tracks latest. Stored as metadata; the CLI always installs latest."
			onClose={onClose}
			onOpenChange={(next) => {
				if (!next) {
					onClose();
				}
			}}
			open={open}
			title={`Pin version — ${item.name}`}
		>
			<FormField error={error} id="pin-version" label="Version pin (optional)">
				<Input
					id="pin-version"
					onChange={(e) => setVersionInput(e.target.value)}
					placeholder="v1.2.0 or commit SHA"
					value={versionInput}
				/>
			</FormField>
			<DialogFooter
				disabled={Boolean(error)}
				onCancel={onClose}
				onSave={() => onSave(version === "" ? null : version)}
				saveLabel="Save pin"
			/>
		</FormDialog>
	);
}

function SkillsPage() {
	const { toast } = useToast();
	const { addItem, removeItem, store, updateItem } = useSkillsStore();
	const {
		input: qInput,
		query: q,
		setInput: setQInput,
	} = useLocalSearchInput("", 200);
	const [installOpen, setInstallOpen] = useState(false);
	const [pinning, setPinning] = useState<InstalledSkillEntry | null>(null);
	const [checking, setChecking] = useState<string | null>(null);

	useEffect(() => {
		hydrateSkillsStore();
	}, []);

	const items = useFilteredByQuery(store.items, q, (i) => [i.name, i.source]);
	const existingSources = useMemo(
		() => store.items.map((i) => i.source),
		[store.items],
	);

	async function handleUpgrade(item: InstalledSkillEntry) {
		setChecking(item.id);
		try {
			const result = await verifySource(item.source);
			if (result.status === "ok") {
				updateItem(item.id, {
					availableSkills: result.skills,
					lastCheckedAt: new Date().toISOString(),
					verified: true,
				});
				toast({
					description: `${result.count} skill${result.count === 1 ? "" : "s"} at latest. Run the update command to upgrade.`,
					title: "Upgrade check complete",
				});
				copyText(
					buildUpdateCommand(item.availableSkills[0]?.name ?? item.name),
					"Update command copied",
				);
			} else {
				toast({
					description: result.message,
					title: "Upgrade check failed",
					variant: "destructive",
				});
			}
		} catch {
			toast({
				description: "Could not reach the verify endpoint.",
				title: "Upgrade check failed",
				variant: "destructive",
			});
		} finally {
			setChecking(null);
		}
	}

	return (
		<div className="space-y-6">
			<PageHeader
				action={
					<Button onClick={() => setInstallOpen(true)} variant="primary">
						Install skill
					</Button>
				}
				description="Install agent skills from GitHub via skills.sh. Verify with bunx skills add, optionally pin a version."
				title="Skills"
			/>

			<FilterBar
				search={{
					id: "skill-search",
					onChange: setQInput,
					placeholder: "Filter by name or source…",
					value: qInput,
				}}
				variant="bare"
			/>

			{items.length === 0 ? (
				<ListEmptyCard
					action={
						<Button
							className="mt-4"
							onClick={() => setInstallOpen(true)}
							variant="primary"
						>
							Install skill
						</Button>
					}
					description="Paste a GitHub link, verify it with bunx skills add --list, and optionally pin a version."
					title={store.items.length === 0 ? "No skills" : "No matches"}
				/>
			) : (
				<ListResultCard
					summary={
						<>
							<span className="font-semibold">
								{items.length} skill{items.length === 1 ? "" : "s"}
							</span>
						</>
					}
				>
					<div>
						{items.map((item) => (
							<ListRow key={item.id}>
								<ListRowMain>
									<ListRowTitle mono={true}>{item.name}</ListRowTitle>
									<ListRowSubtitle>
										{item.source}
										{item.version ? ` · pinned ${item.version}` : ""}
									</ListRowSubtitle>
									{item.availableSkills.length > 0 ? (
										<p className="truncate text-muted-foreground text-xs">
											{item.availableSkills
												.slice(0, 3)
												.map((s) => s.name)
												.join(", ")}
											{item.availableSkills.length > 3
												? ` +${item.availableSkills.length - 3} more`
												: ""}
										</p>
									) : null}
								</ListRowMain>
								<ListRowActions>
									{item.version ? (
										<Badge variant="outline">pinned {item.version}</Badge>
									) : (
										<Badge variant="outline">floating</Badge>
									)}
									{item.verified ? (
										<Badge variant="success">verified</Badge>
									) : (
										<Badge variant="outline">unverified</Badge>
									)}
									{item.githubUrl ? (
										<a href={item.githubUrl} rel="noreferrer" target="_blank">
											<Button size="sm" type="button" variant="outline">
												GitHub
											</Button>
										</a>
									) : null}
									<Button
										onClick={() =>
											copyText(
												buildInstallCommand(item.source),
												"Install command copied",
											)
										}
										size="sm"
										type="button"
										variant="outline"
									>
										Copy install
									</Button>
									<Button
										disabled={checking === item.id}
										onClick={() => void handleUpgrade(item)}
										size="sm"
										type="button"
										variant="outline"
									>
										{checking === item.id ? "Checking…" : "Upgrade"}
									</Button>
									<Button
										onClick={() => setPinning(item)}
										size="sm"
										type="button"
										variant="outline"
									>
										Pin
									</Button>
									<Button
										onClick={() => {
											copyText(
												buildRemoveCommand(
													item.availableSkills[0]?.name ?? item.name,
												),
												"Remove command copied",
											);
											removeItem(item.id);
											toast({ title: "Skill removed" });
										}}
										size="sm"
										type="button"
										variant="destructive"
									>
										Remove
									</Button>
								</ListRowActions>
							</ListRow>
						))}
					</div>
				</ListResultCard>
			)}

			<InstallDialog
				existingSources={existingSources}
				onClose={() => setInstallOpen(false)}
				onSave={(item) => {
					addItem(item);
					setInstallOpen(false);
					toast({
						description: item.source,
						title: item.verified
							? "Skill installed"
							: "Skill saved (unverified)",
					});
				}}
				open={installOpen}
			/>
			{pinning ? (
				<PinDialog
					item={pinning}
					onClose={() => setPinning(null)}
					onSave={(version) => {
						updateItem(pinning.id, { version });
						setPinning(null);
						toast({
							description: version ?? "floating latest",
							title: "Version pin updated",
						});
					}}
					open={true}
				/>
			) : null}
		</div>
	);
}
