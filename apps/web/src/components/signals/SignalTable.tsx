import { severityBadgeClass } from "#/components/badges.ts";
import { ExternalLink } from "#/components/icons.tsx";
import { Badge } from "#/components/ui/badge.tsx";
import { Button } from "#/components/ui/button.tsx";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table.tsx";
import { formatAgo } from "#/lib/age.ts";

interface SignalRow {
	body: string | null;
	createdAt: string | Date;
	id: string;
	projectId: string | null;
	projectName: string | null;
	severity: "info" | "warning" | "critical";
	source: string;
	status: "new" | "triaged" | "dismissed";
	title: string;
	url: string | null;
}

interface Props {
	isTaskPending: boolean;
	isUpdatePending: boolean;
	items: SignalRow[];
	onCreateTask: (s: SignalRow) => void;
	onDismiss: (s: SignalRow) => void;
	onTriage: (s: SignalRow) => void;
}

export function SignalTable({
	items,
	onCreateTask,
	onDismiss,
	onTriage,
	isTaskPending,
	isUpdatePending,
}: Props) {
	return (
		<Table>
			<TableHeader>
				<TableRow className="bg-muted/50 hover:bg-muted/50">
					<TableHead className="w-24 text-xs">Severity</TableHead>
					<TableHead className="text-xs">Signal</TableHead>
					<TableHead className="w-36 text-xs">Project</TableHead>
					<TableHead className="w-24 text-xs">Status</TableHead>
					<TableHead className="w-20 text-xs">Age</TableHead>
					<TableHead className="w-56 text-right text-xs">Actions</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{items.map((s) => (
					<TableRow key={s.id}>
						<TableCell>
							<Badge
								className={severityBadgeClass(s.severity)}
								variant={
									s.severity === "critical" ? "destructive" : "secondary"
								}
							>
								{s.severity}
							</Badge>
						</TableCell>
						<TableCell>
							<div className="flex items-center gap-2 font-medium text-sm">
								<span className="truncate">{s.title}</span>
								{s.url ? (
									<a
										aria-label="Open external link"
										className="shrink-0 text-muted-foreground hover:text-foreground"
										href={s.url}
										rel="noreferrer"
										target="_blank"
									>
										<ExternalLink className="size-4" />
									</a>
								) : null}
							</div>
							{s.body ? (
								<p className="line-clamp-1 text-muted-foreground text-xs">
									{s.body}
								</p>
							) : null}
						</TableCell>
						<TableCell className="text-muted-foreground text-sm">
							{s.projectName ?? "—"}
						</TableCell>
						<TableCell>
							<Badge variant={s.status === "new" ? "default" : "secondary"}>
								{s.status}
							</Badge>
						</TableCell>
						<TableCell className="text-muted-foreground text-sm">
							{formatAgo(s.createdAt)}
						</TableCell>
						<TableCell className="text-right">
							<div className="flex justify-end gap-1">
								{s.status === "dismissed" ? null : (
									<Button
										disabled={isTaskPending}
										onClick={() => onCreateTask(s)}
										size="sm"
										variant="outline"
									>
										Task
									</Button>
								)}
								{s.status === "new" ? (
									<>
										<Button
											disabled={isUpdatePending}
											onClick={() => onTriage(s)}
											size="sm"
											variant="outline"
										>
											Triage
										</Button>
										<Button
											disabled={isUpdatePending}
											onClick={() => onDismiss(s)}
											size="sm"
											variant="ghost"
										>
											Dismiss
										</Button>
									</>
								) : null}
							</div>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

export type { SignalRow };
