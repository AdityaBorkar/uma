import { cva } from "class-variance-authority";

export const badgeVariants = cva(
	"inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-3 aria-invalid:ring-destructive/20 aria-invalid:border-destructive transition-colors overflow-hidden",
	{
		defaultVariants: {
			variant: "default",
		},
		variants: {
			variant: {
				attention: "border-attention-fg/30 bg-attention-bg text-attention-fg",
				danger: "border-danger-fg/30 bg-danger-bg text-danger-fg",
				default:
					"border-border bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
				destructive:
					"border-transparent bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90",
				done: "border-border bg-muted text-muted-foreground",
				info: "border-border bg-muted text-muted-foreground",
				outline:
					"text-foreground border-border bg-background [a&]:hover:bg-muted [a&]:hover:text-accent-foreground",
				secondary:
					"border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
				success: "border-success-border/30 bg-success-bg text-success-fg",
				warning: "border-attention-fg/30 bg-attention-bg text-attention-fg",
			},
		},
	},
);
