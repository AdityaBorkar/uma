import { taskBadgeClass } from "#/components/badges.ts";
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
import { formatAgo, formatDuration } from "#/lib/age.ts";

interface TaskRow {
	agent: string;
	finishedAt: string | Date | null;
	id: string;
	projectId: string | null;
	projectName: string | null;
	queuedAt: string | Date;
	signalId: string | null;
	signalTitle: string | null;
	startedAt: string | Date | null;
	status: "queued" | "running" | "completed" | "failed" | "cancelled";
	title: string;
}

function durationLabel(t: TaskRow): string {
	if (!t.startedAt) {
		return "—";
	}
	if (t.finishedAt) {
		return formatDuration(t.startedAt, t.finishedAt);
	}
	if (t.status === "running") {
		return formatDuration(t.startedAt, new Date());
	}
	return "—";
}

interface Props {
	isPending: boolean;
	items: TaskRow[];
	onStatusChange: (id: string, status: TaskRow["status"]) => void;
}

export function TaskTable({ items, onStatusChange, isPending }: Props) {
	return (
		<Table>
			<TableHeader>
				<TableRow className="bg-muted/50 hover:bg-muted/50">
					<TableHead className="w-24 text-xs">Status</TableHead>
					<TableHead className="text-xs">Task</TableHead>
					<TableHead className="w-28 text-xs">Origin</TableHead>
					<TableHead className="w-32 text-xs">Project</TableHead>
					<TableHead className="w-24 text-xs">Queued</TableHead>
					<TableHead className="w-24 text-xs">Duration</TableHead>
					<TableHead className="w-40 text-right text-xs">Actions</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{items.map((t) => (
					<TableRow key={t.id}>
						<TableCell>
							<Badge
								className={taskBadgeClass(t.status)}
								variant={t.status === "failed" ? "destructive" : "secondary"}
							>
								{t.status}
							</Badge>
						</TableCell>
						<TableCell>
							<div className="font-medium text-sm">{t.title}</div>
							<p className="text-muted-foreground text-xs">agent: {t.agent}</p>
						</TableCell>
						<TableCell className="text-muted-foreground text-sm">
							{t.signalId ? (
								<span className="truncate" title={t.signalTitle ?? ""}>
									signal
								</span>
							) : (
								"direct"
							)}
						</TableCell>
						<TableCell className="text-muted-foreground text-sm">
							{t.projectName ?? "—"}
						</TableCell>
						<TableCell className="text-muted-foreground text-sm">
							{formatAgo(t.queuedAt)}
						</TableCell>
						<TableCell className="text-muted-foreground text-sm">
							{durationLabel(t)}
						</TableCell>
						<TableCell className="text-right">
							<div className="flex justify-end gap-1">
								{t.status === "queued" ? (
									<>
										<Button
											disabled={isPending}
											onClick={() => onStatusChange(t.id, "running")}
											size="sm"
											variant="outline"
										>
											Start
										</Button>
										<Button
											disabled={isPending}
											onClick={() => onStatusChange(t.id, "cancelled")}
											size="sm"
											variant="ghost"
										>
											Cancel
										</Button>
									</>
								) : null}
								{t.status === "running" ? (
									<Button
										disabled={isPending}
										onClick={() => onStatusChange(t.id, "cancelled")}
										size="sm"
										variant="ghost"
									>
										Cancel
									</Button>
								) : null}
								{t.status === "failed" ? (
									<Button
										disabled={isPending}
										onClick={() => onStatusChange(t.id, "queued")}
										size="sm"
										variant="outline"
									>
										Retry
									</Button>
								) : null}
							</div>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

export type { TaskRow };
