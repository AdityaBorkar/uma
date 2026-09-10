import { useState } from "react";

import { Button } from "#/components/ui/button.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Label } from "#/components/ui/label.tsx";
import { Select } from "#/components/ui/select.tsx";
import { Textarea } from "#/components/ui/textarea.tsx";
import { fieldErrors, type ProjectOption } from "#/lib/forms.ts";
import { TaskCreateInput } from "#/schemas/schema.ts";

interface Values {
	projectId: string;
	prompt: string;
	signalId: string;
	title: string;
}

interface SignalOption {
	id: string;
	title: string;
}

interface Props {
	defaultSignalId?: string;
	loading?: boolean;
	onCancel?: () => void;
	onSubmit: (values: {
		projectId: string | undefined;
		prompt: string | undefined;
		signalId: string | undefined;
		title: string;
	}) => Promise<void> | void;
	projects?: ProjectOption[];
	signals?: SignalOption[];
	submitLabel?: string;
}

export function TaskForm({
	projects,
	signals,
	defaultSignalId,
	onSubmit,
	onCancel,
	submitLabel = "Queue task",
	loading,
}: Props) {
	const [values, setValues] = useState<Values>({
		projectId: "",
		prompt: "",
		signalId: defaultSignalId ?? "",
		title: "",
	});
	const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>(
		{},
	);

	/** Validation is the canonical Zod schema — no duplicated rules here. */
	function validate(): boolean {
		const result = TaskCreateInput.safeParse({
			projectId: values.projectId || undefined,
			prompt: values.prompt || undefined,
			signalId: values.signalId || undefined,
			title: values.title,
		});
		if (!result.success) {
			setErrors(fieldErrors(result.error));
			return false;
		}
		setErrors({});
		return true;
	}

	const submitText = loading ? "Saving…" : submitLabel;

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!validate()) {
			return;
		}
		await onSubmit({
			projectId: values.projectId || undefined,
			prompt: values.prompt || undefined,
			signalId: values.signalId || undefined,
			title: values.title,
		});
	}

	return (
		<form className="space-y-4" onSubmit={handleSubmit}>
			<div className="space-y-2">
				<Label htmlFor="title">Title *</Label>
				<Input
					id="title"
					onChange={(e) => setValues((s) => ({ ...s, title: e.target.value }))}
					placeholder="Fix empty-cart 500 in checkout service"
					value={values.title}
				/>
				{errors.title ? (
					<p className="text-destructive text-xs">{errors.title}</p>
				) : null}
			</div>
			<div className="space-y-2">
				<Label htmlFor="prompt">Prompt</Label>
				<Textarea
					id="prompt"
					onChange={(e) => setValues((s) => ({ ...s, prompt: e.target.value }))}
					placeholder="Instruction for the agent — repro steps, constraints, definition of done"
					rows={4}
					value={values.prompt}
				/>
				{errors.prompt ? (
					<p className="text-destructive text-xs">{errors.prompt}</p>
				) : null}
			</div>
			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label htmlFor="signalId">Origin signal</Label>
					<Select
						id="signalId"
						onChange={(e) =>
							setValues((s) => ({ ...s, signalId: e.target.value }))
						}
						value={values.signalId}
					>
						<option value="">Direct (no signal)</option>
						{(signals ?? []).map((sig) => (
							<option key={sig.id} value={sig.id}>
								{sig.title}
							</option>
						))}
					</Select>
				</div>
				<div className="space-y-2">
					<Label htmlFor="projectId">Project</Label>
					<Select
						id="projectId"
						onChange={(e) =>
							setValues((s) => ({ ...s, projectId: e.target.value }))
						}
						value={values.projectId}
					>
						<option value="">None</option>
						{(projects ?? []).map((p) => (
							<option key={p.id} value={p.id}>
								{p.name}
							</option>
						))}
					</Select>
				</div>
			</div>
			<div className="flex justify-end gap-2 pt-2">
				{onCancel ? (
					<Button onClick={onCancel} type="button" variant="outline">
						Cancel
					</Button>
				) : null}
				<Button disabled={Boolean(loading)} type="submit">
					{submitText}
				</Button>
			</div>
		</form>
	);
}
