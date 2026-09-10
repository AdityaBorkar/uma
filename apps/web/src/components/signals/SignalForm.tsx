import { useState } from "react";

import { Button } from "#/components/ui/button.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Label } from "#/components/ui/label.tsx";
import { Select } from "#/components/ui/select.tsx";
import { Textarea } from "#/components/ui/textarea.tsx";
import { fieldErrors, type ProjectOption } from "#/lib/forms.ts";
import { SIGNAL_SEVERITY_VALUES, SignalCreateInput } from "#/schemas/schema.ts";

interface Values {
	body: string;
	projectId: string;
	severity: (typeof SIGNAL_SEVERITY_VALUES)[number];
	title: string;
	url: string;
}

interface Props {
	loading?: boolean;
	onCancel?: () => void;
	onSubmit: (values: {
		body: string | undefined;
		projectId: string | undefined;
		severity: Values["severity"];
		title: string;
		url: string | undefined;
	}) => Promise<void> | void;
	projects?: ProjectOption[];
	submitLabel?: string;
}

export function SignalForm({
	projects,
	onSubmit,
	onCancel,
	submitLabel = "Save",
	loading,
}: Props) {
	const [values, setValues] = useState<Values>({
		body: "",
		projectId: "",
		severity: "info",
		title: "",
		url: "",
	});
	const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>(
		{},
	);

	/** Validation is the canonical Zod schema — no duplicated rules here. */
	function validate(): boolean {
		const result = SignalCreateInput.safeParse({
			body: values.body || undefined,
			projectId: values.projectId || undefined,
			severity: values.severity,
			title: values.title,
			url: values.url || undefined,
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
			body: values.body || undefined,
			projectId: values.projectId || undefined,
			severity: values.severity,
			title: values.title,
			url: values.url || undefined,
		});
	}

	return (
		<form className="space-y-4" onSubmit={handleSubmit}>
			<div className="space-y-2">
				<Label htmlFor="title">Title *</Label>
				<Input
					id="title"
					onChange={(e) => setValues((s) => ({ ...s, title: e.target.value }))}
					placeholder="Checkout returns 500 on empty cart"
					value={values.title}
				/>
				{errors.title ? (
					<p className="text-destructive text-xs">{errors.title}</p>
				) : null}
			</div>
			<div className="space-y-2">
				<Label htmlFor="body">Details</Label>
				<Textarea
					id="body"
					onChange={(e) => setValues((s) => ({ ...s, body: e.target.value }))}
					placeholder="What was observed, where, and why it matters"
					rows={3}
					value={values.body}
				/>
				{errors.body ? (
					<p className="text-destructive text-xs">{errors.body}</p>
				) : null}
			</div>
			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label htmlFor="severity">Severity</Label>
					<Select
						id="severity"
						onChange={(e) =>
							setValues((s) => ({
								...s,
								severity: e.target.value as Values["severity"],
							}))
						}
						value={values.severity}
					>
						{SIGNAL_SEVERITY_VALUES.map((severity) => (
							<option key={severity} value={severity}>
								{severity}
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
			<div className="space-y-2">
				<Label htmlFor="url">Link</Label>
				<Input
					id="url"
					onChange={(e) => setValues((s) => ({ ...s, url: e.target.value }))}
					placeholder="https://github.com/owner/repo/issues/123"
					value={values.url}
				/>
				{errors.url ? (
					<p className="text-destructive text-xs">{errors.url}</p>
				) : null}
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
