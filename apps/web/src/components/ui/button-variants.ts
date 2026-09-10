import { cva } from "class-variance-authority";

export const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
	{
		defaultVariants: {
			size: "default",
			variant: "default",
		},
		variants: {
			size: {
				default: "h-8 px-4 py-1.5 has-[>svg]:px-3 text-[14px]",
				icon: "size-8",
				"icon-lg": "size-9",
				"icon-sm": "size-7",
				lg: "h-8 px-4 has-[>svg]:px-3 text-[14px]",
				sm: "h-7 rounded-md gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
			},
			variant: {
				default:
					"border bg-secondary text-secondary-foreground hover:bg-secondary/80 border-border shadow-none",
				destructive:
					"bg-destructive text-destructive-foreground hover:bg-destructive/90 border border-transparent shadow-none focus-visible:ring-destructive/20",
				ghost:
					"hover:bg-accent hover:text-accent-foreground border border-transparent",
				link: "text-[var(--color-accent-fg)] underline-offset-4 hover:underline border border-transparent",
				outline:
					"border border-border bg-background hover:bg-muted text-foreground shadow-none",
				primary:
					"bg-primary text-primary-foreground hover:bg-primary/90 border border-transparent shadow-none",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent",
			},
		},
	},
);
