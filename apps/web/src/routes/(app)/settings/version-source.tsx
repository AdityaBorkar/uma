import { createFileRoute } from "@tanstack/react-router";

import {
	ListRow,
	ListRowActions,
	ListRowMain,
	ListRowSubtitle,
	ListRowTitle,
} from "#/components/lists/ListRow.tsx";
import { ListResultCard, PageHeader } from "#/components/lists/shared.tsx";
import { Badge } from "#/components/ui/badge.tsx";

export const Route = createFileRoute("/(app)/settings/version-source")({
	component: VersionSourcePage,
	head: () => ({
		meta: [
			{ title: "Version-Source — Planner" },
			{
				content: "Version control and source hosting for your projects.",
				name: "description",
			},
		],
	}),
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
		<ListRow>
			<ListRowMain>
				<div className="flex min-w-0 items-center gap-3">
					<span
						aria-hidden={true}
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted font-semibold text-sm"
					>
						{initial}
					</span>
					<div className="min-w-0">
						<ListRowTitle>{name}</ListRowTitle>
						<ListRowSubtitle>{description}</ListRowSubtitle>
					</div>
				</div>
			</ListRowMain>
			<ListRowActions>
				<Badge className="shrink-0 self-start sm:self-center" variant="success">
					{status}
				</Badge>
			</ListRowActions>
		</ListRow>
	);
}

function VersionSourcePage() {
	return (
		<div className="space-y-6">
			<PageHeader
				description="Version control systems and source hosting for your projects."
				title="Version-Source"
			/>

			<section className="space-y-3">
				<h2 className="font-semibold text-sm">Version Control</h2>
				<ListResultCard
					summary={
						<span className="font-semibold">
							{VERSION_CONTROL.length} systems
						</span>
					}
				>
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
				</ListResultCard>
			</section>

			<section className="space-y-3">
				<h2 className="font-semibold text-sm">Source Control</h2>
				<ListResultCard
					summary={
						<span className="font-semibold">{SOURCE_CONTROL.length} hosts</span>
					}
				>
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
				</ListResultCard>
			</section>
		</div>
	);
}
