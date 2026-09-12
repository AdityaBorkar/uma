import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import {
	ListEmptyCard,
	ListResultCard,
	PageHeader,
} from "#/components/lists/shared.tsx";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert.tsx";
import { Badge } from "#/components/ui/badge.tsx";
import { Button } from "#/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Label } from "#/components/ui/label.tsx";
import { useToast } from "#/components/ui/toaster.tsx";
import {
	buildInstallCommand,
	buildRemoveCommand,
	buildUpdateCommand,
	buildVerifyCommand,
	defaultNameForSource,
	type InstalledSkillEntry,
	isSafeSkillSource,
	isSafeSkillVersion,
	loadStore,
	normalizeSkillSource,
	type SkillsStore,
	saveStore,
	type VerifiedSkill,
} from "#/lib/skills/skills.ts";

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

function useSkillsStore() {
	const [store, setStore] = useState<SkillsStore>({ items: [] });

	useEffect(() => {
		// Local-only persistence: render SSR-safe empty first, then hydrate.
		try {
			setStore(loadStore());
		} catch {
			// ignore
		}
	}, []);

	function update(next: SkillsStore) {
		setStore(next);
		saveStore(next);
	}

	return {
		addItem(item: InstalledSkillEntry) {
			update({ items: [...store.items, item] });
		},
		removeItem(id: string) {
			update({ items: store.items.filter((i) => i.id !== id) });
		},
		store,
		updateItem(id: string, patch: Partial<InstalledSkillEntry>) {
			update({
				items: store.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
			});
		},
	};
}

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
		`/api/skills/verify?source=${encodeURIComponent(source)}`,
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
		version && !isSafeSkillVersion(version)
			? "Letters, digits, . _ - / : @ + ^ ~ only, max 128."
			: null;
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
		<Dialog onOpenChange={(next) => !next && onClose()} open={open}>
			<DialogContent className="max-w-2xl p-0" onClose={onClose}>
				<DialogHeader className="px-4 py-3">
					<DialogTitle>Install skill</DialogTitle>
					<DialogDescription>
						Paste a GitHub link, verify it with{" "}
						<code className="font-mono">bunx skills add</code>, optionally pin a
						version, then save.
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-4">
					<div className="space-y-1.5">
						<Label className="text-xs font-semibold" htmlFor="skill-source">
							GitHub link
						</Label>
						<Input
							id="skill-source"
							onChange={(e) => {
								setSourceInput(e.target.value);
								setVerify({ status: "idle" });
							}}
							placeholder="vercel-labs/agent-skills or https://github.com/vercel-labs/agent-skills"
							value={sourceInput}
						/>
						{sourceError ? (
							<p className="text-destructive text-xs">{sourceError}</p>
						) : null}
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
					</div>

					<div className="space-y-1.5">
						<Label className="text-xs font-semibold" htmlFor="skill-version">
							Version pin (optional)
						</Label>
						<Input
							id="skill-version"
							onChange={(e) => setVersionInput(e.target.value)}
							placeholder="v1.2.0 or commit SHA — empty means floating latest"
							value={versionInput}
						/>
						{versionError ? (
							<p className="text-destructive text-xs">{versionError}</p>
						) : null}
						<p className="text-muted-foreground text-xs">
							The CLI has no version flag, so the pin is stored as metadata.
							Upgrading pulls latest via{" "}
							<code className="font-mono">bunx skills update</code>.
						</p>
					</div>

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
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold">Install command</Label>
							<code className="block rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs break-all">
								{buildInstallCommand(source)}
							</code>
						</div>
					) : null}

					<div className="flex items-center justify-end gap-2">
						<Button onClick={onClose} size="sm" type="button" variant="ghost">
							Cancel
						</Button>
						<Button
							disabled={!valid}
							onClick={handleSave}
							size="sm"
							type="button"
							variant="primary"
						>
							{verify.status === "ok" ? "Save verified skill" : "Save skill"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
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
		version && !isSafeSkillVersion(version)
			? "Letters, digits, . _ - / : @ + ^ ~ only, max 128."
			: null;

	return (
		<Dialog onOpenChange={(next) => !next && onClose()} open={open}>
			<DialogContent className="p-0" onClose={onClose}>
				<DialogHeader className="px-4 py-3">
					<DialogTitle>Pin version — {item.name}</DialogTitle>
					<DialogDescription>
						Empty clears the pin and tracks latest. Stored as metadata; the CLI
						always installs latest.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 px-4 py-4">
					<div className="space-y-1.5">
						<Label className="text-xs font-semibold" htmlFor="pin-version">
							Version pin (optional)
						</Label>
						<Input
							id="pin-version"
							onChange={(e) => setVersionInput(e.target.value)}
							placeholder="v1.2.0 or commit SHA"
							value={versionInput}
						/>
						{error ? <p className="text-destructive text-xs">{error}</p> : null}
					</div>
					<div className="flex items-center justify-end gap-2">
						<Button onClick={onClose} size="sm" type="button" variant="ghost">
							Cancel
						</Button>
						<Button
							disabled={!!error}
							onClick={() => onSave(version === "" ? null : version)}
							size="sm"
							type="button"
							variant="primary"
						>
							Save pin
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function SkillsPage() {
	const { toast } = useToast();
	const { addItem, removeItem, store, updateItem } = useSkillsStore();
	const [q, setQ] = useState("");
	const [installOpen, setInstallOpen] = useState(false);
	const [pinning, setPinning] = useState<InstalledSkillEntry | null>(null);
	const [checking, setChecking] = useState<string | null>(null);

	const items = useMemo(() => {
		const needle = q.trim().toLowerCase();
		const list = store.items;
		if (!needle) return list;
		return list.filter(
			(i) =>
				i.name.toLowerCase().includes(needle) ||
				i.source.toLowerCase().includes(needle),
		);
	}, [store.items, q]);
	const existingSources = useMemo(
		() => store.items.map((i) => i.source),
		[store.items],
	);

	function copyText(text: string, title: string) {
		void navigator.clipboard?.writeText(text).then(
			() => toast({ title }),
			() => toast({ title: "Copy failed", variant: "destructive" }),
		);
	}

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

			<div className="flex gap-3">
				<div className="w-full max-w-sm space-y-1.5">
					<Label className="text-xs font-semibold" htmlFor="skill-search">
						Search
					</Label>
					<Input
						id="skill-search"
						onChange={(e) => setQ(e.target.value)}
						placeholder="Filter by name or source…"
						value={q}
					/>
				</div>
			</div>

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
							<div
								className="flex flex-col gap-2 border-b px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
								key={item.id}
							>
								<div className="min-w-0">
									<p className="font-mono font-semibold text-sm">{item.name}</p>
									<p className="truncate font-mono text-muted-foreground text-xs">
										{item.source}
										{item.version ? ` · pinned ${item.version}` : ""}
									</p>
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
								</div>
								<div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-center">
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
								</div>
							</div>
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
