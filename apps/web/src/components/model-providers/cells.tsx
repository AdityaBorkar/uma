import {
	ActionsMenu,
	ActionsMenuItem,
} from "#/components/data/ActionsMenu.tsx";
import { Audio, Image, Pdf, Video } from "#/components/icons.tsx";
import { Badge } from "#/components/ui/badge.tsx";
import { Select } from "#/components/ui/select.tsx";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table.tsx";
import type { DetectedModel } from "#/lib/model-providers/types.ts";
import { copyText } from "#/stores/clipboard.ts";

export function parseOptionalNumber(raw: string): number | null {
	const trimmed = raw.trim();
	if (trimmed === "") return null;
	const n = Number(trimmed);
	return Number.isFinite(n) && n >= 0 ? n : null;
}

export function InputModalitiesCell({ model }: { model: DetectedModel }) {
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
				className="flex size-6 items-center justify-center rounded border bg-muted/50 font-semibold text-micro"
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

export function TokensCell({ value }: { value: number | null | undefined }) {
	if (value === null || value === undefined)
		return <span className="text-muted-foreground">—</span>;
	return (
		<span className="font-mono text-xs whitespace-nowrap tabular-nums">
			{value.toLocaleString()}
		</span>
	);
}

export function ReasoningCell({ variants }: { variants: string[] }) {
	if (variants.length === 0)
		return <span className="text-muted-foreground">—</span>;
	const [first, ...rest] = variants;
	return (
		<span
			className="inline-flex max-w-40 items-center gap-1 overflow-hidden whitespace-nowrap"
			title={variants.join(", ")}
		>
			<Badge
				className="max-w-27.5 truncate font-mono text-micro"
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

export interface ModelRow {
	edit?: () => void;
	key: string;
	model: DetectedModel;
	provider: string;
	remove?: () => void;
}

export function RowActions({
	modelId,
	onEdit,
	remove,
}: {
	modelId: string;
	onEdit: (() => void) | undefined;
	remove: (() => void) | undefined;
}) {
	return (
		<ActionsMenu label={`More actions for ${modelId}`}>
			<ActionsMenuItem
				onClick={() => {
					copyText(modelId, "Model ID copied");
				}}
			>
				Copy model ID
			</ActionsMenuItem>
			{onEdit ? (
				<ActionsMenuItem onClick={onEdit}>Edit model</ActionsMenuItem>
			) : null}
			{remove ? (
				<ActionsMenuItem danger={true} onClick={remove}>
					Remove model
				</ActionsMenuItem>
			) : null}
		</ActionsMenu>
	);
}

export function ProviderActions({
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
		<ActionsMenu label={`More actions for ${name}`}>
			<ActionsMenuItem
				onClick={() => {
					copyText(baseUrl, "Base URL copied");
				}}
			>
				Copy base URL
			</ActionsMenuItem>
			<ActionsMenuItem onClick={onEdit}>Edit provider</ActionsMenuItem>
			<ActionsMenuItem danger={true} onClick={remove}>
				Remove provider
			</ActionsMenuItem>
		</ActionsMenu>
	);
}

export function AccountActions({
	label,
	onEdit,
	remove,
}: {
	label: string;
	onEdit: () => void;
	remove: () => void;
}) {
	return (
		<ActionsMenu label={`More actions for ${label}`}>
			<ActionsMenuItem onClick={onEdit}>Edit account</ActionsMenuItem>
			<ActionsMenuItem danger={true} onClick={remove}>
				Remove account
			</ActionsMenuItem>
		</ActionsMenu>
	);
}

export function ModelTable({ rows }: { rows: ModelRow[] }) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className="max-w-45">Model</TableHead>
					<TableHead className="max-w-50">Model ID</TableHead>
					<TableHead>Input</TableHead>
					<TableHead className="w-24 text-right">Max output</TableHead>
					<TableHead className="w-24 text-right">Max input</TableHead>
					<TableHead className="max-w-40">Reasoning</TableHead>
					<TableHead className="max-w-30">Provider</TableHead>
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
						<TableCell className="max-w-45">
							<span
								className="block truncate font-medium"
								title={row.model.name || row.model.id}
							>
								{row.model.name || row.model.id}
							</span>
						</TableCell>
						<TableCell className="max-w-50">
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
						<TableCell className="max-w-40 whitespace-nowrap">
							<ReasoningCell variants={row.model.reasoningVariants} />
						</TableCell>
						<TableCell className="max-w-30">
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

export function SupportSelect({
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
