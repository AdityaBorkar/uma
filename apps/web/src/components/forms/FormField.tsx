import type { ReactNode } from "react";

import { Label } from "#/components/ui/label.tsx";

/**
 * Single form field wrapper: Label + control + hint/error.
 * Replaces ~15x `div.space-y-2` blocks across TaskForm, SignalForm,
 * ProjectForm, NewDocumentDialog and MetadataForm.
 */
export function FormField({
	children,
	error,
	hint,
	hintId,
	id,
	label,
	required,
}: {
	children: ReactNode;
	error?: string | null | undefined;
	hint?: ReactNode | undefined;
	hintId?: string | undefined;
	id: string;
	label: ReactNode;
	required?: boolean | undefined;
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>
				{label}
				{required ? " *" : null}
			</Label>
			{children}
			{error ? (
				<p className="text-destructive text-xs">{error}</p>
			) : hint ? (
				typeof hint === "string" ? (
					<p className="text-muted-foreground text-xs" id={hintId}>
						{hint}
					</p>
				) : (
					hint
				)
			) : null}
		</div>
	);
}
