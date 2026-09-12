import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import {
	ListEmptyCard,
	ListErrorAlert,
	ListLoadingCard,
	ListResultCard,
	PageHeader,
} from "#/components/lists/shared.tsx";
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
import { Select } from "#/components/ui/select.tsx";
import { Textarea } from "#/components/ui/textarea.tsx";
import { useToast } from "#/components/ui/toaster.tsx";
import { rpc, rpcPathKey } from "#/lib/rpc.ts";

export const Route = createFileRoute("/(app)/settings/subagents")({
	component: SubagentsPage,
	head: () => ({
		meta: [
			{ title: "Subagents — Planner" },
			{
				content:
					"Custom subagents: specialized assistants with their own prompt, model, and permissions.",
				name: "description",
			},
		],
	}),
});

type PermissionKey = "edit" | "bash" | "webfetch" | "websearch" | "task";
type PermissionValue = "allow" | "ask" | "deny";

const PERMISSION_KEYS: PermissionKey[] = [
	"edit",
	"bash",
	"webfetch",
	"websearch",
	"task",
];

interface SubagentRow {
	color: string | null;
	description: string;
	disabled: boolean;
	hidden: boolean;
	id: string;
	model: string | null;
	name: string;
	permissions: Record<string, string>;
	prompt: string;
	steps: number | null;
	temperature: number | null;
	topP: number | null;
}

interface SubagentForm {
	color: string;
	description: string;
	disabled: boolean;
	hidden: boolean;
	model: string;
	name: string;
	permissions: Record<PermissionKey, PermissionValue | "">;
	prompt: string;
	steps: string;
	temperature: string;
	topP: string;
}

const EMPTY_FORM: SubagentForm = {
	color: "",
	description: "",
	disabled: false,
	hidden: false,
	model: "",
	name: "",
	permissions: { bash: "", edit: "", task: "", webfetch: "", websearch: "" },
	prompt: "",
	steps: "",
	temperature: "",
	topP: "",
};

