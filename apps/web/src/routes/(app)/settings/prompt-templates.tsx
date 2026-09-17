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
import { Textarea } from "#/components/ui/textarea.tsx";
import { useToast } from "#/components/ui/toaster.tsx";
import { rpc } from "#/lib/rpc.ts";
import { copyText } from "#/stores/clipboard.ts";
import { useLocalSearchInput } from "#/stores/filters.ts";
import { invalidatePromptTemplates } from "#/stores/invalidation.ts";

export const Route = createFileRoute("/(app)/settings/prompt-templates")({
	component: PromptTemplatesPage,
	head: () => ({
		meta: [
			{ title: "Prompt Templates — Planner" },
			{
				content:
					"Custom prompt templates: reusable prompts with arguments, shell output, and file references.",
				name: "description",
			},
		],
	}),
});

interface PromptTemplateRow {
	agent: string | null;
	description: string;
	id: string;
	model: string | null;
	name: string;
	subtask: boolean;
	template: string;
}

interface PromptTemplateForm {
	agent: string;
	description: string;
	model: string;
	name: string;
	subtask: boolean;
	template: string;
}

const EMPTY_FORM: PromptTemplateForm = {
	agent: "",
	description: "",
	model: "",
	name: "",
	subtask: false,
	template: "",
};

const NAME_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

function toForm(row: PromptTemplateRow): PromptTemplateForm {
	return {
		agent: row.agent ?? "",
		description: row.description,
		model: row.model ?? "",
		name: row.name,
		subtask: row.subtask,
		template: row.template,
	};
}

function validateForm(form: PromptTemplateForm): Record<string, string> {
	const errors: Record<string, string> = {};
	if (
		!NAME_RE.test(form.name.trim().toLowerCase()) ||
		form.name.trim().length > 64
	) {
		errors.name = "Lowercase slug (letters, digits, dashes), max 64.";
	}
	if (form.description.trim().length > 500)
		errors.description = "Max 500 characters.";
	if (form.template.length < 1) errors.template = "Template is required.";
	else if (form.template.length > 20_000)
		errors.template = "Max 20000 characters.";
	if (form.agent.trim().length > 64) errors.agent = "Max 64 characters.";
	if (form.model.trim().length > 200) errors.model = "Max 200 characters.";
	return errors;
}

function toMarkdown(row: PromptTemplateRow): string {
	const lines = ["---"];
	if (row.description) lines.push(`description: ${row.description}`);
	if (row.agent) lines.push(`agent: ${row.agent}`);
	if (row.model) lines.push(`model: ${row.model}`);
	if (row.subtask) lines.push("subtask: true");
	lines.push("---", row.template);
	return lines.join("\n");
}

function toJson(row: PromptTemplateRow): string {
	// `command` key is OpenCode export compat — do not rename with the UI term.
	const entry: Record<string, unknown> = { template: row.template };
	if (row.description) entry.description = row.description;
	if (row.agent) entry.agent = row.agent;
	if (row.model) entry.model = row.model;
	if (row.subtask) entry.subtask = true;
	return JSON.stringify({ command: { [row.name]: entry } }, null, 2);
}

type CreateInput = {
	agent?: string;
	description?: string;
	model?: string;
	name: string;
	subtask?: boolean;
	template: string;
};

