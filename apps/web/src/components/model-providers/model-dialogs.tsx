import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert.tsx";
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
import { Select } from "#/components/ui/select.tsx";
import type {
	CustomModel,
	DetectedModel,
} from "#/lib/model-providers/types.ts";
import { parseOptionalNumber, SupportSelect } from "./cells.tsx";
import { parseReasoningVariants, slugifyModelId } from "./detect.ts";

function ModelFormFields({
	audio,
	image,
	maxInput,
	maxOutput,
	name,
	onAudio,
	onId,
	onImage,
	onMaxInput,
	onMaxOutput,
	onName,
	onPdf,
	onReasoning,
	onVideo,
	pdf,
	reasoning,
	video,
	id,
	idPlaceholder = "my-model-pro (defaults to name)",
}: {
	audio: boolean | null;
	id: string;
	image: boolean | null;
	maxInput: string;
	maxOutput: string;
	name: string;
	onAudio: (v: boolean | null) => void;
	onId: (v: string) => void;
	onImage: (v: boolean | null) => void;
	onMaxInput: (v: string) => void;
	onMaxOutput: (v: string) => void;
	onName: (v: string) => void;
	onPdf: (v: boolean | null) => void;
	onReasoning: (v: string) => void;
	onVideo: (v: boolean | null) => void;
	pdf: boolean | null;
	reasoning: string;
	video: boolean | null;
	idPlaceholder?: string;
}) {
	return (
		<>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-1.5">
					<Label className="text-xs font-semibold" htmlFor="model-name">
						Model Name
					</Label>
					<Input
						id="model-name"
						onChange={(e) => onName(e.target.value)}
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
						onChange={(e) => onId(e.target.value)}
						placeholder={idPlaceholder}
						value={id}
					/>
				</div>
				<div className="space-y-1.5">
					<Label className="text-xs font-semibold" htmlFor="model-max-input">
						Max. Input Tokens
					</Label>
					<Input
						id="model-max-input"
						inputMode="numeric"
						onChange={(e) => onMaxInput(e.target.value)}
						placeholder="128000"
						value={maxInput}
					/>
				</div>
				<div className="space-y-1.5">
					<Label className="text-xs font-semibold" htmlFor="model-max-output">
						Max. Output Tokens
					</Label>
					<Input
						id="model-max-output"
						inputMode="numeric"
						onChange={(e) => onMaxOutput(e.target.value)}
						placeholder="8192"
						value={maxOutput}
					/>
				</div>
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-1.5">
					<Label className="text-xs font-semibold">Image Support?</Label>
					<SupportSelect onChange={onImage} value={image} />
				</div>
				<div className="space-y-1.5">
					<Label className="text-xs font-semibold">Video Support?</Label>
					<SupportSelect onChange={onVideo} value={video} />
				</div>
				<div className="space-y-1.5">
					<Label className="text-xs font-semibold">Audio Support?</Label>
					<SupportSelect onChange={onAudio} value={audio} />
				</div>
				<div className="space-y-1.5">
					<Label className="text-xs font-semibold">PDF Support?</Label>
					<SupportSelect onChange={onPdf} value={pdf} />
				</div>
			</div>
			<div className="space-y-1.5">
				<Label className="text-xs font-semibold" htmlFor="model-reasoning">
					Reasoning Variants
				</Label>
				<Input
					id="model-reasoning"
					onChange={(e) => onReasoning(e.target.value)}
					placeholder="low, medium, high (comma-separated)"
					value={reasoning}
				/>
			</div>
		</>
	);
}

export function AddModelDialog({
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

	function reset(): void {
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

	const modelId = id.trim() !== "" ? id.trim() : slugifyModelId(name);

	function handleSave(): void {
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
			reasoningVariants: parseReasoningVariants(reasoning),
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
				<div className="dialog-body space-y-4 overflow-y-auto px-4 py-4">
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
					<ModelFormFields
						audio={audio}
						id={id}
						image={image}
						maxInput={maxInput}
						maxOutput={maxOutput}
						name={name}
						onAudio={setAudio}
						onId={setId}
						onImage={setImage}
						onMaxInput={setMaxInput}
						onMaxOutput={setMaxOutput}
						onName={setName}
						onPdf={setPdf}
						onReasoning={setReasoning}
						onVideo={setVideo}
						pdf={pdf}
						reasoning={reasoning}
						video={video}
					/>
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

export function EditModelDialog({
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

	function handleSave(): void {
		onSave({
			audio,
			id: id.trim(),
			image,
			maxInputTokens: parseOptionalNumber(maxInput),
			maxOutputTokens: parseOptionalNumber(maxOutput),
			name: name.trim(),
			pdf,
			provider,
			reasoningVariants: parseReasoningVariants(reasoning),
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
				<div className="dialog-body space-y-4 overflow-y-auto px-4 py-4">
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
					<ModelFormFields
						audio={audio}
						id={id}
						idPlaceholder="model-id"
						image={image}
						maxInput={maxInput}
						maxOutput={maxOutput}
						name={name}
						onAudio={setAudio}
						onId={setId}
						onImage={setImage}
						onMaxInput={setMaxInput}
						onMaxOutput={setMaxOutput}
						onName={setName}
						onPdf={setPdf}
						onReasoning={setReasoning}
						onVideo={setVideo}
						pdf={pdf}
						reasoning={reasoning}
						video={video}
					/>
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
