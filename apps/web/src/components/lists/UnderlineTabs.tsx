import { cn } from "#/lib/utils.ts";

export interface UnderlineTab {
	label: string;
	value: string | undefined;
}

/**
 * Button-based underline tabs sharing UnderlineNav's active styling
 * (`border-[#fd8c73] font-semibold`). Extracted from
 * documents/index.tsx kind tabs so future tab rows reuse one style.
 */
export function UnderlineTabs({
	activeValue,
	onSelect,
	tabs,
}: {
	activeValue: string | undefined;
	onSelect: (value: string | undefined) => void;
	tabs: UnderlineTab[];
}) {
	return (
		<nav className="flex items-center gap-1 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
			{tabs.map((t) => {
				const active =
					t.value === undefined
						? activeValue === undefined
						: activeValue === t.value;
				return (
					<button
						className={cn(
							"shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm",
							active
								? "border-[#fd8c73] font-semibold text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground",
						)}
						key={t.value ?? "__all"}
						onClick={() => onSelect(t.value)}
						type="button"
					>
						{t.label}
					</button>
				);
			})}
		</nav>
	);
}
