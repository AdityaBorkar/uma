import { createFileRoute } from "@tanstack/react-router";

import { Badge } from "#/components/ui/badge.tsx";
import { Card } from "#/components/ui/card.tsx";

export const Route = createFileRoute("/(app)/settings/version-source")({
	component: VersionSourcePage,
});

const VERSION_CONTROL = [
	{
		description: "Distributed version control system.",
		initial: "G",
		name: "Git",
		status: "supported",
	},
	{
		description: "Capable, Git-compatible version control system.",
		initial: "J",
		name: "Jujutsu",
		status: "supported",
	},
] as const;

const SOURCE_CONTROL = [
	{
		description: "Git hosting and collaboration platform.",
		initial: "G",
		name: "GitHub",
		status: "supported",
	},
	{
		description: "DevOps platform with built-in Git hosting.",
		initial: "L",
		name: "GitLab",
		status: "supported",
	},
] as const;

function SystemRow({
	initial,
	description,
	name,
	status,
}: {
	description: string;
	initial: string;
	name: string;
	status: string;
}) {
	return (
		<div className="flex flex-col gap-2 border-b px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex min-w-0 items-center gap-3">
				<span
					aria-hidden={true}
					className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted font-semibold text-sm"
				>
					{initial}
				</span>
				<div className="min-w-0">
					<p className="font-semibold text-sm">{name}</p>
					<p className="text-muted-foreground text-sm">{description}</p>
				</div>
			</div>
			<Badge className="shrink-0 self-start sm:self-center" variant="success">
				{status}
			</Badge>
		</div>
	);
}

function VersionSourcePage() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-semibold text-2xl tracking-tight">
					Version-Source
				</h1>
				<p className="text-muted-foreground text-sm">
					Version control systems and source hosting for your projects.
				</p>
			</div>

			<section className="space-y-3">
				<h2 className="font-semibold text-sm">Version Control</h2>
				<Card className="overflow-hidden p-0">
					<div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2 text-xs">
						<span className="font-semibold">
							{VERSION_CONTROL.length} systems
						</span>
					</div>
					<div>
						{VERSION_CONTROL.map((s) => (
							<SystemRow
								description={s.description}
								initial={s.initial}
								key={s.name}
								name={s.name}
								status={s.status}
							/>
						))}
					</div>
				</Card>
			</section>

			<section className="space-y-3">
				<h2 className="font-semibold text-sm">Source Control</h2>
				<Card className="overflow-hidden p-0">
					<div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2 text-xs">
						<span className="font-semibold">{SOURCE_CONTROL.length} hosts</span>
					</div>
					<div>
						{SOURCE_CONTROL.map((s) => (
							<SystemRow
								description={s.description}
								initial={s.initial}
								key={s.name}
								name={s.name}
								status={s.status}
							/>
						))}
					</div>
				</Card>
			</section>
		</div>
	);
}
