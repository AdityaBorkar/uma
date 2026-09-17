import {
	DataTable,
	DataTableAction,
	DataTableActionsCell,
	DataTableAgoCell,
	DataTableBody,
	DataTableHead,
	DataTableHeader,
	DataTableMetaCell,
	fallbackText,
} from "#/components/data/DataTable.tsx";
import { SeverityBadge } from "#/components/data/StatusBadge.tsx";
import { ExternalLink } from "#/components/icons.tsx";
import { Badge } from "#/components/ui/badge.tsx";
import { TableCell, TableRow } from "#/components/ui/table.tsx";

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
		<DataTable>
			<DataTableHeader>
				<DataTableHead className="w-24 text-xs">Severity</DataTableHead>
				<DataTableHead className="text-xs">Signal</DataTableHead>
				<DataTableHead className="w-36 text-xs">Project</DataTableHead>
				<DataTableHead className="w-24 text-xs">Status</DataTableHead>
				<DataTableHead className="w-20 text-xs">Age</DataTableHead>
				<DataTableHead className="w-56 text-xs" right={true}>
					Actions
				</DataTableHead>
			</DataTableHeader>
			<DataTableBody>
				{items.map((s) => (
					<TableRow key={s.id}>
						<TableCell>
							<SeverityBadge severity={s.severity} />
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
						<DataTableMetaCell>{fallbackText(s.projectName)}</DataTableMetaCell>
						<TableCell>
							<Badge variant={s.status === "new" ? "default" : "secondary"}>
								{s.status}
							</Badge>
						</TableCell>
						<DataTableAgoCell value={s.createdAt} />
						<DataTableActionsCell>
							{s.status === "dismissed" ? null : (
								<DataTableAction
									disabled={isTaskPending}
									onClick={() => onCreateTask(s)}
								>
									Task
								</DataTableAction>
							)}
							{s.status === "new" ? (
								<>
									<DataTableAction
										disabled={isUpdatePending}
										onClick={() => onTriage(s)}
									>
										Triage
									</DataTableAction>
									<DataTableAction
										disabled={isUpdatePending}
										onClick={() => onDismiss(s)}
										variant="ghost"
									>
										Dismiss
									</DataTableAction>
								</>
							) : null}
						</DataTableActionsCell>
					</TableRow>
				))}
			</DataTableBody>
		</DataTable>
	);
}

export type { SignalRow };
