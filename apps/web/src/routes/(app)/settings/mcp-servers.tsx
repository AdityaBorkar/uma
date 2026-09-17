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
import { Card, CardContent } from "#/components/ui/card.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Label } from "#/components/ui/label.tsx";
import { Select } from "#/components/ui/select.tsx";
import { useToast } from "#/components/ui/toaster.tsx";
import {
	buildMcpJson,
	buildRunCommand,
	defaultNameForPackage,
	type InstalledMcpEntry,
	isSafeMcpName,
	isSafeMcpPackage,
	isSafeMcpUrl,
	isSafeMcpVersion,
	isValidMcpRuntime,
	type McpKind,
	type McpRuntime,
} from "#/lib/mcp/mcp.ts";
import { copyText } from "#/stores/clipboard.ts";
import { useLocalSearchInput } from "#/stores/filters.ts";
import { hydrateMcpStore, useMcpStore } from "#/stores/registries.ts";

export const Route = createFileRoute("/(app)/settings/mcp-servers")({
	component: McpServersPage,
	head: () => ({
		meta: [
			{ title: "MCP Servers — Planner" },
			{
				content:
					"Install opencode MCP servers, pin versions, and manage the local registry.",
				name: "description",
			},
		],
	}),
});

type LatestResult =
	| { latest: string; status: "ok" }
	| { message: string; status: "error" };

async function fetchLatest(pkg: string): Promise<LatestResult> {
	const res = await fetch(
		`/api/mcp/versions?package=${encodeURIComponent(pkg)}`,
	);
	const data = (await res.json()) as { error?: string; latest?: string };
	if (!res.ok || typeof data.latest !== "string") {
		return {
			message: data.error ?? "Version lookup failed",
			status: "error",
		};
	}
	return { latest: data.latest, status: "ok" };
}

