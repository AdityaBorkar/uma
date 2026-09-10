import { createFileRoute } from "@tanstack/react-router";

import { MonitorSmartphone } from "#/components/icons.tsx";
import { Badge } from "#/components/ui/badge.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Card, CardContent } from "#/components/ui/card.tsx";

export const Route = createFileRoute("/(app)/settings/machines")({
	component: MachinesPage,
});

function MachinesPage() {
	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-semibold text-2xl tracking-tight">
						Remote Machines
					</h1>
					<p className="text-muted-foreground text-sm">
						Devices that can run agents on your behalf.
					</p>
				</div>
				<Button type="button" variant="primary">
					New machine
				</Button>
			</div>

			<Card className="overflow-hidden p-0">
				<div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2 text-xs">
					<span className="font-semibold">0 machines</span>
					<span className="text-muted-foreground">· all</span>
				</div>
				<CardContent className="flex flex-col items-center gap-2 py-10 text-center">
					<MonitorSmartphone className="h-8 w-8 text-muted-foreground" />
					<p className="font-semibold text-sm">No remote machines yet</p>
					<p className="max-w-md text-muted-foreground text-sm">
						Connect a device to run agents remotely. Each machine will show its
						name, connection state, and last heartbeat here.
					</p>
					<Badge variant="outline">name · state · last seen</Badge>
				</CardContent>
			</Card>
		</div>
	);
}
