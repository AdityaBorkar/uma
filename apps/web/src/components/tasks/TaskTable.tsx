import {
	DataTable,
	DataTableAction,
	DataTableActionsCell,
	DataTableAgoCell,
	DataTableBody,
	DataTableHead,
	DataTableHeader,
	DataTableMetaCell,
	DataTableTitleCell,
	fallbackText,
} from "#/components/data/DataTable.tsx";
import { TaskStatusBadge } from "#/components/data/StatusBadge.tsx";
import { TableCell, TableRow } from "#/components/ui/table.tsx";
import { formatDuration } from "#/lib/age.ts";

interface TaskRow {
	agent: string;
	finishedAt: string | Date | null;
	id: string;
	projectId: string | null;
	projectName: string | null;
	queuedAt: string | Date;
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
		<DataTable>
			<DataTableHeader>
				<DataTableHead className="w-24 text-xs">Status</DataTableHead>
				<DataTableHead className="text-xs">Task</DataTableHead>
				<DataTableHead className="w-32 text-xs">Project</DataTableHead>
				<DataTableHead className="w-24 text-xs">Queued</DataTableHead>
				<DataTableHead className="w-24 text-xs">Duration</DataTableHead>
				<DataTableHead className="w-40 text-xs" right={true}>
					Actions
				</DataTableHead>
			</DataTableHeader>
			<DataTableBody>
				{items.map((t) => (
					<TableRow key={t.id}>
						<TableCell>
							<TaskStatusBadge status={t.status} />
						</TableCell>
						<DataTableTitleCell
							subtitle={`agent: ${t.agent}`}
							title={t.title}
						/>
						<DataTableMetaCell>{fallbackText(t.projectName)}</DataTableMetaCell>
						<DataTableAgoCell value={t.queuedAt} />
						<DataTableMetaCell>{durationLabel(t)}</DataTableMetaCell>
						<DataTableActionsCell>
							{t.status === "queued" ? (
								<>
									<DataTableAction
										disabled={isPending}
										onClick={() => onStatusChange(t.id, "running")}
									>
										Start
									</DataTableAction>
									<DataTableAction
										disabled={isPending}
										onClick={() => onStatusChange(t.id, "cancelled")}
										variant="ghost"
									>
										Cancel
									</DataTableAction>
								</>
							) : null}
							{t.status === "running" ? (
								<DataTableAction
									disabled={isPending}
									onClick={() => onStatusChange(t.id, "cancelled")}
									variant="ghost"
								>
									Cancel
								</DataTableAction>
							) : null}
							{t.status === "failed" ? (
								<DataTableAction
									disabled={isPending}
									onClick={() => onStatusChange(t.id, "queued")}
								>
									Retry
								</DataTableAction>
							) : null}
						</DataTableActionsCell>
					</TableRow>
				))}
			</DataTableBody>
		</DataTable>
	);
}

export type { TaskRow };
