import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert.tsx";
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
import type {
	CustomProvider,
	DetectedModel,
} from "#/lib/model-providers/types.ts";
import { ModelTable } from "./cells.tsx";
import { useModelDetect } from "./detect.ts";

export function AddProviderDialog({
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
	const { detect, error, models, modelsUrl, reset, status } = useModelDetect();

	function resetAll(): void {
		setName("");
		setBaseUrl("");
		reset();
	}

	const duplicate =
		name.trim() !== "" &&
		existingNames.some((n) => n.toLowerCase() === name.trim().toLowerCase());

	function handleSave(): void {
		onSave({
			baseUrl: baseUrl.trim().replace(/\/+$/, ""),
			createdAt: new Date().toISOString(),
			id: crypto.randomUUID(),
			models,
			name: name.trim(),
		});
		resetAll();
		onOpenChange(false);
	}

	return (
		<Dialog
			onOpenChange={(next) => {
				if (!next) resetAll();
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
				<div className="dialog-body space-y-4 overflow-y-auto px-4 py-4">
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
									reset(models);
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
							onClick={() => void detect(baseUrl)}
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

export function EditProviderDialog({
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
	const { detect, error, models, modelsUrl, reset, setModels, status } =
		useModelDetect();

	useEffect(() => {
		if (open && provider) {
			setName(provider.name);
			setBaseUrl(provider.baseUrl);
			reset(provider.models);
			setModels(provider.models);
		}
	}, [open, provider, reset, setModels]);

	const duplicate =
		provider &&
		name.trim() !== "" &&
		name.trim().toLowerCase() !== provider.name.toLowerCase() &&
		existingNames.some((n) => n === name.trim().toLowerCase());

	function handleSave(): void {
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
				<div className="dialog-body space-y-4 overflow-y-auto px-4 py-4">
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
									reset(models);
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
							onClick={() => void detect(baseUrl)}
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
