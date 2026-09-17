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
	signalId: string;
	title: string;
}

interface SignalOption {
	id: string;
	title: string;
}

interface AgentOption {
	name: string;
}

interface Props {
	agents?: AgentOption[];
	defaultSignalId?: string;
	loading?: boolean;
	onCancel?: () => void;
	onSubmit: (values: {
		agent: string | undefined;
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
	agents,
	projects,
	signals,
	defaultSignalId,
	onSubmit,
	onCancel,
	submitLabel = "Queue task",
	loading,
}: Props) {
	const { errors, set, submitWith, values } = useZodForm<Values>({
		agent: "",
		projectId: "",
		prompt: "",
		signalId: defaultSignalId ?? "",
		title: "",
	});

	function toInput(v: Values) {
		return {
			agent: v.agent || undefined,
			projectId: v.projectId || undefined,
			prompt: v.prompt || undefined,
			signalId: v.signalId || undefined,
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
				<FormField id="signalId" label="Origin signal">
					<Select
						id="signalId"
						onChange={(e) => set("signalId", e.target.value)}
						value={values.signalId}
					>
						<option value="">Direct (no signal)</option>
						{(signals ?? []).map((sig) => (
							<option key={sig.id} value={sig.id}>
								{sig.title}
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
			<FormFooter
				loading={loading}
				onCancel={onCancel}
				submitLabel={submitLabel}
			/>
		</form>
	);
}
