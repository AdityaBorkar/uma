import { cva } from "class-variance-authority";

export const badgeVariants = cva(
	"inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive transition-colors overflow-hidden",
	{
		defaultVariants: {
			variant: "default",
		},
		variants: {
			variant: {
				attention:
					"border-[#9a6700]/30 bg-[#fff8c5] text-[#9a6700] dark:border-[#d29922]/30 dark:bg-[#1e1a0a] dark:text-[#d29922]",
				danger:
					"border-[#cf222e]/30 bg-[#ffebe9] text-[#cf222e] dark:border-[#f85149]/30 dark:bg-[#260f12] dark:text-[#f85149]",
				default:
					"border-border bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
				destructive:
					"border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90",
				done: "border-[#8250df]/30 bg-[#fbefff] text-[#8250df] dark:border-[#bc8cff]/30 dark:bg-[#1e1626] dark:text-[#bc8cff]",
				info: "border-border bg-muted text-muted-foreground",
				outline:
					"text-foreground border-border bg-background [a&]:hover:bg-muted [a&]:hover:text-accent-foreground",
				secondary:
					"border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
				success:
					"border-[#1a7f37]/30 bg-[#dafbe1] text-[#1a7f37] dark:border-[#2ea043]/30 dark:bg-[#12261e] dark:text-[#3fb950]",
				warning:
					"border-[#9a6700]/30 bg-[#fff8c5] text-[#9a6700] dark:border-[#d29922]/30 dark:bg-[#1e1a0a] dark:text-[#d29922]",
			},
		},
	},
);