function PromptTemplateDialog({
	existingNames,
	initial,
	onClose,
	onSave,
	open,
	pending,
	title,
}: {
	existingNames: string[];
	initial: PromptTemplateForm;
	onClose: () => void;
	onSave: (input: CreateInput) => void;
	open: boolean;
	pending: boolean;
	title: string;
}) {
	const [form, setForm] = useState<PromptTemplateForm>(initial);

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

	function set<K extends keyof PromptTemplateForm>(
		key: K,
		value: PromptTemplateForm[K],
	) {
		setForm((f) => ({ ...f, [key]: value }));
	}

	function handleSave() {
		if (!valid) return;
		onSave({
			...(form.agent.trim() === "" ? {} : { agent: form.agent.trim() }),
			...(form.description.trim() === ""
				? {}
				: { description: form.description.trim() }),
			...(form.model.trim() === "" ? {} : { model: form.model.trim() }),
			name: form.name.trim().toLowerCase(),
			subtask: form.subtask,
			template: form.template,
		});
	}

	return (
		<Dialog onOpenChange={(next) => !next && onClose()} open={open}>
			<DialogContent className="max-w-3xl p-0" onClose={onClose}>
				<DialogHeader className="px-4 py-3">
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>
						Run it with /name in the TUI. The file name becomes the prompt
						template name.
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label
								className="text-xs font-semibold"
								htmlFor="prompt-template-name"
							>
								Name
							</Label>
							<Input
								id="prompt-template-name"
								onChange={(e) => set("name", e.target.value)}
								placeholder="test"
								value={form.name}
							/>
							{errors.name ? (
								<p className="text-destructive text-xs">{errors.name}</p>
							) : null}
							{duplicate ? (
								<p className="text-destructive text-xs">
									A prompt template with this name already exists.
								</p>
							) : null}
						</div>
						<div className="space-y-1.5">
							<Label
								className="text-xs font-semibold"
								htmlFor="prompt-template-agent"
							>
								Agent (optional)
							</Label>
							<Input
								id="prompt-template-agent"
								onChange={(e) => set("agent", e.target.value)}
								placeholder="build"
								value={form.agent}
							/>
							{errors.agent ? (
								<p className="text-destructive text-xs">{errors.agent}</p>
							) : null}
						</div>
					</div>

					<div className="space-y-1.5">
						<Label
							className="text-xs font-semibold"
							htmlFor="prompt-template-description"
						>
							Description (shown in the TUI)
						</Label>
						<Input
							id="prompt-template-description"
							onChange={(e) => set("description", e.target.value)}
							placeholder="Run tests with coverage"
							value={form.description}
						/>
						{errors.description ? (
							<p className="text-destructive text-xs">{errors.description}</p>
						) : null}
					</div>

					<div className="space-y-1.5">
						<Label
							className="text-xs font-semibold"
							htmlFor="prompt-template-template"
						>
							Template
						</Label>
						<Textarea
							id="prompt-template-template"
							onChange={(e) => set("template", e.target.value)}
							placeholder={
								"Run the full test suite with $ARGUMENTS and show any failures.\n\nRecent commits:\n!`git log --oneline -10`\n\nReview @src/components/Button.tsx and suggest fixes."
							}
							rows={8}
							value={form.template}
						/>
						{errors.template ? (
							<p className="text-destructive text-xs">{errors.template}</p>
						) : null}
						<p className="text-muted-foreground text-xs">
							Placeholders: <code className="font-mono">$ARGUMENTS</code>,{" "}
							<code className="font-mono">$1 $2 …</code>, shell output{" "}
							<code className="font-mono">!`cmd`</code>, file references{" "}
							<code className="font-mono">@path</code>.
						</p>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label
								className="text-xs font-semibold"
								htmlFor="prompt-template-model"
							>
								Model (optional)
							</Label>
							<Input
								id="prompt-template-model"
								onChange={(e) => set("model", e.target.value)}
								placeholder="anthropic/claude-sonnet-4-20250514"
								value={form.model}
							/>
							{errors.model ? (
								<p className="text-destructive text-xs">{errors.model}</p>
							) : null}
						</div>
						<div className="flex items-end pb-1">
							<label className="flex items-center gap-2 text-sm">
								<input
									checked={form.subtask}
									onChange={(e) => set("subtask", e.target.checked)}
									type="checkbox"
								/>
								Run as subtask (don't pollute primary context)
							</label>
						</div>
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
							{pending ? "Saving…" : "Save prompt template"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function PromptTemplatesPage() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const {
		input: qInput,
		query: q,
		setInput: setQInput,
	} = useLocalSearchInput("", 250);
	const [createOpen, setCreateOpen] = useState(false);
	const [createInitial, setCreateInitial] =
		useState<PromptTemplateForm>(EMPTY_FORM);
	const [editing, setEditing] = useState<PromptTemplateRow | null>(null);

	const listQuery = useQuery(
		rpc.promptTemplates.list.queryOptions({
			input: q ? { q } : undefined,
		}),
	);
	const items = useMemo(
		() => (listQuery.data ?? []) as PromptTemplateRow[],
		[listQuery.data],
	);
	const existingNames = useMemo(() => items.map((c) => c.name), [items]);

	const invalidate = () => invalidatePromptTemplates(queryClient);

	const createMutation = useMutation(
		rpc.promptTemplates.create.mutationOptions({
			onError: (e) =>
				toast({
					description: e instanceof Error ? e.message : "Create failed",
					title: "Failed to create prompt template",
					variant: "destructive",
				}),
			onSuccess: (row) => {
				invalidate();
				setCreateOpen(false);
				setCreateInitial(EMPTY_FORM);
				toast({
					description: (row as PromptTemplateRow).name,
					title: "Prompt template created",
				});
			},
		}),
	);

	const updateMutation = useMutation(
		rpc.promptTemplates.update.mutationOptions({
			onError: (e) =>
				toast({
					description: e instanceof Error ? e.message : "Update failed",
					title: "Failed to update prompt template",
					variant: "destructive",
				}),
			onSuccess: (row) => {
				invalidate();
				setEditing(null);
				toast({
					description: (row as PromptTemplateRow).name,
					title: "Prompt template updated",
				});
			},
		}),
	);

	const removeMutation = useMutation(
		rpc.promptTemplates.remove.mutationOptions({
			onError: (e) =>
				toast({
					description: e instanceof Error ? e.message : "Delete failed",
					title: "Failed to delete prompt template",
					variant: "destructive",
				}),
			onSuccess: () => {
				invalidate();
				toast({ title: "Prompt template deleted" });
			},
		}),
	);

	function handleCopy(text: string, title: string) {
		copyText(text, title);
	}

	function openCreate() {
		setCreateInitial(EMPTY_FORM);
		setCreateOpen(true);
	}

	function openDuplicate(row: PromptTemplateRow) {
		setCreateInitial({ ...toForm(row), name: `${row.name}-copy` });
		setCreateOpen(true);
	}

	return (
		<div className="space-y-6">
			<PageHeader
				action={
					<Button onClick={openCreate} variant="primary">
						New prompt template
					</Button>
				}
				description="Custom prompt templates run a saved prompt from /name. Supports $ARGUMENTS, shell output, and @file references."
				title="Prompt Templates"
			/>

			<div className="flex gap-3">
				<div className="w-full max-w-sm space-y-1.5">
					<Label
						className="text-xs font-semibold"
						htmlFor="prompt-template-search"
					>
						Search
					</Label>
					<Input
						id="prompt-template-search"
						onChange={(e) => setQInput(e.target.value)}
						placeholder="Filter by name…"
						value={qInput}
					/>
				</div>
			</div>

			{listQuery.isPending ? (
				<ListLoadingCard label="Loading prompt templates…" />
			) : listQuery.isError ? (
				<ListErrorAlert
					error={listQuery.error}
					onRetry={() => void listQuery.refetch()}
					title="Failed to load prompt templates"
				/>
			) : items.length === 0 ? (
				<ListEmptyCard
					action={
						<Button className="mt-4" onClick={openCreate} variant="primary">
							New prompt template
						</Button>
					}
					description="Create a reusable prompt with arguments, shell output, and file references. Run it with /name."
					title="No prompt templates"
				/>
			) : (
				<ListResultCard
					summary={
						<span className="font-semibold">
							{items.length} prompt templates
						</span>
					}
				>
					<div>
						{items.map((c) => (
							<div
								className="flex flex-col gap-2 border-b px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
								key={c.id}
							>
								<div className="min-w-0">
									<p className="font-mono font-semibold text-sm">/{c.name}</p>
									<p className="truncate text-muted-foreground text-sm">
										{c.description || "No description."}
									</p>
									<p className="truncate font-mono text-muted-foreground text-xs">
										{c.agent ? `agent ${c.agent}` : "current agent"}
										{c.model ? ` · ${c.model}` : ""}
										{c.subtask ? " · subtask" : ""}
									</p>
								</div>
								<div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-center">
									{c.subtask ? <Badge variant="outline">subtask</Badge> : null}
									<Button
										onClick={() => handleCopy(toMarkdown(c), "Markdown copied")}
										size="sm"
										type="button"
										variant="outline"
									>
										Copy md
									</Button>
									<Button
										onClick={() => handleCopy(toJson(c), "JSON copied")}
										size="sm"
										type="button"
										variant="outline"
									>
										Copy JSON
									</Button>
									<Button
										onClick={() => openDuplicate(c)}
										size="sm"
										type="button"
										variant="outline"
									>
										Duplicate
									</Button>
									<Button
										onClick={() => setEditing(c)}
										size="sm"
										type="button"
										variant="outline"
									>
										Edit
									</Button>
									<Button
										disabled={removeMutation.isPending}
										onClick={() => removeMutation.mutate({ id: c.id })}
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

			<PromptTemplateDialog
				existingNames={existingNames}
				initial={createInitial}
				onClose={() => {
					setCreateOpen(false);
					setCreateInitial(EMPTY_FORM);
				}}
				onSave={(input) => createMutation.mutate(input)}
				open={createOpen}
				pending={createMutation.isPending}
				title="New prompt template"
			/>
			{editing ? (
				<PromptTemplateDialog
					existingNames={existingNames.filter((n) => n !== editing.name)}
					initial={toForm(editing)}
					onClose={() => setEditing(null)}
					onSave={(input) =>
						updateMutation.mutate({
							agent: input.agent ?? null,
							description: input.description ?? "",
							id: editing.id,
							model: input.model ?? null,
							name: input.name,
							subtask: input.subtask,
							template: input.template,
						})
					}
					open={true}
					pending={updateMutation.isPending}
					title={`Edit /${editing.name}`}
				/>
			) : null}
		</div>
	);
}
