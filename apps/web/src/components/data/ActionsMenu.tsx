import { Menu } from "@base-ui/react/menu";
import type { ReactNode } from "react";

import { MoreHorizontal } from "#/components/icons.tsx";
import { cn } from "#/lib/utils.ts";

/**
 * Shared overflow actions menu. Extracted from model-providers
 * RowActions/ProviderActions/AccountActions which triplicated the same
 * Menu Trigger/Portal/Positioner/Popup shell and `menuItemClass`.
 */
export const actionsMenuItemClass =
	"flex w-full cursor-default items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-sm outline-none select-none data-highlighted:bg-muted data-highlighted:text-foreground data-disabled:opacity-50";

export function ActionsMenu({
	children,
	label,
}: {
	children: ReactNode;
	label: string;
}) {
	return (
		<Menu.Root>
			<Menu.Trigger
				aria-label={label}
				className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 data-[popup-open]:bg-muted data-[popup-open]:text-foreground"
			>
				<MoreHorizontal className="size-4" />
			</Menu.Trigger>
			<Menu.Portal>
				<Menu.Positioner
					align="end"
					className="z-50 outline-none select-none"
					side="bottom"
					sideOffset={4}
				>
					<Menu.Popup className="min-w-40 rounded-md border border-popover bg-popover p-1 text-popover-foreground outline-none">
						{children}
					</Menu.Popup>
				</Menu.Positioner>
			</Menu.Portal>
		</Menu.Root>
	);
}

export function ActionsMenuItem({
	children,
	danger,
	disabled,
	onClick,
}: {
	children: ReactNode;
	danger?: boolean | undefined;
	disabled?: boolean | undefined;
	onClick: () => void;
}) {
	return (
		<Menu.Item
			className={cn(
				actionsMenuItemClass,
				danger && "text-destructive data-highlighted:text-destructive",
			)}
			disabled={disabled}
			onClick={onClick}
		>
			{children}
		</Menu.Item>
	);
}
