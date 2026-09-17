import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
	ListErrorAlert,
	ListLoadingCard,
	ListResultCard,
	PageHeader,
} from "#/components/lists/shared.tsx";
import { Badge } from "#/components/ui/badge.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Textarea } from "#/components/ui/textarea.tsx";
import { isDuplicateName, slugNameError } from "#/lib/forms.ts";
import { editingNames, useRegistryDialogState } from "#/lib/lists.ts";
import { useCrudToasts } from "#/lib/mutations.ts";
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
	const nameError = slugNameError(form.name);
	if (nameError) {
		errors.name = nameError;
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
	const duplicate = isDuplicateName(form.name, existingNames);
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
		<FormDialog
			description="Run it with /name in the TUI. The file name becomes the prompt template name."
			maxWidth="xl"
			onClose={onClose}
			onOpenChange={(next) => {
				if (!next) {
					onClose();
				}
			}}
			open={open}
			title={title}
		>
			<div className="grid gap-4 sm:grid-cols-2">
				<FormField error={errors.name} id="prompt-template-name" label="Name">
					<Input
						id="prompt-template-name"
						onChange={(e) => set("name", e.target.value)}
						placeholder="test"
						value={form.name}
					/>
					{duplicate ? (
						<p className="text-destructive text-xs">
							A prompt template with this name already exists.
						</p>
					) : null}
				</FormField>
				<FormField
					error={errors.agent}
					id="prompt-template-agent"
					label="Agent (optional)"
				>
					<Input
						id="prompt-template-agent"
						onChange={(e) => set("agent", e.target.value)}
						placeholder="build"
						value={form.agent}
					/>
				</FormField>
			</div>

			<FormField
				error={errors.description}
				id="prompt-template-description"
				label="Description (shown in the TUI)"
			>
				<Input
					id="prompt-template-description"
					onChange={(e) => set("description", e.target.value)}
					placeholder="Run tests with coverage"
					value={form.description}
				/>
			</FormField>

			<FormField
				error={errors.template}
				hint={
					<>
						Placeholders: <code className="font-mono">$ARGUMENTS</code>,{" "}
						<code className="font-mono">$1 $2 …</code>, shell output{" "}
						<code className="font-mono">!`cmd`</code>, file references{" "}
						<code className="font-mono">@path</code>.
					</>
				}
				id="prompt-template-template"
				label="Template"
			>
				<Textarea
					id="prompt-template-template"
					onChange={(e) => set("template", e.target.value)}
					placeholder={
						"Run the full test suite with $ARGUMENTS and show any failures.\n\nRecent commits:\n!`git log --oneline -10`\n\nReview @src/components/Button.tsx and suggest fixes."
					}
					rows={8}
					value={form.template}
				/>
			</FormField>

			<div className="grid gap-4 sm:grid-cols-2">
				<FormField
					error={errors.model}
					id="prompt-template-model"
					label="Model (optional)"
				>
					<Input
						id="prompt-template-model"
						onChange={(e) => set("model", e.target.value)}
						placeholder="anthropic/claude-sonnet-4-20250514"
						value={form.model}
					/>
				</FormField>
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

			<DialogFooter
				disabled={!valid || pending}
				onCancel={onClose}
				onSave={handleSave}
				pending={pending}
				saveLabel="Save prompt template"
			/>
		</FormDialog>
	);
}

function PromptTemplatesPage() {
	const {
		notifyCreated,
		notifyDeleted,
		notifyUpdated,
		onCreateError,
		onRemoveError,
		onUpdateError,
	} = useCrudToasts("prompt template");
	const queryClient = useQueryClient();
	const {
		input: qInput,
		query: q,
		setInput: setQInput,
	} = useLocalSearchInput("", 250);
	const {
		closeCreate,
		createInitial,
		createOpen,
		editing,
		openCreate,
		openDuplicate,
		setEditing,
	} = useRegistryDialogState<PromptTemplateRow, PromptTemplateForm>(
		EMPTY_FORM,
		toForm,
		(row) => row.name,
	);

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
			onError: onCreateError,
			onSuccess: (row) => {
				invalidate();
				closeCreate();
				notifyCreated((row as PromptTemplateRow).name);
			},
		}),
	);

	const updateMutation = useMutation(
		rpc.promptTemplates.update.mutationOptions({
			onError: onUpdateError,
			onSuccess: (row) => {
				invalidate();
				setEditing(null);
				notifyUpdated((row as PromptTemplateRow).name);
			},
		}),
	);

	const removeMutation = useMutation(
		rpc.promptTemplates.remove.mutationOptions({
			onError: onRemoveError,
			onSuccess: () => {
				invalidate();
				notifyDeleted();
			},
		}),
	);

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

			<FilterBar
				search={{
					id: "prompt-template-search",
					onChange: setQInput,
					placeholder: "Filter by name…",
					value: qInput,
				}}
				variant="bare"
			/>

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
							<ListRow key={c.id}>
								<ListRowMain>
									<ListRowTitle mono={true}>/{c.name}</ListRowTitle>
									<ListRowSubtitle>
										{c.description || "No description."}
									</ListRowSubtitle>
									<p className="truncate font-mono text-muted-foreground text-xs">
										{c.agent ? `agent ${c.agent}` : "current agent"}
										{c.model ? ` · ${c.model}` : ""}
										{c.subtask ? " · subtask" : ""}
									</p>
								</ListRowMain>
								<ListRowActions>
									{c.subtask ? <Badge variant="outline">subtask</Badge> : null}
									<Button
										onClick={() => copyText(toMarkdown(c), "Markdown copied")}
										size="sm"
										type="button"
										variant="outline"
									>
										Copy md
									</Button>
									<Button
										onClick={() => copyText(toJson(c), "JSON copied")}
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
								</ListRowActions>
							</ListRow>
						))}
					</div>
				</ListResultCard>
			)}

			<PromptTemplateDialog
				existingNames={existingNames}
				initial={createInitial}
				onClose={closeCreate}
				onSave={(input) => createMutation.mutate(input)}
				open={createOpen}
				pending={createMutation.isPending}
				title="New prompt template"
			/>
			{editing ? (
				<PromptTemplateDialog
					existingNames={editingNames(existingNames, editing.name)}
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
