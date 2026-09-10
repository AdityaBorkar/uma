import { Link } from "@tanstack/react-router";

export interface NavLinkItem {
	icon?: React.ComponentType<{ className?: string }>;
	label: string;
	to: string;
}

export interface NavDividerItem {
	id: string;
	type: "divider";
}

export type NavItem = NavLinkItem | NavDividerItem;

export function isNavDivider(item: NavItem): item is NavDividerItem {
	return "type" in item && item.type === "divider";
}

export function UnderlineNav({
	currentScope,
	items,
}: {
	currentScope?: string;
	items: readonly NavItem[];
}) {
	return (
		<nav
			aria-label="Primary"
			className="sticky top-14 z-30 w-full border-b bg-background"
		>
			<div className="mx-auto flex max-w-[1280px] items-center gap-1 overflow-x-auto px-2 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
				{items.map((item) => {
					if (isNavDivider(item)) {
						return (
							<span
								aria-hidden={true}
								className="mx-1 h-5 w-px shrink-0 self-center bg-border"
								key={item.id}
							/>
						);
					}
					const isScoped = item.to.startsWith("/$projectSlug");
					return (
						<Link
							activeProps={{
								className:
									"text-foreground border-b-[2px] border-[#fd8c73] font-semibold",
							}}
							className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-transparent border-b-2 px-3 py-3 text-muted-foreground text-sm hover:text-foreground"
							key={item.to}
							to={item.to}
							{...(isScoped && currentScope
								? { params: { projectSlug: currentScope } }
								: {})}
						>
							{item.icon ? <item.icon className="size-4.25" /> : null}
							{item.label}
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
