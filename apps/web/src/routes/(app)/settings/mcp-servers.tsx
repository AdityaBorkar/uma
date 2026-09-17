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
import { Card, CardContent } from "#/components/ui/card.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Select } from "#/components/ui/select.tsx";
import { useToast } from "#/components/ui/toaster.tsx";
import { apiUrl } from "#/env.ts";
import { VERSION_PIN_ERROR } from "#/lib/forms.ts";
import { useFilteredByQuery } from "#/lib/lists.ts";
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
		apiUrl(`/api/mcp/versions?package=${encodeURIComponent(pkg)}`),
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
		version !== "" && !isSafeMcpVersion(version) ? VERSION_PIN_ERROR : null;

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
		<FormDialog
			description={
				<>
					Local servers run via{" "}
					<code className="font-mono">npx -y pkg[@version]</code>; remote
					servers connect over HTTPS. Saved to this browser in v1 — paste the
					JSON into <code className="font-mono">opencode.json</code>.
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
			title="Install MCP server"
		>
			<div className="grid gap-4 sm:grid-cols-2">
				<FormField id="mcp-kind" label="Type">
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
				</FormField>
				<FormField
					error={nameError}
					id="mcp-name"
					label="Name (opencode mcp key)"
				>
					<Input
						id="mcp-name"
						onChange={(e) => setNameInput(e.target.value)}
						placeholder="mcp_everything"
						value={nameInput}
					/>
					{duplicate ? (
						<p className="text-destructive text-xs">
							This name is already installed.
						</p>
					) : null}
				</FormField>
			</div>

			{kind === "local" ? (
				<div className="grid gap-4 sm:grid-cols-2">
					<FormField error={packageError} id="mcp-package" label="npm package">
						<Input
							id="mcp-package"
							onChange={(e) => handleNameFromPackage(e.target.value)}
							placeholder="@modelcontextprotocol/server-everything"
							value={packageInput}
						/>
					</FormField>
					<FormField id="mcp-runtime" label="Launcher">
						<Select
							id="mcp-runtime"
							onChange={(e) =>
								setRuntime(
									isValidMcpRuntime(e.target.value) ? e.target.value : "npx",
								)
							}
							value={runtime}
						>
							<option value="npx">npx</option>
							<option value="bunx">bunx</option>
							<option value="uvx">uvx</option>
						</Select>
					</FormField>
				</div>
			) : (
				<FormField error={urlError} id="mcp-url" label="Server URL">
					<Input
						id="mcp-url"
						onChange={(e) => setUrlInput(e.target.value)}
						placeholder="https://mcp.context7.com/mcp"
						value={urlInput}
					/>
				</FormField>
			)}

			<FormField
				error={versionError}
				hint={
					kind === "local"
						? "Pinned as pkg@version in the command array. Upgrade resolves latest from npm."
						: "Remote servers have no registry — the pin is metadata. Upgrade edits it by hand."
				}
				id="mcp-version"
				label="Version pin (optional)"
			>
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
			</FormField>

			<label className="flex items-center gap-2 text-sm">
				<input
					checked={enabled}
					onChange={(e) => setEnabled(e.target.checked)}
					type="checkbox"
				/>
				Enabled on startup
			</label>

			<FormField id="mcp-preview" label="opencode.json">
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
			</FormField>

			<DialogFooter
				disabled={!valid}
				onCancel={onClose}
				onSave={handleSave}
				saveLabel="Install server"
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
		version && !isSafeMcpVersion(version) ? VERSION_PIN_ERROR : null;

	return (
		<FormDialog
			description={
				<>
					{item.kind === "local"
						? "Empty clears the pin and tracks latest (pkg without @version)."
						: "Remote pins are metadata only — empty tracks latest."}
					{item.latestVersion ? ` Latest known: ${item.latestVersion}.` : ""}
				</>
			}
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
					placeholder={
						item.kind === "local" ? "1.2.3 or ^1.0.0" : "2024-01-01 or v2"
					}
					value={versionInput}
				/>
			</FormField>
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
			<DialogFooter
				disabled={Boolean(error)}
				onCancel={onClose}
				onSave={() => onSave(version === "" ? null : version)}
				saveLabel="Save pin"
			/>
		</FormDialog>
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

	const kindItems = useMemo(
		() =>
			kindFilter === "all"
				? store.items
				: store.items.filter((i) => i.kind === kindFilter),
		[store.items, kindFilter],
	);
	const items = useFilteredByQuery(kindItems, q, (i) => [
		i.name,
		i.package,
		i.url,
	]);
	const existingNames = useMemo(
		() => store.items.map((i) => i.name),
		[store.items],
	);

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

			<FilterBar
				filters={[
					{
						id: "mcp-kind-filter",
						label: "Type",
						onChange: (value) =>
							setKindFilter(
								value === "remote" || value === "local" ? value : "all",
							),
						options: [
							{ label: "All", value: "all" },
							{ label: "Local", value: "local" },
							{ label: "Remote", value: "remote" },
						],
						value: kindFilter,
					},
				]}
				search={{
					id: "mcp-search",
					onChange: setQInput,
					placeholder: "Filter by name, package, or URL…",
					value: qInput,
				}}
			/>

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
								<ListRow key={item.id}>
									<ListRowMain>
										<ListRowTitle mono={true}>{item.name}</ListRowTitle>
										<ListRowSubtitle>
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
										</ListRowSubtitle>
										<code className="mt-1 block max-h-24 overflow-auto rounded-md border bg-muted/50 px-2 py-1 font-mono text-micro whitespace-pre">
											{buildMcpJson(item)}
										</code>
									</ListRowMain>
									<ListRowActions>
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
												copyText(buildMcpJson(item), "Config JSON copied")
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
									</ListRowActions>
								</ListRow>
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
