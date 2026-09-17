import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Alert } from "#/components/ui/alert.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Card, CardContent } from "#/components/ui/card.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Label } from "#/components/ui/label.tsx";
import { rpc } from "#/lib/rpc.ts";

/**
 * `/device` — browser approval for device-code enrollment. The CLI prints a
 * `user_code` plus this URL; the logged-in user confirms (or denies) it here,
 * which pre-creates the enrolled machine row via the control plane
 * (`device.approve`).
 */
export const Route = createFileRoute("/(app)/device")({
	component: DevicePage,
	head: () => ({
		meta: [
			{ title: "Connect a machine — Planner" },
			{
				content:
					"Approve a device code to connect a machine that runs agents on your behalf.",
				name: "description",
			},
		],
	}),
	validateSearch: (search: Record<string, unknown>): { code?: string } =>
		typeof search.code === "string" ? { code: search.code } : {},
});

function DevicePage() {
	const { code } = Route.useSearch();
	const [userCode, setUserCode] = useState(code ?? "");
	const [notice, setNotice] = useState<string | null>(null);

	const approveMut = useMutation(
		rpc.device.approve.mutationOptions({
			onSuccess: (_data, variables) => {
				setNotice(
					variables.approve
						? "Machine approved — it can now connect."
						: "Enrollment denied.",
				);
			},
		}),
	);

	async function submit(approve: boolean) {
		setNotice(null);
		try {
			await approveMut.mutateAsync({
				approve,
				user_code: userCode.trim(),
			});
		} catch {
			// Error surfaces via approveMut.error below.
		}
	}

	return (
		<div className="mx-auto max-w-lg space-y-4 py-6">
			<div>
				<h1 className="font-semibold text-2xl tracking-tight">
					Connect a machine
				</h1>
				<p className="text-muted-foreground text-sm">
					Run <code className="font-mono text-xs">uma-machine enroll</code> on
					your device, then enter the code it shows.
				</p>
			</div>

			<Card className="overflow-hidden p-0">
				<CardContent className="space-y-3 py-4">
					<div className="space-y-1.5">
						<Label className="font-semibold text-xs" htmlFor="user-code">
							Device code
						</Label>
						<Input
							className="font-mono"
							id="user-code"
							onChange={(e) => setUserCode(e.target.value)}
							placeholder="XXXX-XXXX"
							value={userCode}
						/>
					</div>
					{approveMut.error ? (
						<Alert variant="destructive">
							{approveMut.error instanceof Error
								? approveMut.error.message
								: "Approval failed"}
						</Alert>
					) : null}
					{notice ? <Alert>{notice}</Alert> : null}
					<div className="flex gap-2">
						<Button
							disabled={approveMut.isPending || userCode.trim().length === 0}
							onClick={() => void submit(true)}
							type="button"
							variant="primary"
						>
							Approve
						</Button>
						<Button
							disabled={approveMut.isPending || userCode.trim().length === 0}
							onClick={() => void submit(false)}
							type="button"
							variant="outline"
						>
							Deny
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
