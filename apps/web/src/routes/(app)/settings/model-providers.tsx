import { Menu } from "@base-ui/react/menu";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import {
	Audio,
	Image,
	KeyRound,
	MoreHorizontal,
	Pdf,
	Plus,
	Video,
} from "#/components/icons.tsx";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert.tsx";
import { Badge } from "#/components/ui/badge.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Card } from "#/components/ui/card.tsx";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table.tsx";
import { useToast } from "#/components/ui/toaster.tsx";
import type {
	CustomModel,
	CustomProvider,
	DetectedModel,
	ProviderAccount,
} from "#/lib/model-providers/types.ts";
import { maskKey } from "#/lib/model-providers/types.ts";
import { hydrateProviderStore, useProviderStore } from "#/stores/registries.ts";

export const Route = createFileRoute("/(app)/settings/model-providers")({
	component: ModelProvidersPage,
	head: () => ({
		meta: [
			{ title: "Model Providers — Planner" },
			{
				content:
					"Manage model providers, API keys and models stored in this browser.",
				name: "description",
			},
		],
	}),
});

function InputModalitiesCell({ model }: { model: DetectedModel }) {
	const modalities = [
		{
			icon: <Image className="size-3.5" />,
			label: "Image",
			value: model.image,
		},
		{
			icon: <Video className="size-3.5" />,
			label: "Video",
			value: model.video,
		},
		{
			icon: <Audio className="size-3.5" />,
			label: "Audio",
			value: model.audio,
		},
		{ icon: <Pdf className="size-3.5" />, label: "PDF", value: model.pdf },
	];
	return (
		<span className="flex items-center gap-1 whitespace-nowrap">
			<span
				className="flex size-6 items-center justify-center rounded border bg-muted/50 font-semibold text-[11px]"
				title="Text input supported"
			>
				T
			</span>
			{modalities.map(({ icon, label, value }) =>
				value === null || value === undefined ? null : (
					<span
						className={`flex size-6 items-center justify-center rounded border bg-muted/50 ${value ? "text-foreground" : "text-muted-foreground opacity-40"}`}
						key={label}
						title={`${label} input ${value ? "supported" : "not supported"}`}
					>
						{icon}
					</span>
				),
			)}
		</span>
	);
}

function TokensCell({ value }: { value: number | null | undefined }) {
	if (value === null || value === undefined)
		return <span className="text-muted-foreground">—</span>;
	return (
		<span className="font-mono text-xs whitespace-nowrap tabular-nums">
			{value.toLocaleString()}
		</span>
	);
}

function ReasoningCell({ variants }: { variants: string[] }) {
	if (variants.length === 0)
		return <span className="text-muted-foreground">—</span>;
	const [first, ...rest] = variants;
	return (
		<span
			className="inline-flex max-w-[160px] items-center gap-1 overflow-hidden whitespace-nowrap"
			title={variants.join(", ")}
		>
			<Badge
				className="max-w-[110px] truncate font-mono text-[11px]"
				variant="outline"
			>
				{first}
			</Badge>
			{rest.length > 0 ? (
				<span className="shrink-0 text-muted-foreground text-xs">
					+{rest.length}
				</span>
			) : null}
		</span>
	);
}

interface ModelRow {
	/** Open the edit dialog for this row. */
	edit?: () => void;
	key: string;
	model: DetectedModel;
	provider: string;
	/** Manually added models can be removed via More actions. */
	remove?: () => void;
}

const menuItemClass =
	"flex w-full cursor-default items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-sm outline-none select-none data-highlighted:bg-muted data-highlighted:text-foreground data-disabled:opacity-50";

function RowActions({
	modelId,
	onEdit,
	remove,
}: {
	modelId: string;
	onEdit: (() => void) | undefined;
	remove: (() => void) | undefined;
}) {
	return (
		<Menu.Root>
			<Menu.Trigger
				aria-label={`More actions for ${modelId}`}
				className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 data-[popup-open]:bg-muted data-[popup-open]:text-foreground"
			>
				<MoreHorizontal className="size-4" />
			</Menu.Trigger>
			<Menu.Portal>
				<Menu.Positioner
					align="end"
					className="z-50 outline-none select-none"
					side="bottom"
					sideOffset={4}
				>
					<Menu.Popup className="min-w-40 rounded-md border border-popover bg-popover p-1 text-popover-foreground outline-none">
						<Menu.Item
							className={menuItemClass}
							onClick={() => {
								void navigator.clipboard?.writeText(modelId)?.catch(() => {});
							}}
						>
							Copy model ID
						</Menu.Item>
						{onEdit ? (
							<Menu.Item className={menuItemClass} onClick={onEdit}>
								Edit model
							</Menu.Item>
						) : null}
						{remove ? (
							<Menu.Item
								className={`${menuItemClass} text-destructive data-highlighted:text-destructive`}
								onClick={remove}
							>
								Remove model
							</Menu.Item>
						) : null}
					</Menu.Popup>
				</Menu.Positioner>
			</Menu.Portal>
		</Menu.Root>
	);
}