const NAME_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
const COLOR_RE =
	/^(#[0-9a-fA-F]{6}|primary|secondary|accent|success|warning|error|info)$/;

function toForm(row: SubagentRow): SubagentForm {
	const permissions = { ...EMPTY_FORM.permissions };
	for (const key of PERMISSION_KEYS) {
		const v = row.permissions[key];
		if (v === "allow" || v === "ask" || v === "deny") permissions[key] = v;
	}
	return {
		color: row.color ?? "",
		description: row.description,
		disabled: row.disabled,
		hidden: row.hidden,
		model: row.model ?? "",
		name: row.name,
		permissions,
		prompt: row.prompt,
		steps: row.steps?.toString() ?? "",
		temperature: row.temperature?.toString() ?? "",
		topP: row.topP?.toString() ?? "",
	};
}

function validateForm(form: SubagentForm): Record<string, string> {
	const errors: Record<string, string> = {};
	if (
		!NAME_RE.test(form.name.trim().toLowerCase()) ||
		form.name.trim().length > 64
	) {
		errors.name = "Lowercase slug (letters, digits, dashes), max 64.";
	}
	if (form.description.trim().length < 1)
		errors.description = "Description is required.";
	else if (form.description.trim().length > 500)
		errors.description = "Max 500 characters.";
	if (form.prompt.length < 1) errors.prompt = "Prompt is required.";
	else if (form.prompt.length > 20_000) errors.prompt = "Max 20000 characters.";
	if (form.model.trim().length > 200) errors.model = "Max 200 characters.";
	if (form.temperature.trim() !== "") {
		const n = Number(form.temperature);
		if (!Number.isFinite(n) || n < 0 || n > 1) errors.temperature = "0 – 1.";
	}
	if (form.steps.trim() !== "") {
		const n = Number(form.steps);
		if (!Number.isInteger(n) || n < 1 || n > 500) errors.steps = "1 – 500.";
	}
	if (form.topP.trim() !== "") {
		const n = Number(form.topP);
		if (!Number.isFinite(n) || n < 0 || n > 1) errors.topP = "0 – 1.";
	}
	if (form.color.trim() !== "" && !COLOR_RE.test(form.color.trim())) {
		errors.color =
			"Hex (#RRGGBB) or primary/secondary/accent/success/warning/error/info.";
	}
	return errors;
}

function permissionsPayload(form: SubagentForm): Record<string, string> {
	const out: Record<string, string> = {};
	for (const key of PERMISSION_KEYS) {
		if (form.permissions[key] !== "") out[key] = form.permissions[key];
	}
	return out;
}

function toMarkdown(row: SubagentRow): string {
	const lines = ["---", `description: ${row.description}`, "mode: subagent"];
	if (row.model) lines.push(`model: ${row.model}`);
	if (row.temperature !== null) lines.push(`temperature: ${row.temperature}`);
	if (row.steps !== null) lines.push(`steps: ${row.steps}`);
	if (row.topP !== null) lines.push(`top_p: ${row.topP}`);
	if (row.color) lines.push(`color: ${row.color}`);
	if (row.hidden) lines.push("hidden: true");
	if (row.disabled) lines.push("disable: true");
	const permKeys = Object.keys(row.permissions);
	if (permKeys.length > 0) {
		lines.push("permission:");
		for (const k of permKeys.sort())
			lines.push(`  ${k}: ${row.permissions[k]}`);
	}
	lines.push("---", row.prompt);
	return lines.join("\n");
}

function toJson(row: SubagentRow): string {
	const agent: Record<string, unknown> = {
		description: row.description,
		mode: "subagent",
		prompt: row.prompt,
	};
	if (row.model) agent.model = row.model;
	if (row.temperature !== null) agent.temperature = row.temperature;
	if (row.steps !== null) agent.steps = row.steps;
	if (row.topP !== null) agent.top_p = row.topP;
	if (row.color) agent.color = row.color;
	if (row.hidden) agent.hidden = true;
	if (row.disabled) agent.disable = true;
	if (Object.keys(row.permissions).length > 0) {
		agent.permission = row.permissions;
	}
	return JSON.stringify({ agent: { [row.name]: agent } }, null, 2);
}

type CreateInput = {
	color?: string | null;
	description: string;
	disabled?: boolean;
	hidden?: boolean;
	model?: string;
	name: string;
	permissions?: Record<string, string>;
	prompt: string;
	steps?: number | null;
	temperature?: number | null;
	topP?: number | null;
};

function SubagentDialog({
	existingNames,
	initial,
	onClose,
	onSave,
	open,
	pending,
	title,
}: {
	existingNames: string[];
	initial: SubagentForm;
	onClose: () => void;
	onSave: (input: CreateInput) => void;
	open: boolean;
	pending: boolean;
	title: string;
}) {
	const [form, setForm] = useState<SubagentForm>(initial);

	useEffect(() => {
		if (open) setForm(initial);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const errors = validateForm(form);
	const duplicate =
		form.name.trim() !== "" &&
		existingNames.some(
			(n) => n.toLowerCase() === form.name.trim().toLowerCase(),
		);
	const valid = Object.keys(errors).length === 0 && !duplicate;

	function set<K extends keyof SubagentForm>(key: K, value: SubagentForm[K]) {
		setForm((f) => ({ ...f, [key]: value }));
	}

	function handleSave() {
		if (!valid) return;
		const trimmedModel = form.model.trim();
		onSave({
			...(trimmedModel === "" ? {} : { model: trimmedModel }),
			color: form.color.trim() === "" ? null : form.color.trim(),
			description: form.description.trim(),
			disabled: form.disabled,
			hidden: form.hidden,
			name: form.name.trim().toLowerCase(),
			permissions: permissionsPayload(form),
			prompt: form.prompt,
			steps: form.steps.trim() === "" ? null : Number(form.steps),
			temperature:
				form.temperature.trim() === "" ? null : Number(form.temperature),
			topP: form.topP.trim() === "" ? null : Number(form.topP),
		});
	}

	return (
		<Dialog onOpenChange={(next) => !next && onClose()} open={open}>
			<DialogContent className="max-w-3xl p-0" onClose={onClose}>
				<DialogHeader className="px-4 py-3">
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>
						Mode is fixed to subagent. The file name becomes the agent name.
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold" htmlFor="subagent-name">
								Name
							</Label>
							<Input
								id="subagent-name"
								onChange={(e) => set("name", e.target.value)}
								placeholder="code-reviewer"
								value={form.name}
							/>
							{errors.name ? (
								<p className="text-destructive text-xs">{errors.name}</p>
							) : null}
							{duplicate ? (
								<p className="text-destructive text-xs">
									A subagent with this name already exists.
								</p>
							) : null}
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold" htmlFor="subagent-model">
								Model (optional)
							</Label>
							<Input
								id="subagent-model"
								onChange={(e) => set("model", e.target.value)}
								placeholder="anthropic/claude-sonnet-4-20250514"
								value={form.model}
							/>
							{errors.model ? (
								<p className="text-destructive text-xs">{errors.model}</p>
							) : null}
						</div>
					</div>

					<div className="space-y-1.5">
						<Label
							className="text-xs font-semibold"
							htmlFor="subagent-description"
						>
							Description (required — when to use this subagent)
						</Label>
						<Input
							id="subagent-description"
							onChange={(e) => set("description", e.target.value)}
							placeholder="Reviews code for best practices and potential issues"
							value={form.description}
						/>
						{errors.description ? (
							<p className="text-destructive text-xs">{errors.description}</p>
						) : null}
					</div>

					<div className="space-y-1.5">
						<Label className="text-xs font-semibold" htmlFor="subagent-prompt">
							System prompt
						</Label>
						<Textarea
							id="subagent-prompt"
							onChange={(e) => set("prompt", e.target.value)}
							placeholder="You are a code reviewer. Focus on security, performance, and maintainability."
							rows={6}
							value={form.prompt}
						/>
						{errors.prompt ? (
							<p className="text-destructive text-xs">{errors.prompt}</p>
						) : null}
					</div>

					<div className="grid gap-4 sm:grid-cols-4">
						<div className="space-y-1.5">
							<Label
								className="text-xs font-semibold"
								htmlFor="subagent-temperature"
							>
								Temperature
							</Label>
							<Input
								id="subagent-temperature"
								inputMode="decimal"
								onChange={(e) => set("temperature", e.target.value)}
								placeholder="0.3"
								value={form.temperature}
							/>
							{errors.temperature ? (
								<p className="text-destructive text-xs">{errors.temperature}</p>
							) : null}
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold" htmlFor="subagent-steps">
								Max steps
							</Label>
							<Input
								id="subagent-steps"
								inputMode="numeric"
								onChange={(e) => set("steps", e.target.value)}
								placeholder="20"
								value={form.steps}
							/>
							{errors.steps ? (
								<p className="text-destructive text-xs">{errors.steps}</p>
							) : null}
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold" htmlFor="subagent-topp">
								Top P
							</Label>
							<Input
								id="subagent-topp"
								inputMode="decimal"
								onChange={(e) => set("topP", e.target.value)}
								placeholder="0.9"
								value={form.topP}
							/>
							{errors.topP ? (
								<p className="text-destructive text-xs">{errors.topP}</p>
							) : null}
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold" htmlFor="subagent-color">
								Color
							</Label>
							<Input
								id="subagent-color"
								onChange={(e) => set("color", e.target.value)}
								placeholder="#ff6b6b or accent"
								value={form.color}
							/>
							{errors.color ? (
								<p className="text-destructive text-xs">{errors.color}</p>
							) : null}
						</div>
					</div>

					<div className="space-y-1.5">
						<Label className="text-xs font-semibold">Permissions</Label>
						<div className="grid gap-3 sm:grid-cols-3">
							{PERMISSION_KEYS.map((key) => (
								<div className="space-y-1" key={key}>
									<Label
										className="text-muted-foreground text-xs"
										htmlFor={`perm-${key}`}
									>
										{key}
									</Label>
									<Select
										id={`perm-${key}`}
										onChange={(e) =>
											set("permissions", {
												...form.permissions,
												[key]: e.target.value as PermissionValue | "",
											})
										}
										value={form.permissions[key]}
									>
										<option value="">Inherit</option>
										<option value="allow">Allow</option>
										<option value="ask">Ask</option>
										<option value="deny">Deny</option>
									</Select>
								</div>
							))}
						</div>
						<p className="text-muted-foreground text-xs">
							Unset inherits the caller default. Edit gates
							write/edit/apply_patch; bash gates shell commands; task gates
							invoking other subagents.
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-4">
						<label className="flex items-center gap-2 text-sm">
							<input
								checked={form.hidden}
								onChange={(e) => set("hidden", e.target.checked)}
								type="checkbox"
							/>
							Hide from @ autocomplete
						</label>
						<label className="flex items-center gap-2 text-sm">
							<input
								checked={form.disabled}
								onChange={(e) => set("disabled", e.target.checked)}
								type="checkbox"
							/>
							Disabled
						</label>
					</div>

					<div className="flex items-center justify-end gap-2">
						<Button onClick={onClose} size="sm" type="button" variant="ghost">
							Cancel
						</Button>
						<Button
							disabled={!valid || pending}
							onClick={handleSave}
							size="sm"
							type="button"
							variant="primary"
						>
							{pending ? "Saving…" : "Save subagent"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function SubagentsPage() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [q, setQ] = useState("");
	const [createOpen, setCreateOpen] = useState(false);
	const [createInitial, setCreateInitial] = useState<SubagentForm>(EMPTY_FORM);
	const [editing, setEditing] = useState<SubagentRow | null>(null);

	const listQuery = useQuery(
		rpc.subagents.list.queryOptions({
			input: q.trim() ? { q: q.trim() } : undefined,
		}),
	);
	const items = useMemo(
		() => (listQuery.data ?? []) as SubagentRow[],
		[listQuery.data],
	);
	const existingNames = useMemo(() => items.map((s) => s.name), [items]);

	const invalidate = () =>
		void queryClient.invalidateQueries({
			queryKey: rpcPathKey(rpc.subagents.list.key()),
		});

	const createMutation = useMutation(
		rpc.subagents.create.mutationOptions({
			onError: (e) =>
				toast({
					description: e instanceof Error ? e.message : "Create failed",
					title: "Failed to create subagent",
					variant: "destructive",
				}),
			onSuccess: (row) => {
				invalidate();
				setCreateOpen(false);
				setCreateInitial(EMPTY_FORM);
				toast({
					description: (row as SubagentRow).name,
					title: "Subagent created",
				});
			},
		}),
	);

	const updateMutation = useMutation(
		rpc.subagents.update.mutationOptions({
			onError: (e) =>
				toast({
					description: e instanceof Error ? e.message : "Update failed",
					title: "Failed to update subagent",
					variant: "destructive",
				}),
			onSuccess: (row) => {
				invalidate();
				setEditing(null);
				toast({
					description: (row as SubagentRow).name,
					title: "Subagent updated",
				});
			},
		}),
	);

	const removeMutation = useMutation(
		rpc.subagents.remove.mutationOptions({
			onError: (e) =>
				toast({
					description: e instanceof Error ? e.message : "Delete failed",
					title: "Failed to delete subagent",
					variant: "destructive",
				}),
			onSuccess: () => {
				invalidate();
				toast({ title: "Subagent deleted" });
			},
		}),
	);

	function copyText(text: string, title: string) {
		void navigator.clipboard?.writeText(text).then(
			() => toast({ title }),
			() => toast({ title: "Copy failed", variant: "destructive" }),
		);
	}

	function openCreate() {
		setCreateInitial(EMPTY_FORM);
		setCreateOpen(true);
	}

	function openDuplicate(row: SubagentRow) {
		setCreateInitial({ ...toForm(row), name: `${row.name}-copy` });
		setCreateOpen(true);
	}

	return (
		<div className="space-y-6">
			<PageHeader
				action={
					<Button onClick={openCreate} variant="primary">
						New subagent
					</Button>
				}
				description="Custom specialized assistants primary agents can invoke via @mention. Mode is always subagent."
				title="Subagents"
			/>

			<div className="flex gap-3">
				<div className="w-full max-w-sm space-y-1.5">
					<Label className="text-xs font-semibold" htmlFor="subagent-search">
						Search
					</Label>
					<Input
						id="subagent-search"
						onChange={(e) => setQ(e.target.value)}
						placeholder="Filter by name…"
						value={q}
					/>
				</div>
			</div>

			{listQuery.isPending ? (
				<ListLoadingCard label="Loading subagents…" />
			) : listQuery.isError ? (
				<ListErrorAlert
					error={listQuery.error}
					onRetry={() => void listQuery.refetch()}
					title="Failed to load subagents"
				/>
			) : items.length === 0 ? (
				<ListEmptyCard
					action={
						<Button className="mt-4" onClick={openCreate} variant="primary">
							New subagent
						</Button>
					}
					description="Create a specialized assistant with its own prompt, model, and permissions. Invoke it with @name."
					title="No subagents"
				/>
			) : (
				<ListResultCard
					summary={
						<>
							<span className="font-semibold">{items.length} subagents</span>
						</>
					}
				>
					<div>
						{items.map((s) => (
							<div
								className="flex flex-col gap-2 border-b px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
								key={s.id}
							>
								<div className="min-w-0">
									<p className="flex items-center gap-2 font-mono font-semibold text-sm">
										{s.color ? (
											<span
												aria-hidden={true}
												className="inline-block size-2.5 rounded-full border"
												style={{
													backgroundColor: s.color.startsWith("#")
														? s.color
														: undefined,
												}}
											/>
										) : null}
										{s.name}
									</p>
									<p className="truncate text-muted-foreground text-sm">
										{s.description}
									</p>
									<p className="truncate font-mono text-muted-foreground text-xs">
										{s.model ?? "inherits model"}
										{s.temperature !== null ? ` · temp ${s.temperature}` : ""}
										{s.steps !== null ? ` · ${s.steps} steps` : ""}
									</p>
								</div>
								<div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-center">
									{s.hidden ? <Badge variant="outline">hidden</Badge> : null}
									{s.disabled ? (
										<Badge variant="destructive">disabled</Badge>
									) : null}
									<Button
										onClick={() => copyText(toMarkdown(s), "Markdown copied")}
										size="sm"
										type="button"
										variant="outline"
									>
										Copy md
									</Button>
									<Button
										onClick={() => copyText(toJson(s), "JSON copied")}
										size="sm"
										type="button"
										variant="outline"
									>
										Copy JSON
									</Button>
									<Button
										onClick={() => openDuplicate(s)}
										size="sm"
										type="button"
										variant="outline"
									>
										Duplicate
									</Button>
									<Button
										onClick={() => setEditing(s)}
										size="sm"
										type="button"
										variant="outline"
									>
										Edit
									</Button>
									<Button
										disabled={removeMutation.isPending}
										onClick={() => removeMutation.mutate({ id: s.id })}
										size="sm"
										type="button"
										variant="destructive"
									>
										Delete
									</Button>
								</div>
							</div>
						))}
					</div>
				</ListResultCard>
			)}

			<SubagentDialog
				existingNames={existingNames}
				initial={createInitial}
				onClose={() => {
					setCreateOpen(false);
					setCreateInitial(EMPTY_FORM);
				}}
				onSave={(input) => createMutation.mutate(input)}
				open={createOpen}
				pending={createMutation.isPending}
				title="New subagent"
			/>
			{editing ? (
				<SubagentDialog
					existingNames={existingNames.filter((n) => n !== editing.name)}
					initial={toForm(editing)}
					onClose={() => setEditing(null)}
					onSave={(input) =>
						updateMutation.mutate({ ...input, id: editing.id })
					}
					open={true}
					pending={updateMutation.isPending}
					title={`Edit ${editing.name}`}
				/>
			) : null}
		</div>
	);
}
