import { useState } from "react";
import type { z } from "zod";

export interface ProjectOption {
	id: string;
	name: string;
}

/** Map a Zod error to `{ [firstPathSegment]: message }` for field display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
	const out: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = issue.path[0];
		if (typeof key === "string" && out[key] === undefined) {
			out[key] = issue.message;
		}
	}
	return out;
}

/** Lowercase slug (letters, digits, dashes). Shared by prompt-templates/subagents. */
export const SLUG_NAME_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

export function slugNameError(name: string): string | null {
	const trimmed = name.trim();
	if (!SLUG_NAME_RE.test(trimmed.toLowerCase()) || trimmed.length > 64) {
		return "Lowercase slug (letters, digits, dashes), max 64.";
	}
	return null;
}

export function isDuplicateName(
	name: string,
	existingNames: string[],
): boolean {
	const trimmed = name.trim();
	return (
		trimmed !== "" &&
		existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())
	);
}

/** Version-pin error text shared by skills/mcp pin dialogs. */
export const VERSION_PIN_ERROR =
	"Letters, digits, . _ - / : @ + ^ ~ only, max 128.";

/** Empty string → undefined for optional Zod string fields. */
export function emptyToUndefined(value: string): string | undefined {
	const trimmed = value.trim();
	return trimmed === "" ? undefined : value;
}

export function trimOrUndefined(value: string): string | undefined {
	const trimmed = value.trim();
	return trimmed === "" ? undefined : trimmed;
}

/**
 * Minimal Zod form state: values + per-field errors + validate/handleSubmit.
 * Replaces the identical `useState<Values> + useState<errors> +
 * validate() via safeParse + handleSubmit(preventDefault…)` triplets in
 * TaskForm/ProjectForm and the `set(key, value)` helpers in
 * registry dialogs.
 */
export function useZodForm<TValues extends object>(initial: TValues) {
	const [values, setValues] = useState<TValues>(initial);
	const [errors, setErrors] = useState<Partial<Record<keyof TValues, string>>>(
		{},
	);

	function set<K extends keyof TValues>(key: K, value: TValues[K]) {
		setValues((s) => ({ ...s, [key]: value }));
	}

	function update(patch: Partial<TValues>) {
		setValues((s) => ({ ...s, ...patch }));
	}

	function validateWith(
		schema: z.ZodTypeAny,
		toInput: (values: TValues) => unknown,
	): boolean {
		const result = schema.safeParse(toInput(values));
		if (!result.success) {
			setErrors(
				fieldErrors(result.error) as Partial<Record<keyof TValues, string>>,
			);
			return false;
		}
		setErrors({});
		return true;
	}

	async function submitWith(
		event: { preventDefault: () => void },
		schema: z.ZodTypeAny,
		toInput: (values: TValues) => unknown,
		onValid: (values: TValues) => Promise<void> | void,
	): Promise<boolean> {
		event.preventDefault();
		if (!validateWith(schema, toInput)) {
			return false;
		}
		await onValid(values);
		return true;
	}

	return {
		errors,
		set,
		setErrors,
		setValues,
		submitWith,
		update,
		validateWith,
		values,
	};
}