function ProviderActions({
	baseUrl,
	name,
	onEdit,
	remove,
}: {
	baseUrl: string;
	name: string;
	onEdit: () => void;
	remove: () => void;
}) {
	return (
		<Menu.Root>
			<Menu.Trigger
				aria-label={`More actions for ${name}`}
				className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 data-[popup-open]:bg-muted data-[popup-open]:text-foreground"
			>
				<MoreHorizontal className="size-4" />
			</Menu.Trigger>
			<Menu.Portal>
				<Menu.Positioner
					align="end"
					className="z-50 outline-none select-none"
					side="bottom"
					sideOffset={4}
				>
					<Menu.Popup className="min-w-40 rounded-md border border-popover bg-popover p-1 text-popover-foreground outline-none">
						<Menu.Item
							className={menuItemClass}
							onClick={() => {
								void navigator.clipboard?.writeText(baseUrl)?.catch(() => {});
							}}
						>
							Copy base URL
						</Menu.Item>
						<Menu.Item className={menuItemClass} onClick={onEdit}>
							Edit provider
						</Menu.Item>
						<Menu.Item
							className={`${menuItemClass} text-destructive data-highlighted:text-destructive`}
							onClick={remove}
						>
							Remove provider
						</Menu.Item>
					</Menu.Popup>
				</Menu.Positioner>
			</Menu.Portal>
		</Menu.Root>
	);
}

function AccountActions({
	label,
	onEdit,
	remove,
}: {
	label: string;
	onEdit: () => void;
	remove: () => void;
}) {
	return (
		<Menu.Root>
			<Menu.Trigger
				aria-label={`More actions for ${label}`}
				className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 data-[popup-open]:bg-muted data-[popup-open]:text-foreground"
			>
				<MoreHorizontal className="size-4" />
			</Menu.Trigger>
			<Menu.Portal>
				<Menu.Positioner
					align="end"
					className="z-50 outline-none select-none"
					side="bottom"
					sideOffset={4}
				>
					<Menu.Popup className="min-w-40 rounded-md border border-popover bg-popover p-1 text-popover-foreground outline-none">
						<Menu.Item className={menuItemClass} onClick={onEdit}>
							Edit account
						</Menu.Item>
						<Menu.Item
							className={`${menuItemClass} text-destructive data-highlighted:text-destructive`}
							onClick={remove}
						>
							Remove account
						</Menu.Item>
					</Menu.Popup>
				</Menu.Positioner>
			</Menu.Portal>
		</Menu.Root>
	);
}