function InstallDialog({
	existingNames,
	onClose,
	onSave,
	open,
}: {
	existingNames: string[];
	onClose: () => void;
	onSave: (item: InstalledMcpEntry) => void;
	open: boolean;
}) {
	const [kind, setKind] = useState<McpKind>("local");
	const [nameInput, setNameInput] = useState("");
	const [packageInput, setPackageInput] = useState("");
	const [urlInput, setUrlInput] = useState("");
	const [runtime, setRuntime] = useState<McpRuntime>("npx");
	const [versionInput, setVersionInput] = useState("");
	const [enabled, setEnabled] = useState(true);

	useEffect(() => {
		if (open) {
			setKind("local");
			setNameInput("");
			setPackageInput("");
			setUrlInput("");
			setRuntime("npx");
			setVersionInput("");
			setEnabled(true);
		}
	}, [open]);

	const name = nameInput.trim();
	const pkg = packageInput.trim();
	const url = urlInput.trim();
	const version = versionInput.trim();

	const nameError =
		name === ""
			? null
			: !isSafeMcpName(name)
				? "Letters, digits, _ and -, max 64, alnum start."
				: null;
	const duplicate =
		name !== "" &&
		existingNames.some((n) => n.toLowerCase() === name.toLowerCase());
	const packageError =
		kind === "local" && pkg !== "" && !isSafeMcpPackage(pkg)
			? "npm package name (optional @scope/), max 214."
			: null;
	const urlError =
		kind === "remote" && url !== "" && !isSafeMcpUrl(url)
			? "http(s) URL, max 2048 characters."
			: null;
	const versionError =
		version !== "" && !isSafeMcpVersion(version)
			? "Letters, digits, . _ - / : @ + ^ ~ only, max 128."
			: null;

	const valid =
		name !== "" &&
		!nameError &&
		!duplicate &&
		!versionError &&
		(kind === "local" ? pkg !== "" && !packageError : url !== "" && !urlError);

	function handleNameFromPackage(value: string) {
		setPackageInput(value);
		if (nameInput.trim() === "" && isSafeMcpPackage(value.trim())) {
			setNameInput(
				defaultNameForPackage(value.trim()).replace(/[^A-Za-z0-9_-]/g, "-"),
			);
		}
	}

	function handleSave() {
		if (!valid) return;
		const base = {
			enabled,
			id: crypto.randomUUID(),
			installedAt: new Date().toISOString(),
			lastCheckedAt: null,
			latestVersion: null,
			name,
			version: version === "" ? null : version,
		} as const;
		onSave(
			kind === "local"
				? {
						...base,
						kind: "local",
						package: pkg,
						runtime: isValidMcpRuntime(runtime) ? runtime : "npx",
						url: "",
					}
				: {
						...base,
						kind: "remote",
						package: "",
						runtime: "npx",
						url,
					},
		);
	}

	const previewEntry: InstalledMcpEntry = {
		enabled,
		id: "preview",
		installedAt: new Date().toISOString(),
		kind,
		lastCheckedAt: null,
		latestVersion: null,
		name: name === "" ? "my-mcp" : name,
		package: kind === "local" ? (pkg === "" ? "my-mcp-command" : pkg) : "",
		runtime,
		url:
			kind === "remote" ? (url === "" ? "https://my-mcp-server.com" : url) : "",
		version: version === "" ? null : version,
	};

	return (
		<Dialog onOpenChange={(next) => !next && onClose()} open={open}>
			<DialogContent className="max-w-2xl p-0" onClose={onClose}>
				<DialogHeader className="px-4 py-3">
					<DialogTitle>Install MCP server</DialogTitle>
					<DialogDescription>
						Local servers run via{" "}
						<code className="font-mono">npx -y pkg[@version]</code>; remote
						servers connect over HTTPS. Saved to this browser in v1 — paste the
						JSON into <code className="font-mono">opencode.json</code>.
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold" htmlFor="mcp-kind">
								Type
							</Label>
							<Select
								id="mcp-kind"
								onChange={(e) =>
									setKind(e.target.value === "remote" ? "remote" : "local")
								}
								value={kind}
							>
								<option value="local">Local (npm package)</option>
								<option value="remote">Remote (URL)</option>
							</Select>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold" htmlFor="mcp-name">
								Name (opencode mcp key)
							</Label>
							<Input
								id="mcp-name"
								onChange={(e) => setNameInput(e.target.value)}
								placeholder="mcp_everything"
								value={nameInput}
							/>
							{nameError ? (
								<p className="text-destructive text-xs">{nameError}</p>
							) : null}
							{duplicate ? (
								<p className="text-destructive text-xs">
									This name is already installed.
								</p>
							) : null}
						</div>
					</div>

					{kind === "local" ? (
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-1.5">
								<Label className="text-xs font-semibold" htmlFor="mcp-package">
									npm package
								</Label>
								<Input
									id="mcp-package"
									onChange={(e) => handleNameFromPackage(e.target.value)}
									placeholder="@modelcontextprotocol/server-everything"
									value={packageInput}
								/>
								{packageError ? (
									<p className="text-destructive text-xs">{packageError}</p>
								) : null}
							</div>
							<div className="space-y-1.5">
								<Label className="text-xs font-semibold" htmlFor="mcp-runtime">
									Launcher
								</Label>
								<Select
									id="mcp-runtime"
									onChange={(e) =>
										setRuntime(
											isValidMcpRuntime(e.target.value)
												? e.target.value
												: "npx",
										)
									}
									value={runtime}
								>
									<option value="npx">npx</option>
									<option value="bunx">bunx</option>
									<option value="uvx">uvx</option>
								</Select>
							</div>
						</div>
					) : (
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold" htmlFor="mcp-url">
								Server URL
							</Label>
							<Input
								id="mcp-url"
								onChange={(e) => setUrlInput(e.target.value)}
								placeholder="https://mcp.context7.com/mcp"
								value={urlInput}
							/>
							{urlError ? (
								<p className="text-destructive text-xs">{urlError}</p>
							) : null}
						</div>
					)}

					<div className="space-y-1.5">
						<Label className="text-xs font-semibold" htmlFor="mcp-version">
							Version pin (optional)
						</Label>
						<Input
							id="mcp-version"
							onChange={(e) => setVersionInput(e.target.value)}
							placeholder={
								kind === "local"
									? "1.2.3 or ^1.0.0 — empty means floating latest"
									: "2024-01-01 or v2 — stored as metadata"
							}
							value={versionInput}
						/>
						{versionError ? (
							<p className="text-destructive text-xs">{versionError}</p>
						) : null}
						<p className="text-muted-foreground text-xs">
							{kind === "local"
								? "Pinned as pkg@version in the command array. Upgrade resolves latest from npm."
								: "Remote servers have no registry — the pin is metadata. Upgrade edits it by hand."}
						</p>
					</div>

					<label className="flex items-center gap-2 text-sm">
						<input
							checked={enabled}
							onChange={(e) => setEnabled(e.target.checked)}
							type="checkbox"
						/>
						Enabled on startup
					</label>

					<div className="space-y-1.5">
						<Label className="text-xs font-semibold">opencode.json</Label>
						<code className="block overflow-x-auto rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs whitespace-pre">
							{buildMcpJson(previewEntry)}
						</code>
						{kind === "local" ? (
							<p className="text-muted-foreground text-xs">
								Run preview:{" "}
								<code className="font-mono">
									{buildRunCommand(
										previewEntry.package,
										previewEntry.version,
										previewEntry.runtime,
									)}
								</code>
							</p>
						) : null}
					</div>

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
							Install server
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
	item: InstalledMcpEntry;
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
		version && !isSafeMcpVersion(version)
			? "Letters, digits, . _ - / : @ + ^ ~ only, max 128."
			: null;

	return (
		<Dialog onOpenChange={(next) => !next && onClose()} open={open}>
			<DialogContent className="p-0" onClose={onClose}>
				<DialogHeader className="px-4 py-3">
					<DialogTitle>Pin version — {item.name}</DialogTitle>
					<DialogDescription>
						{item.kind === "local"
							? "Empty clears the pin and tracks latest (pkg without @version)."
							: "Remote pins are metadata only — empty tracks latest."}
						{item.latestVersion ? ` Latest known: ${item.latestVersion}.` : ""}
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
							placeholder={
								item.kind === "local" ? "1.2.3 or ^1.0.0" : "2024-01-01 or v2"
							}
							value={versionInput}
						/>
						{error ? <p className="text-destructive text-xs">{error}</p> : null}
					</div>
					{item.latestVersion ? (
						<Alert>
							<AlertTitle>Latest known: {item.latestVersion}</AlertTitle>
							<AlertDescription>
								<Button
									onClick={() => setVersionInput(item.latestVersion ?? "")}
									size="sm"
									type="button"
									variant="outline"
								>
									Use {item.latestVersion}
								</Button>
							</AlertDescription>
						</Alert>
					) : null}
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

function McpServersPage() {
	const { toast } = useToast();
	const { addItem, removeItem, store, updateItem } = useMcpStore();
	const {
		input: qInput,
		query: q,
		setInput: setQInput,
	} = useLocalSearchInput("", 200);
	const [kindFilter, setKindFilter] = useState<"all" | McpKind>("all");
	const [installOpen, setInstallOpen] = useState(false);
	const [pinning, setPinning] = useState<InstalledMcpEntry | null>(null);
	const [checking, setChecking] = useState<string | null>(null);

	useEffect(() => {
		hydrateMcpStore();
	}, []);

	const items = useMemo(() => {
		const needle = (q ?? "").trim().toLowerCase();
		return store.items.filter((i) => {
			if (kindFilter !== "all" && i.kind !== kindFilter) return false;
			if (!needle) return true;
			return (
				i.name.toLowerCase().includes(needle) ||
				i.package.toLowerCase().includes(needle) ||
				i.url.toLowerCase().includes(needle)
			);
		});
	}, [store.items, q, kindFilter]);
	const existingNames = useMemo(
		() => store.items.map((i) => i.name),
		[store.items],
	);

	function handleCopy(text: string, title: string) {
		copyText(text, title);
	}

	async function handleUpgrade(item: InstalledMcpEntry) {
		if (item.kind === "remote") {
			setPinning(item);
			toast({
				description: "Remote servers have no registry — edit the pin by hand.",
				title: "Manual upgrade",
			});
			return;
		}
		setChecking(item.id);
		try {
			const result = await fetchLatest(item.package);
			if (result.status === "error") {
				toast({
					description: result.message,
					title: "Upgrade check failed",
					variant: "destructive",
				});
				return;
			}
			const latest = result.latest;
			const current = item.version;
			if (current !== null && current === latest) {
				updateItem(item.id, {
					lastCheckedAt: new Date().toISOString(),
					latestVersion: latest,
				});
				toast({
					description: `${item.package}@${latest}`,
					title: "Already at latest",
				});
				return;
			}
			updateItem(item.id, {
				lastCheckedAt: new Date().toISOString(),
				latestVersion: latest,
				version: latest,
			});
			toast({
				description:
					current === null
						? `${item.package}@${latest} pinned from floating latest`
						: `${item.package}@${current} → @${latest}`,
				title: "Upgraded to latest",
			});
		} catch {
			toast({
				description: "Could not reach the version endpoint.",
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
						Install server
					</Button>
				}
				description="Install opencode MCP servers, pin versions, and copy the opencode.json config."
				title="MCP Servers"
			/>

			<div className="flex flex-wrap gap-3">
				<div className="w-full max-w-sm space-y-1.5">
					<Label className="text-xs font-semibold" htmlFor="mcp-search">
						Search
					</Label>
					<Input
						id="mcp-search"
						onChange={(e) => setQInput(e.target.value)}
						placeholder="Filter by name, package, or URL…"
						value={qInput}
					/>
				</div>
				<div className="w-44 space-y-1.5">
					<Label className="text-xs font-semibold" htmlFor="mcp-kind-filter">
						Type
					</Label>
					<Select
						id="mcp-kind-filter"
						onChange={(e) =>
							setKindFilter(
								e.target.value === "remote" || e.target.value === "local"
									? e.target.value
									: "all",
							)
						}
						value={kindFilter}
					>
						<option value="all">All</option>
						<option value="local">Local</option>
						<option value="remote">Remote</option>
					</Select>
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
							Install server
						</Button>
					}
					description="Add a local npm package (npx -y pkg[@version]) or a remote HTTPS server, optionally pin a version, then paste the JSON into opencode.json."
					title={store.items.length === 0 ? "No MCP servers" : "No matches"}
				/>
			) : (
				<ListResultCard
					summary={
						<>
							<span className="font-semibold">
								{items.length} server{items.length === 1 ? "" : "s"}
							</span>
						</>
					}
				>
					<div>
						{items.map((item) => {
							const updateAvailable =
								item.kind === "local" &&
								item.latestVersion !== null &&
								item.version !== null &&
								item.version !== item.latestVersion;
							return (
								<div
									className="flex flex-col gap-2 border-b px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
									key={item.id}
								>
									<div className="min-w-0">
										<p className="font-mono font-semibold text-sm">
											{item.name}
										</p>
										<p className="truncate font-mono text-muted-foreground text-xs">
											{item.kind === "local"
												? buildRunCommand(
														item.package,
														item.version,
														item.runtime,
													)
												: item.url}
											{item.version ? ` · pinned ${item.version}` : ""}
											{item.kind === "local" && item.latestVersion
												? ` · latest ${item.latestVersion}`
												: ""}
										</p>
										<code className="mt-1 block max-h-24 overflow-auto rounded-md border bg-muted/50 px-2 py-1 font-mono text-[11px] whitespace-pre">
											{buildMcpJson(item)}
										</code>
									</div>
									<div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-center">
										<Badge variant="outline">{item.kind}</Badge>
										{item.version ? (
											<Badge variant="outline">pinned {item.version}</Badge>
										) : (
											<Badge variant="outline">floating</Badge>
										)}
										{item.enabled ? (
											<Badge variant="success">enabled</Badge>
										) : (
											<Badge variant="outline">disabled</Badge>
										)}
										{updateAvailable ? (
											<Badge variant="outline">
												update → {item.latestVersion}
											</Badge>
										) : null}
										<Button
											onClick={() =>
												updateItem(item.id, { enabled: !item.enabled })
											}
											size="sm"
											type="button"
											variant="outline"
										>
											{item.enabled ? "Disable" : "Enable"}
										</Button>
										<Button
											disabled={checking === item.id}
											onClick={() => void handleUpgrade(item)}
											size="sm"
											type="button"
											variant="outline"
										>
											{checking === item.id
												? "Checking…"
												: item.kind === "local"
													? "Upgrade"
													: "Upgrade"}
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
											onClick={() =>
												handleCopy(buildMcpJson(item), "Config JSON copied")
											}
											size="sm"
											type="button"
											variant="outline"
										>
											Copy JSON
										</Button>
										<Button
											onClick={() => {
												removeItem(item.id);
												toast({ title: "MCP server removed" });
											}}
											size="sm"
											type="button"
											variant="destructive"
										>
											Remove
										</Button>
									</div>
								</div>
							);
						})}
					</div>
				</ListResultCard>
			)}

			<Card className="overflow-hidden p-0">
				<CardContent className="py-4 text-muted-foreground text-sm">
					Paste a copied block under{" "}
					<code className="font-mono text-xs">mcp</code> in{" "}
					<code className="font-mono text-xs">opencode.json</code> and set{" "}
					<code className="font-mono text-xs">enabled</code> per server. Remote
					servers accept <code className="font-mono text-xs">headers</code>/
					<code className="font-mono text-xs">oauth</code> in the same block
					(see{" "}
					<a
						className="underline"
						href="https://opencode.ai/docs/mcp-servers/"
						rel="noreferrer"
						target="_blank"
					>
						opencode MCP docs
					</a>
					). MCP tools add context — enable only what you need.
				</CardContent>
			</Card>

			<InstallDialog
				existingNames={existingNames}
				onClose={() => setInstallOpen(false)}
				onSave={(item) => {
					addItem(item);
					setInstallOpen(false);
					toast({ description: item.name, title: "MCP server installed" });
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
