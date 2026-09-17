import { FormField } from "#/components/forms/FormField.tsx";
import { FormFooter } from "#/components/forms/FormFooter.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Select } from "#/components/ui/select.tsx";
import { Textarea } from "#/components/ui/textarea.tsx";
import { type ProjectOption, useZodForm } from "#/lib/forms.ts";
import { TaskCreateInput } from "#/schemas/schema.ts";

interface Values {
	agent: string;
	projectId: string;
	prompt: string;
	title: string;
}

interface AgentOption {
	name: string;
}

interface Props {
	agents?: AgentOption[];
	loading?: boolean;
	onCancel?: () => void;
	onSubmit: (values: {
		agent: string | undefined;
		projectId: string | undefined;
		prompt: string | undefined;
		title: string;
	}) => Promise<void> | void;
	projects?: ProjectOption[];
	submitLabel?: string;
}

export function TaskForm({
	agents,
	projects,
	onSubmit,
	onCancel,
	submitLabel = "Queue task",
	loading,
}: Props) {
	const { errors, set, submitWith, values } = useZodForm<Values>({
		agent: "",
		projectId: "",
		prompt: "",
		title: "",
	});

	function toInput(v: Values) {
		return {
			agent: v.agent || undefined,
			projectId: v.projectId || undefined,
			prompt: v.prompt || undefined,
			title: v.title,
		};
	}

	async function handleSubmit(event: React.FormEvent) {
		await submitWith(event, TaskCreateInput, toInput, async (v) => {
			await onSubmit(toInput(v) as Parameters<typeof onSubmit>[0]);
		});
	}

	return (
		<form className="space-y-4" onSubmit={handleSubmit}>
			<FormField error={errors.title} id="title" label="Title" required={true}>
				<Input
					id="title"
					onChange={(e) => set("title", e.target.value)}
					placeholder="Fix empty-cart 500 in checkout service"
					value={values.title}
				/>
			</FormField>
			<FormField error={errors.prompt} id="prompt" label="Prompt">
				<Textarea
					id="prompt"
					onChange={(e) => set("prompt", e.target.value)}
					placeholder="Instruction for the agent — repro steps, constraints, definition of done"
					rows={4}
					value={values.prompt}
				/>
			</FormField>
			<div className="grid grid-cols-2 gap-4">
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
				<FormField error={errors.agent} id="agent" label="Agent">
					<Select
						id="agent"
						onChange={(e) => set("agent", e.target.value)}
						value={values.agent}
					>
						<option value="">Default (cli)</option>
						{(agents ?? []).map((a) => (
							<option key={a.name} value={a.name}>
								{a.name}
							</option>
						))}
					</Select>
				</FormField>
			</div>
			<FormFooter
				loading={loading}
				onCancel={onCancel}
				submitLabel={submitLabel}
			/>
		</form>
	);
}
