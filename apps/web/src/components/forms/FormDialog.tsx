import type { ReactNode } from "react";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog.tsx";
import { cn } from "#/lib/utils.ts";

/**
 * Standard dialog shell: Dialog > DialogContent (p-0) > DialogHeader
 * (px-4 py-3) > scrollable body (dialog-body px-4 py-4).
 * Unifies tasks/signals dialogs (previously missing padding/scroll) with
 * AppShell CreateProjectDialog and all settings registry dialogs.
 */
export function FormDialog({
	children,
	description,
	maxWidth = "md",
	onClose,
	onOpenChange,
	open,
	title,
}: {
	children: ReactNode;
	description?: ReactNode | undefined;
	maxWidth?: "md" | "lg" | "xl" | undefined;
	onClose: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: ReactNode;
}) {
	return (
		<Dialog
			onOpenChange={(next) => {
				if (!next) {
					onClose();
				} else {
					onOpenChange(next);
				}
			}}
			open={open}
		>
			<DialogContent
				className={cn(
					"p-0",
					maxWidth === "lg" && "max-w-2xl",
					maxWidth === "xl" && "max-w-3xl",
				)}
				onClose={onClose}
			>
				<DialogHeader className="px-4 py-3">
					<DialogTitle>{title}</DialogTitle>
					{description ? (
						<DialogDescription>{description}</DialogDescription>
					) : null}
				</DialogHeader>
				<div className="dialog-body space-y-4 overflow-y-auto px-4 py-4">
					{children}
				</div>
			</DialogContent>
		</Dialog>
	);
}
