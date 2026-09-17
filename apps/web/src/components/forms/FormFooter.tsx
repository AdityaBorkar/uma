import { Button } from "#/components/ui/button.tsx";

/**
 * Standard form footer: Cancel (outline/ghost) + Submit.
 * Unifies TaskForm/SignalForm/ProjectForm (`flex justify-end gap-2 pt-2`,
 * `loading ? "Saving…"`) with registry dialogs (`size="sm"`,
 * ghost Cancel + primary Save).
 */
export function FormFooter({
	cancelLabel = "Cancel",
	cancelVariant = "outline",
	loading,
	onCancel,
	pendingLabel = "Saving…",
	size,
	submitLabel,
	submitVariant,
}: {
	cancelLabel?: string | undefined;
	cancelVariant?: "outline" | "ghost" | undefined;
	loading?: boolean | undefined;
	onCancel?: (() => void) | undefined;
	pendingLabel?: string | undefined;
	size?: "sm" | undefined;
	submitLabel: string;
	submitVariant?: "primary" | undefined;
}) {
	return (
		<div className="flex justify-end gap-2 pt-2">
			{onCancel ? (
				<Button
					onClick={onCancel}
					size={size}
					type="button"
					variant={cancelVariant}
				>
					{cancelLabel}
				</Button>
			) : null}
			<Button
				disabled={Boolean(loading)}
				size={size}
				type="submit"
				variant={submitVariant}
			>
				{loading ? pendingLabel : submitLabel}
			</Button>
		</div>
	);
}

/** Registry-dialog footer variant (buttons are type="button", size sm). */
export function DialogFooter({
	cancelVariant = "ghost",
	disabled,
	onCancel,
	onSave,
	pending,
	pendingLabel = "Saving…",
	saveLabel,
}: {
	cancelVariant?: "ghost" | "outline" | undefined;
	disabled?: boolean | undefined;
	onCancel: () => void;
	onSave: () => void;
	pending?: boolean | undefined;
	pendingLabel?: string | undefined;
	saveLabel: string;
}) {
	return (
		<div className="flex items-center justify-end gap-2">
			<Button
				onClick={onCancel}
				size="sm"
				type="button"
				variant={cancelVariant}
			>
				Cancel
			</Button>
			<Button
				disabled={disabled ?? Boolean(pending)}
				onClick={onSave}
				size="sm"
				type="button"
				variant="primary"
			>
				{pending ? pendingLabel : saveLabel}
			</Button>
		</div>
	);
}

export function submitText(
	loading: boolean | undefined,
	label: string,
): string {
	return loading ? "Saving…" : label;
}
