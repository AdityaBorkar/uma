import { FormField } from "#/components/forms/FormField.tsx";
import { FormFooter } from "#/components/forms/FormFooter.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Select } from "#/components/ui/select.tsx";
import { Textarea } from "#/components/ui/textarea.tsx";
import { type ProjectOption, useZodForm } from "#/lib/forms.ts";
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
	const { errors, set, submitWith, values } = useZodForm<Values>({
		body: "",
		projectId: "",
		severity: "info",
		title: "",
		url: "",
	});

	function toInput(v: Values) {
		return {
			body: v.body || undefined,
			projectId: v.projectId || undefined,
			severity: v.severity,
			title: v.title,
			url: v.url || undefined,
		};
	}

	async function handleSubmit(event: React.FormEvent) {
		await submitWith(event, SignalCreateInput, toInput, async (v) => {
			await onSubmit({
				body: v.body || undefined,
				projectId: v.projectId || undefined,
				severity: v.severity,
				title: v.title,
				url: v.url || undefined,
			});
		});
	}

	return (
		<form className="space-y-4" onSubmit={handleSubmit}>
			<FormField error={errors.title} id="title" label="Title" required={true}>
				<Input
					id="title"
					onChange={(e) => set("title", e.target.value)}
					placeholder="Checkout returns 500 on empty cart"
					value={values.title}
				/>
			</FormField>
			<FormField error={errors.body} id="body" label="Details">
				<Textarea
					id="body"
					onChange={(e) => set("body", e.target.value)}
					placeholder="What was observed, where, and why it matters"
					rows={3}
					value={values.body}
				/>
			</FormField>
			<div className="grid grid-cols-2 gap-4">
				<FormField id="severity" label="Severity">
					<Select
						id="severity"
						onChange={(e) =>
							set("severity", e.target.value as Values["severity"])
						}
						value={values.severity}
					>
						{SIGNAL_SEVERITY_VALUES.map((severity) => (
							<option key={severity} value={severity}>
								{severity}
							</option>
						))}
					</Select>
				</FormField>
				<FormField id="projectId" label="Project">
					<Select
						id="projectId"
						onChange={(e) => set("projectId", e.target.value)}
						value={values.projectId}
					>
						<option value="">None</option>
						{(projects ?? []).map((p) => (
							<option key={p.id} value={p.id}>
								{p.name}
							</option>
						))}
					</Select>
				</FormField>
			</div>
			<FormField error={errors.url} id="url" label="Link">
				<Input
					id="url"
					onChange={(e) => set("url", e.target.value)}
					placeholder="https://github.com/owner/repo/issues/123"
					value={values.url}
				/>
			</FormField>
			<FormFooter
				loading={loading}
				onCancel={onCancel}
				submitLabel={submitLabel}
			/>
		</form>
	);
}