function ModelTable({ rows }: { rows: ModelRow[] }) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className="max-w-[180px]">Model</TableHead>
					<TableHead className="max-w-[200px]">Model ID</TableHead>
					<TableHead>Input</TableHead>
					<TableHead className="w-24 text-right">Max output</TableHead>
					<TableHead className="w-24 text-right">Max input</TableHead>
					<TableHead className="max-w-[160px]">Reasoning</TableHead>
					<TableHead className="max-w-[120px]">Provider</TableHead>
					<TableHead className="w-12 text-right">
						<span className="sr-only">More actions</span>
					</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.length === 0 ? (
					<TableRow>
						<TableCell
							className="text-center text-muted-foreground"
							colSpan={8}
						>
							No models
						</TableCell>
					</TableRow>
				) : null}
				{rows.map((row) => (
					<TableRow className="h-12" key={row.key}>
						<TableCell className="max-w-[180px]">
							<span
								className="block truncate font-medium"
								title={row.model.name || row.model.id}
							>
								{row.model.name || row.model.id}
							</span>
						</TableCell>
						<TableCell className="max-w-[200px]">
							<span
								className="block truncate font-mono text-xs"
								title={row.model.id}
							>
								{row.model.id}
							</span>
						</TableCell>
						<TableCell className="whitespace-nowrap">
							<InputModalitiesCell model={row.model} />
						</TableCell>
						<TableCell className="w-24 text-right whitespace-nowrap">
							<TokensCell value={row.model.maxOutputTokens} />
						</TableCell>
						<TableCell className="w-24 text-right whitespace-nowrap">
							<TokensCell value={row.model.maxInputTokens} />
						</TableCell>
						<TableCell className="max-w-[160px] whitespace-nowrap">
							<ReasoningCell variants={row.model.reasoningVariants} />
						</TableCell>
						<TableCell className="max-w-[120px]">
							<span
								className="block truncate text-muted-foreground text-xs"
								title={row.provider}
							>
								{row.provider}
							</span>
						</TableCell>
						<TableCell className="w-12 text-right whitespace-nowrap">
							<RowActions
								modelId={row.model.id}
								onEdit={row.edit}
								remove={row.remove}
							/>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

type DetectStatus = "idle" | "detecting" | "detected" | "error";

function AddProviderDialog({
	existingNames,
	onOpenChange,
	onSave,
	open,
}: {
	existingNames: string[];
	onOpenChange: (open: boolean) => void;
	onSave: (provider: CustomProvider) => void;
	open: boolean;
}) {
	const [name, setName] = useState("");
	const [baseUrl, setBaseUrl] = useState("");
	const [status, setStatus] = useState<DetectStatus>("idle");
	const [error, setError] = useState("");
	const [models, setModels] = useState<DetectedModel[]>([]);
	const [modelsUrl, setModelsUrl] = useState("");

	function reset() {
		setName("");
		setBaseUrl("");
		setStatus("idle");
		setError("");
		setModels([]);
		setModelsUrl("");
	}

	const duplicate =
		name.trim() !== "" &&
		existingNames.some((n) => n.toLowerCase() === name.trim().toLowerCase());

	async function handleDetect() {
		setStatus("detecting");
		setError("");
		try {
			const res = await fetch(
				`/api/model-providers/detect?baseUrl=${encodeURIComponent(baseUrl.trim())}`,
			);
			const data = (await res.json()) as {
				count?: number;
				error?: string;
				models?: DetectedModel[];
				modelsUrl?: string;
			};
			if (!res.ok) {
				throw new Error(data.error ?? "Detection failed");
			}
			setModels(Array.isArray(data.models) ? data.models : []);
			setModelsUrl(data.modelsUrl ?? "");
			setStatus("detected");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Detection failed");
			setStatus("error");
		}
	}

	function handleSave() {
		onSave({
			baseUrl: baseUrl.trim().replace(/\/+$/, ""),
			createdAt: new Date().toISOString(),
			id: crypto.randomUUID(),
			models,
			name: name.trim(),
		});
		reset();
		onOpenChange(false);
	}

	return (
		<Dialog
			onOpenChange={(next) => {
				if (!next) reset();
				onOpenChange(next);
			}}
			open={open}
		>
			<DialogContent
				className="max-w-3xl p-0"
				onClose={() => onOpenChange(false)}
			>
				<DialogHeader className="px-4 py-3">
					<DialogTitle>Add provider</DialogTitle>
					<DialogDescription>
						Name a provider, point at its base URL, auto-detect its models via
						GET $BASE_URL/models, then save.
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold" htmlFor="provider-name">
								Provider Name
							</Label>
							<Input
								id="provider-name"
								onChange={(e) => setName(e.target.value)}
								placeholder="My Gateway"
								value={name}
							/>
							{duplicate ? (
								<p className="text-destructive text-xs">
									A provider with this name already exists.
								</p>
							) : null}
						</div>
						<div className="space-y-1.5">
							<Label
								className="text-xs font-semibold"
								htmlFor="provider-base-url"
							>
								Provider Base URL
							</Label>
							<Input
								id="provider-base-url"
								inputMode="url"
								onChange={(e) => {
									setBaseUrl(e.target.value);
									setStatus("idle");
								}}
								placeholder="https://api.example.com/v1"
								value={baseUrl}
							/>
							<p className="text-muted-foreground text-xs">
								Models are fetched from GET $BASE_URL/models.
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<Button
							disabled={baseUrl.trim() === "" || status === "detecting"}
							onClick={() => void handleDetect()}
							size="sm"
							type="button"
							variant="outline"
						>
							{status === "detecting" ? "Detecting…" : "Detect models"}
						</Button>
						{status === "detected" ? (
							<span className="text-muted-foreground text-xs">
								{models.length} model{models.length === 1 ? "" : "s"} found
								{modelsUrl ? ` at ${modelsUrl}` : ""}
							</span>
						) : null}
					</div>

					{status === "error" ? (
						<Alert variant="destructive">
							<AlertTitle>Detection failed</AlertTitle>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					) : null}

					{status === "detected" && models.length === 0 ? (
						<Alert>
							<AlertTitle>No models found</AlertTitle>
							<AlertDescription>
								The endpoint responded but listed no models. You can still save
								the provider and add models manually.
							</AlertDescription>
						</Alert>
					) : null}

					{status === "detected" && models.length > 0 ? (
						<Card className="overflow-hidden p-0">
							<ModelTable
								rows={models.map((m) => ({
									key: m.id,
									model: m,
									provider: name.trim() || "Preview",
								}))}
							/>
						</Card>
					) : null}

					<div className="flex items-center justify-end gap-2">
						<Button
							onClick={() => onOpenChange(false)}
							size="sm"
							type="button"
							variant="ghost"
						>
							Cancel
						</Button>
						<Button
							disabled={
								name.trim() === "" ||
								duplicate ||
								baseUrl.trim() === "" ||
								status !== "detected"
							}
							onClick={handleSave}
							size="sm"
							type="button"
							variant="primary"
						>
							Save provider
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function parseOptionalNumber(raw: string): number | null {
	const trimmed = raw.trim();
	if (trimmed === "") return null;
	const n = Number(trimmed);
	return Number.isFinite(n) && n >= 0 ? n : null;
}

function SupportSelect({
	onChange,
	value,
}: {
	onChange: (value: boolean | null) => void;
	value: boolean | null;
}) {
	return (
		<Select
			onChange={(e) => {
				const v = e.target.value;
				onChange(v === "" ? null : v === "yes");
			}}
			value={value === null ? "" : value ? "yes" : "no"}
		>
			<option value="">Unknown</option>
			<option value="yes">Yes</option>
			<option value="no">No</option>
		</Select>
	);
}

function AddModelDialog({
	onOpenChange,
	onSave,
	open,
	providerNames,
}: {
	onOpenChange: (open: boolean) => void;
	onSave: (model: CustomModel) => void;
	open: boolean;
	providerNames: string[];
}) {
	const [provider, setProvider] = useState(providerNames[0] ?? "");
	const [name, setName] = useState("");
	const [id, setId] = useState("");
	const [maxInput, setMaxInput] = useState("");
	const [maxOutput, setMaxOutput] = useState("");
	const [image, setImage] = useState<boolean | null>(null);
	const [video, setVideo] = useState<boolean | null>(null);
	const [audio, setAudio] = useState<boolean | null>(null);
	const [pdf, setPdf] = useState<boolean | null>(null);
	const [reasoning, setReasoning] = useState("");

	useEffect(() => {
		if (open && providerNames.length > 0 && !providerNames.includes(provider)) {
			setProvider(providerNames[0] ?? "");
		}
	}, [open, providerNames, provider]);

	function reset() {
		setProvider(providerNames[0] ?? "");
		setName("");
		setId("");
		setMaxInput("");
		setMaxOutput("");
		setImage(null);
		setVideo(null);
		setAudio(null);
		setPdf(null);
		setReasoning("");
	}

	const modelId =
		id.trim() !== ""
			? id.trim()
			: name
					.trim()
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/^-|-$/g, "");

	function handleSave() {
		const variants = reasoning
			.split(",")
			.map((v) => v.trim())
			.filter(Boolean);
		onSave({
			audio,
			customId: crypto.randomUUID(),
			id: modelId,
			image,
			maxInputTokens: parseOptionalNumber(maxInput),
			maxOutputTokens: parseOptionalNumber(maxOutput),
			name: name.trim(),
			pdf,
			provider,
			reasoningVariants: [...new Set(variants)],
			video,
		});
		reset();
		onOpenChange(false);
	}

	return (
		<Dialog
			onOpenChange={(next) => {
				if (!next) reset();
				onOpenChange(next);
			}}
			open={open}
		>
			<DialogContent className="p-0" onClose={() => onOpenChange(false)}>
				<DialogHeader className="px-4 py-3">
					<DialogTitle>Add model</DialogTitle>
					<DialogDescription>
						Manually register a model on one of your providers.
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-4">
					{providerNames.length === 0 ? (
						<Alert>
							<AlertTitle>No providers yet</AlertTitle>
							<AlertDescription>
								Add a provider first, then register models on it.
							</AlertDescription>
						</Alert>
					) : null}
					<div className="space-y-1.5">
						<Label className="text-xs font-semibold" htmlFor="model-provider">
							Provider
						</Label>
						<Select
							id="model-provider"
							onChange={(e) => setProvider(e.target.value)}
							value={provider}
						>
							{providerNames.map((n) => (
								<option key={n} value={n}>
									{n}
								</option>
							))}
						</Select>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold" htmlFor="model-name">
								Model Name
							</Label>
							<Input
								id="model-name"
								onChange={(e) => setName(e.target.value)}
								placeholder="My Model Pro"
								value={name}
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold" htmlFor="model-id">
								Model ID
							</Label>
							<Input
								id="model-id"
								onChange={(e) => setId(e.target.value)}
								placeholder="my-model-pro (defaults to name)"
								value={id}
							/>
						</div>
						<div className="space-y-1.5">
							<Label
								className="text-xs font-semibold"
								htmlFor="model-max-input"
							>
								Max. Input Tokens
							</Label>
							<Input
								id="model-max-input"
								inputMode="numeric"
								onChange={(e) => setMaxInput(e.target.value)}
								placeholder="128000"
								value={maxInput}
							/>
						</div>
						<div className="space-y-1.5">
							<Label
								className="text-xs font-semibold"
								htmlFor="model-max-output"
							>
								Max. Output Tokens
							</Label>
							<Input
								id="model-max-output"
								inputMode="numeric"
								onChange={(e) => setMaxOutput(e.target.value)}
								placeholder="8192"
								value={maxOutput}
							/>
						</div>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold">Image Support?</Label>
							<SupportSelect onChange={setImage} value={image} />
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold">Video Support?</Label>
							<SupportSelect onChange={setVideo} value={video} />
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold">Audio Support?</Label>
							<SupportSelect onChange={setAudio} value={audio} />
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold">PDF Support?</Label>
							<SupportSelect onChange={setPdf} value={pdf} />
						</div>
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs font-semibold" htmlFor="model-reasoning">
							Reasoning Variants
						</Label>
						<Input
							id="model-reasoning"
							onChange={(e) => setReasoning(e.target.value)}
							placeholder="low, medium, high (comma-separated)"
							value={reasoning}
						/>
					</div>
					<div className="flex items-center justify-end gap-2">
						<Button
							onClick={() => onOpenChange(false)}
							size="sm"
							type="button"
							variant="ghost"
						>
							Cancel
						</Button>
						<Button
							disabled={provider === "" || name.trim() === "" || modelId === ""}
							onClick={handleSave}
							size="sm"
							type="button"
							variant="primary"
						>
							Save model
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function AddAccountDialog({
	initialProvider,
	onOpenChange,
	onSave,
	open,
	providerNames,
}: {
	initialProvider: string;
	onOpenChange: (open: boolean) => void;
	onSave: (account: ProviderAccount) => void;
	open: boolean;
	providerNames: string[];
}) {
	const [provider, setProvider] = useState(initialProvider);
	const [label, setLabel] = useState("");
	const [apiKey, setApiKey] = useState("");

	useEffect(() => {
		if (open) {
			setProvider(initialProvider);
		}
	}, [open, initialProvider]);

	function reset() {
		setProvider(initialProvider);
		setLabel("");
		setApiKey("");
	}

	function handleSave() {
		onSave({
			apiKey,
			createdAt: new Date().toISOString(),
			id: crypto.randomUUID(),
			label: label.trim(),
			provider,
		});
		reset();
		onOpenChange(false);
	}

	return (
		<Dialog
			onOpenChange={(next) => {
				if (!next) reset();
				onOpenChange(next);
			}}
			open={open}
		>
			<DialogContent className="p-0" onClose={() => onOpenChange(false)}>
				<DialogHeader className="px-4 py-3">
					<DialogTitle>Add account</DialogTitle>
					<DialogDescription>
						Attach an API key to a provider. Keys stay in this browser only —
						they are never sent to the server.
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-4">
					{providerNames.length === 0 ? (
						<Alert>
							<AlertTitle>No providers yet</AlertTitle>
							<AlertDescription>
								Add a provider first, then attach an API key to it.
							</AlertDescription>
						</Alert>
					) : null}
					<div className="space-y-1.5">
						<Label className="text-xs font-semibold" htmlFor="account-provider">
							Provider
						</Label>
						<Select
							id="account-provider"
							onChange={(e) => setProvider(e.target.value)}
							value={provider}
						>
							{providerNames.map((n) => (
								<option key={n} value={n}>
									{n}
								</option>
							))}
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs font-semibold" htmlFor="account-label">
							Account Label
						</Label>
						<Input
							id="account-label"
							onChange={(e) => setLabel(e.target.value)}
							placeholder="Personal key"
							value={label}
						/>
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs font-semibold" htmlFor="account-key">
							API Key
						</Label>
						<Input
							autoComplete="off"
							id="account-key"
							onChange={(e) => setApiKey(e.target.value)}
							placeholder="sk-…"
							type="password"
							value={apiKey}
						/>
					</div>
					<div className="flex items-center justify-end gap-2">
						<Button
							onClick={() => onOpenChange(false)}
							size="sm"
							type="button"
							variant="ghost"
						>
							Cancel
						</Button>
						<Button
							disabled={provider === "" || label.trim() === "" || apiKey === ""}
							onClick={handleSave}
							size="sm"
							type="button"
							variant="primary"
						>
							Save account
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function EditProviderDialog({
	existingNames,
	onOpenChange,
	onSave,
	open,
	provider,
}: {
	existingNames: string[];
	onOpenChange: (open: boolean) => void;
	onSave: (patch: {
		baseUrl: string;
		models: DetectedModel[];
		name: string;
	}) => void;
	open: boolean;
	provider: CustomProvider | null;
}) {
	const [name, setName] = useState("");
	const [baseUrl, setBaseUrl] = useState("");
	const [status, setStatus] = useState<DetectStatus>("idle");
	const [error, setError] = useState("");
	const [models, setModels] = useState<DetectedModel[]>([]);
	const [modelsUrl, setModelsUrl] = useState("");

	useEffect(() => {
		if (open && provider) {
			setName(provider.name);
			setBaseUrl(provider.baseUrl);
			setModels(provider.models);
			setModelsUrl("");
			setStatus("idle");
			setError("");
		}
	}, [open, provider]);

	const duplicate =
		provider &&
		name.trim() !== "" &&
		name.trim().toLowerCase() !== provider.name.toLowerCase() &&
		existingNames.some((n) => n === name.trim().toLowerCase());

	async function handleDetect() {
		setStatus("detecting");
		setError("");
		try {
			const res = await fetch(
				`/api/model-providers/detect?baseUrl=${encodeURIComponent(baseUrl.trim())}`,
			);
			const data = (await res.json()) as {
				count?: number;
				error?: string;
				models?: DetectedModel[];
				modelsUrl?: string;
			};
			if (!res.ok) {
				throw new Error(data.error ?? "Detection failed");
			}
			setModels(Array.isArray(data.models) ? data.models : []);
			setModelsUrl(data.modelsUrl ?? "");
			setStatus("detected");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Detection failed");
			setStatus("error");
		}
	}

	function handleSave() {
		if (!provider) return;
		onSave({
			baseUrl: baseUrl.trim().replace(/\/+$/, ""),
			models,
			name: name.trim(),
		});
		onOpenChange(false);
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent
				className="max-w-3xl p-0"
				onClose={() => onOpenChange(false)}
			>
				<DialogHeader className="px-4 py-3">
					<DialogTitle>Edit provider</DialogTitle>
					<DialogDescription>
						Rename the provider, update its base URL, optionally re-detect its
						models via GET $BASE_URL/models, then save.
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label
								className="text-xs font-semibold"
								htmlFor="edit-provider-name"
							>
								Provider Name
							</Label>
							<Input
								id="edit-provider-name"
								onChange={(e) => setName(e.target.value)}
								value={name}
							/>
							{duplicate ? (
								<p className="text-destructive text-xs">
									A provider with this name already exists.
								</p>
							) : null}
						</div>
						<div className="space-y-1.5">
							<Label
								className="text-xs font-semibold"
								htmlFor="edit-provider-base-url"
							>
								Provider Base URL
							</Label>
							<Input
								id="edit-provider-base-url"
								inputMode="url"
								onChange={(e) => {
									setBaseUrl(e.target.value);
									setStatus("idle");
								}}
								value={baseUrl}
							/>
							<p className="text-muted-foreground text-xs">
								Models are fetched from GET $BASE_URL/models.
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<Button
							disabled={baseUrl.trim() === "" || status === "detecting"}
							onClick={() => void handleDetect()}
							size="sm"
							type="button"
							variant="outline"
						>
							{status === "detecting" ? "Detecting…" : "Re-detect models"}
						</Button>
						{status === "detected" ? (
							<span className="text-muted-foreground text-xs">
								{models.length} model{models.length === 1 ? "" : "s"} found
								{modelsUrl ? ` at ${modelsUrl}` : ""}
							</span>
						) : (
							<span className="text-muted-foreground text-xs">
								{models.length} model{models.length === 1 ? "" : "s"} currently
								saved
							</span>
						)}
					</div>

					{status === "error" ? (
						<Alert variant="destructive">
							<AlertTitle>Detection failed</AlertTitle>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					) : null}

					{models.length > 0 ? (
						<Card className="overflow-hidden p-0">
							<ModelTable
								rows={models.map((m) => ({
									key: m.id,
									model: m,
									provider: name.trim() || "Preview",
								}))}
							/>
						</Card>
					) : null}

					<div className="flex items-center justify-end gap-2">
						<Button
							onClick={() => onOpenChange(false)}
							size="sm"
							type="button"
							variant="ghost"
						>
							Cancel
						</Button>
						<Button
							disabled={
								name.trim() === "" || !!duplicate || baseUrl.trim() === ""
							}
							onClick={handleSave}
							size="sm"
							type="button"
							variant="primary"
						>
							Save changes
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function EditAccountDialog({
	account,
	onOpenChange,
	onSave,
	open,
	providerNames,
}: {
	account: ProviderAccount | null;
	onOpenChange: (open: boolean) => void;
	onSave: (patch: Omit<ProviderAccount, "createdAt" | "id">) => void;
	open: boolean;
	providerNames: string[];
}) {
	const [provider, setProvider] = useState("");
	const [label, setLabel] = useState("");
	const [apiKey, setApiKey] = useState("");

	useEffect(() => {
		if (open && account) {
			setProvider(account.provider);
			setLabel(account.label);
			setApiKey(account.apiKey);
		}
	}, [open, account]);

	function handleSave() {
		onSave({ apiKey, label: label.trim(), provider });
		onOpenChange(false);
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="p-0" onClose={() => onOpenChange(false)}>
				<DialogHeader className="px-4 py-3">
					<DialogTitle>Edit account</DialogTitle>
					<DialogDescription>
						Update the label, provider, or API key. Keys stay in this browser
						only.
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-4">
					<div className="space-y-1.5">
						<Label
							className="text-xs font-semibold"
							htmlFor="edit-account-provider"
						>
							Provider
						</Label>
						<Select
							id="edit-account-provider"
							onChange={(e) => setProvider(e.target.value)}
							value={provider}
						>
							{providerNames.map((n) => (
								<option key={n} value={n}>
									{n}
								</option>
							))}
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label
							className="text-xs font-semibold"
							htmlFor="edit-account-label"
						>
							Account Label
						</Label>
						<Input
							id="edit-account-label"
							onChange={(e) => setLabel(e.target.value)}
							value={label}
						/>
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs font-semibold" htmlFor="edit-account-key">
							API Key
						</Label>
						<Input
							autoComplete="off"
							id="edit-account-key"
							onChange={(e) => setApiKey(e.target.value)}
							type="password"
							value={apiKey}
						/>
					</div>
					<div className="flex items-center justify-end gap-2">
						<Button
							onClick={() => onOpenChange(false)}
							size="sm"
							type="button"
							variant="ghost"
						>
							Cancel
						</Button>
						<Button
							disabled={provider === "" || label.trim() === "" || apiKey === ""}
							onClick={handleSave}
							size="sm"
							type="button"
							variant="primary"
						>
							Save changes
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function EditModelDialog({
	allowProviderChange,
	initial,
	onOpenChange,
	onSave,
	open,
	providerNames,
	title,
}: {
	allowProviderChange: boolean;
	initial: (DetectedModel & { provider: string }) | null;
	onOpenChange: (open: boolean) => void;
	onSave: (patch: DetectedModel & { provider: string }) => void;
	open: boolean;
	providerNames: string[];
	title: string;
}) {
	const [provider, setProvider] = useState("");
	const [name, setName] = useState("");
	const [id, setId] = useState("");
	const [maxInput, setMaxInput] = useState("");
	const [maxOutput, setMaxOutput] = useState("");
	const [image, setImage] = useState<boolean | null>(null);
	const [video, setVideo] = useState<boolean | null>(null);
	const [audio, setAudio] = useState<boolean | null>(null);
	const [pdf, setPdf] = useState<boolean | null>(null);
	const [reasoning, setReasoning] = useState("");

	useEffect(() => {
		if (open && initial) {
			setProvider(initial.provider);
			setName(initial.name);
			setId(initial.id);
			setMaxInput(initial.maxInputTokens?.toString() ?? "");
			setMaxOutput(initial.maxOutputTokens?.toString() ?? "");
			setImage(initial.image ?? null);
			setVideo(initial.video ?? null);
			setAudio(initial.audio ?? null);
			setPdf(initial.pdf ?? null);
			setReasoning(initial.reasoningVariants.join(", "));
		}
	}, [open, initial]);

	function handleSave() {
		const variants = reasoning
			.split(",")
			.map((v) => v.trim())
			.filter(Boolean);
		onSave({
			audio,
			id: id.trim(),
			image,
			maxInputTokens: parseOptionalNumber(maxInput),
			maxOutputTokens: parseOptionalNumber(maxOutput),
			name: name.trim(),
			pdf,
			provider,
			reasoningVariants: [...new Set(variants)],
			video,
		});
		onOpenChange(false);
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="p-0" onClose={() => onOpenChange(false)}>
				<DialogHeader className="px-4 py-3">
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>
						Update the model details, then save.
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-4">
					{allowProviderChange ? (
						<div className="space-y-1.5">
							<Label
								className="text-xs font-semibold"
								htmlFor="edit-model-provider"
							>
								Provider
							</Label>
							<Select
								id="edit-model-provider"
								onChange={(e) => setProvider(e.target.value)}
								value={provider}
							>
								{providerNames.map((n) => (
									<option key={n} value={n}>
										{n}
									</option>
								))}
							</Select>
						</div>
					) : null}
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label
								className="text-xs font-semibold"
								htmlFor="edit-model-name"
							>
								Model Name
							</Label>
							<Input
								id="edit-model-name"
								onChange={(e) => setName(e.target.value)}
								value={name}
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold" htmlFor="edit-model-id">
								Model ID
							</Label>
							<Input
								id="edit-model-id"
								onChange={(e) => setId(e.target.value)}
								value={id}
							/>
						</div>
						<div className="space-y-1.5">
							<Label
								className="text-xs font-semibold"
								htmlFor="edit-model-max-input"
							>
								Max. Input Tokens
							</Label>
							<Input
								id="edit-model-max-input"
								inputMode="numeric"
								onChange={(e) => setMaxInput(e.target.value)}
								value={maxInput}
							/>
						</div>
						<div className="space-y-1.5">
							<Label
								className="text-xs font-semibold"
								htmlFor="edit-model-max-output"
							>
								Max. Output Tokens
							</Label>
							<Input
								id="edit-model-max-output"
								inputMode="numeric"
								onChange={(e) => setMaxOutput(e.target.value)}
								value={maxOutput}
							/>
						</div>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold">Image Support?</Label>
							<SupportSelect onChange={setImage} value={image} />
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold">Video Support?</Label>
							<SupportSelect onChange={setVideo} value={video} />
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold">Audio Support?</Label>
							<SupportSelect onChange={setAudio} value={audio} />
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold">PDF Support?</Label>
							<SupportSelect onChange={setPdf} value={pdf} />
						</div>
					</div>
					<div className="space-y-1.5">
						<Label
							className="text-xs font-semibold"
							htmlFor="edit-model-reasoning"
						>
							Reasoning Variants
						</Label>
						<Input
							id="edit-model-reasoning"
							onChange={(e) => setReasoning(e.target.value)}
							placeholder="low, medium, high (comma-separated)"
							value={reasoning}
						/>
					</div>
					<div className="flex items-center justify-end gap-2">
						<Button
							onClick={() => onOpenChange(false)}
							size="sm"
							type="button"
							variant="ghost"
						>
							Cancel
						</Button>
						<Button
							disabled={
								name.trim() === "" ||
								id.trim() === "" ||
								(allowProviderChange && provider === "")
							}
							onClick={handleSave}
							size="sm"
							type="button"
							variant="primary"
						>
							Save changes
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function ModelProvidersPage() {
	const { toast } = useToast();
	const {
		addAccount,
		addModel,
		addProvider,
		removeAccount,
		removeModel,
		removeProvider,
		store,
		updateAccount,
		updateDetectedModel,
		updateManualModel,
		updateProvider,
	} = useProviderStore();
	const [providerOpen, setProviderOpen] = useState(false);
	const [modelOpen, setModelOpen] = useState(false);
	const [accountOpen, setAccountOpen] = useState(false);
	const [accountProvider, setAccountProvider] = useState<string>("");
	const [editingProvider, setEditingProvider] = useState<CustomProvider | null>(
		null,
	);
	const [editingAccount, setEditingAccount] = useState<ProviderAccount | null>(
		null,
	);
	const [editingManualModel, setEditingManualModel] =
		useState<CustomModel | null>(null);
	const [editingDetected, setEditingDetected] = useState<{
		providerId: string;
		model: DetectedModel;
		providerName: string;
	} | null>(null);

	useEffect(() => {
		hydrateProviderStore();
	}, []);

	const providerNames = useMemo(
		() => store.providers.map((p) => p.name),
		[store.providers],
	);

	const existingNames = useMemo(
		() => providerNames.map((n) => n.toLowerCase()),
		[providerNames],
	);

	const customRows: ModelRow[] = [
		...store.providers.flatMap((p) =>
			p.models.map((m) => ({
				edit: () =>
					setEditingDetected({
						model: m,
						providerId: p.id,
						providerName: p.name,
					}),
				key: `custom:${p.id}:${m.id}`,
				model: m,
				provider: p.name,
			})),
		),
		...store.models.map((m) => ({
			edit: () => setEditingManualModel(m),
			key: `manual:${m.customId}`,
			model: m,
			provider: m.provider,
			remove: () => {
				removeModel(m.customId);
				toast({ description: m.id, title: "Model removed" });
			},
		})),
	];

	function openAccountDialog(providerName: string) {
		setAccountProvider(providerName);
		setAccountOpen(true);
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center gap-2">
				<Button
					onClick={() => setProviderOpen(true)}
					size="sm"
					type="button"
					variant="primary"
				>
					<Plus className="size-4.25" />
					Add Provider
				</Button>
				<Button
					disabled={providerNames.length === 0}
					onClick={() => setModelOpen(true)}
					size="sm"
					title={
						providerNames.length === 0 ? "Add a provider first" : undefined
					}
					type="button"
					variant="outline"
				>
					<Plus className="size-4.25" />
					Add Model
				</Button>
				<Button
					disabled={providerNames.length === 0}
					onClick={() => openAccountDialog(providerNames[0] ?? "")}
					size="sm"
					title={
						providerNames.length === 0 ? "Add a provider first" : undefined
					}
					type="button"
					variant="outline"
				>
					<KeyRound className="size-4.25" />
					Add Account
				</Button>
			</div>

			<section className="space-y-3">
				<h2 className="font-semibold text-sm">Providers</h2>
				{store.providers.length === 0 ? (
					<Card className="py-10">
						<div className="px-4 text-center">
							<p className="font-semibold text-sm">No providers</p>
							<p className="mx-auto mt-1 max-w-md text-muted-foreground text-sm">
								Add a provider to detect its models, then attach API keys and
								register models.
							</p>
						</div>
					</Card>
				) : (
					<Card className="overflow-hidden p-0">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="max-w-[220px]">Provider</TableHead>
									<TableHead className="max-w-[260px]">Base URL</TableHead>
									<TableHead className="w-24">Models</TableHead>
									<TableHead className="w-12 text-right">
										<span className="sr-only">More actions</span>
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{store.providers.map((p) => (
									<TableRow className="h-12" key={p.id}>
										<TableCell className="max-w-[220px]">
											<span className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
												<span
													aria-hidden={true}
													className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted font-semibold text-xs"
												>
													{p.name.charAt(0).toUpperCase()}
												</span>
												<span className="truncate font-medium" title={p.name}>
													{p.name}
												</span>
											</span>
										</TableCell>
										<TableCell className="max-w-[260px]">
											<span
												className="block truncate font-mono text-muted-foreground text-xs"
												title={p.baseUrl}
											>
												{p.baseUrl}
											</span>
										</TableCell>
										<TableCell className="w-24 whitespace-nowrap">
											<Badge className="whitespace-nowrap" variant="outline">
												{p.models.length} model
												{p.models.length === 1 ? "" : "s"}
											</Badge>
										</TableCell>
										<TableCell className="w-12 text-right whitespace-nowrap">
											<ProviderActions
												baseUrl={p.baseUrl}
												name={p.name}
												onEdit={() => setEditingProvider(p)}
												remove={() => {
													removeProvider(p.id);
													toast({
														description: p.name,
														title: "Provider removed",
													});
												}}
											/>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</Card>
				)}
			</section>

			<section className="space-y-3">
				<h2 className="font-semibold text-sm">Accounts</h2>
				{store.accounts.length === 0 ? (
					<Card className="py-10">
						<div className="px-4 text-center">
							<p className="font-semibold text-sm">No accounts</p>
							<p className="mx-auto mt-1 max-w-md text-muted-foreground text-sm">
								Attach an API key to a provider to mark it configured.
							</p>
						</div>
					</Card>
				) : (
					<Card className="overflow-hidden p-0">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="max-w-[200px]">Account</TableHead>
									<TableHead className="max-w-[160px]">Provider</TableHead>
									<TableHead className="max-w-[160px]">API key</TableHead>
									<TableHead className="w-28">Status</TableHead>
									<TableHead className="w-12 text-right">
										<span className="sr-only">More actions</span>
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{store.accounts.map((a) => (
									<TableRow className="h-12" key={a.id}>
										<TableCell className="max-w-[200px]">
											<span
												className="block truncate font-medium"
												title={a.label}
											>
												{a.label}
											</span>
										</TableCell>
										<TableCell className="max-w-[160px]">
											<span
												className="block truncate text-muted-foreground text-xs"
												title={a.provider}
											>
												{a.provider}
											</span>
										</TableCell>
										<TableCell className="max-w-[160px]">
											<span className="block truncate font-mono text-muted-foreground text-xs">
												{maskKey(a.apiKey)}
											</span>
										</TableCell>
										<TableCell className="w-28 whitespace-nowrap">
											<Badge className="whitespace-nowrap" variant="success">
												API key set
											</Badge>
										</TableCell>
										<TableCell className="w-12 text-right whitespace-nowrap">
											<AccountActions
												label={a.label}
												onEdit={() => setEditingAccount(a)}
												remove={() => {
													removeAccount(a.id);
													toast({
														description: a.label,
														title: "Account removed",
													});
												}}
											/>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</Card>
				)}
			</section>

			<section className="space-y-3">
				<h2 className="font-semibold text-sm">Models</h2>
				<Card className="overflow-hidden p-0">
					<ModelTable rows={customRows} />
				</Card>
			</section>

			<AddProviderDialog
				existingNames={existingNames}
				onOpenChange={setProviderOpen}
				onSave={(provider) => {
					addProvider(provider);
					toast({
						description: `${provider.models.length} models detected`,
						title: `Provider ${provider.name} saved`,
					});
				}}
				open={providerOpen}
			/>
			<AddModelDialog
				onOpenChange={setModelOpen}
				onSave={(model) => {
					addModel(model);
					toast({
						description: `${model.id} on ${model.provider}`,
						title: "Model saved",
					});
				}}
				open={modelOpen}
				providerNames={providerNames}
			/>
			<AddAccountDialog
				initialProvider={accountProvider}
				onOpenChange={setAccountOpen}
				onSave={(account) => {
					addAccount(account);
					toast({
						description: `${account.label} on ${account.provider}`,
						title: "Account saved",
					});
				}}
				open={accountOpen}
				providerNames={providerNames}
			/>
			<EditProviderDialog
				existingNames={existingNames}
				onOpenChange={(next) => {
					if (!next) setEditingProvider(null);
				}}
				onSave={(patch) => {
					if (!editingProvider) return;
					updateProvider(editingProvider.id, patch);
					toast({
						description: patch.name,
						title: "Provider updated",
					});
					setEditingProvider(null);
				}}
				open={editingProvider !== null}
				provider={editingProvider}
			/>
			<EditAccountDialog
				account={editingAccount}
				onOpenChange={(next) => {
					if (!next) setEditingAccount(null);
				}}
				onSave={(patch) => {
					if (!editingAccount) return;
					updateAccount(editingAccount.id, patch);
					toast({
						description: patch.label,
						title: "Account updated",
					});
					setEditingAccount(null);
				}}
				open={editingAccount !== null}
				providerNames={providerNames}
			/>
			<EditModelDialog
				allowProviderChange={true}
				initial={editingManualModel}
				onOpenChange={(next) => {
					if (!next) setEditingManualModel(null);
				}}
				onSave={(patch) => {
					if (!editingManualModel) return;
					updateManualModel(editingManualModel.customId, patch);
					toast({
						description: patch.id,
						title: "Model updated",
					});
					setEditingManualModel(null);
				}}
				open={editingManualModel !== null}
				providerNames={providerNames}
				title="Edit model"
			/>
			<EditModelDialog
				allowProviderChange={false}
				initial={
					editingDetected
						? {
								...editingDetected.model,
								provider: editingDetected.providerName,
							}
						: null
				}
				onOpenChange={(next) => {
					if (!next) setEditingDetected(null);
				}}
				onSave={(patch) => {
					if (!editingDetected) return;
					updateDetectedModel(
						editingDetected.providerId,
						editingDetected.model.id,
						patch,
					);
					toast({
						description: patch.id,
						title: "Model updated",
					});
					setEditingDetected(null);
				}}
				open={editingDetected !== null}
				providerNames={providerNames}
				title="Edit detected model"
			/>
		</div>
	);
}
