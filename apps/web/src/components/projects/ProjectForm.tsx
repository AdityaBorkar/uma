import { useState } from "react";

import { Button } from "#/components/ui/button.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Label } from "#/components/ui/label.tsx";
import { Select } from "#/components/ui/select.tsx";
import { Textarea } from "#/components/ui/textarea.tsx";
import { fieldErrors } from "#/lib/forms.ts";
import {
	PROJECT_STATUS_VALUES,
	ProjectCreateInput,
	type ProjectStatus,
} from "#/schemas/schema.ts";

interface Values {
	description: string;
	name: string;
	status: ProjectStatus;
}

interface Props {
	defaultValues?: Partial<Values> & { id?: string };
	loading?: boolean;
	onCancel?: () => void;
	onSubmit: (values: Values & { id?: string }) => Promise<void> | void;
	submitLabel?: string;
}

export function ProjectForm({
	defaultValues,
	onSubmit,
	onCancel,
	submitLabel = "Save",
	loading,
}: Props) {
	const [values, setValues] = useState<Values>({
		description: defaultValues?.description ?? "",
		name: defaultValues?.name ?? "",
		status: defaultValues?.status ?? "active",
	});
	const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>(
		{},
	);

	/** Validation is the canonical Zod schema — no duplicated rules here. */
	function validate(): boolean {
		const result = ProjectCreateInput.safeParse({
			description: values.description || undefined,
			name: values.name,
			status: values.status,
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
		await onSubmit({ ...values, id: defaultValues?.id });
	}

	return (
		<form className="space-y-4" onSubmit={handleSubmit}>
			<div className="space-y-2">
				<Label htmlFor="name">Name *</Label>
				<Input
					id="name"
					onChange={(e) => setValues((s) => ({ ...s, name: e.target.value }))}
					placeholder="Acme Portal"
					value={values.name}
				/>
				{errors.name ? (
					<p className="text-destructive text-xs">{errors.name}</p>
				) : null}
			</div>
			<div className="space-y-2">
				<Label htmlFor="description">Description</Label>
				<Textarea
					id="description"
					onChange={(e) =>
						setValues((s) => ({ ...s, description: e.target.value }))
					}
					placeholder="Optional scope notes"
					rows={3}
					value={values.description}
				/>
				{errors.description ? (
					<p className="text-destructive text-xs">{errors.description}</p>
				) : null}
			</div>
			<div className="space-y-2">
				<Label htmlFor="status">Status</Label>
				<Select
					id="status"
					onChange={(e) =>
						setValues((s) => ({
							...s,
							status: e.target.value as ProjectStatus,
						}))
					}
					value={values.status}
				>
					{PROJECT_STATUS_VALUES.map((status) => (
						<option key={status} value={status}>
							{status}
						</option>
					))}
				</Select>
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
