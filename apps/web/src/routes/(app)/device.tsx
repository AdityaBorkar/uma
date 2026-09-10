import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Alert } from "#/components/ui/alert.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Card, CardContent } from "#/components/ui/card.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Label } from "#/components/ui/label.tsx";
import { getAuthSession } from "#/lib/auth/server.ts";
import { approveDevice } from "#/lib/machines/service.ts";

/**
 * `/device` — browser approval for device-code enrollment. The CLI prints a
 * `user_code` plus this URL; the logged-in user confirms (or denies) it here,
 * which pre-creates the enrolled machine row.
 */
export const Route = createFileRoute("/(app)/device")({
	component: DevicePage,
	server: {
		handlers: {
			POST: async ({ request }) => {
				const session = await getAuthSession(request.headers);
				if (!session?.user) {
					return Response.json({ error: "unauthorized" }, { status: 401 });
				}
				const body = (await request.json().catch(() => ({}))) as {
					approve?: boolean;
					user_code?: string;
				};
				if (!body.user_code) {
					return Response.json(
						{ error: "user_code required" },
						{ status: 400 },
					);
				}
				const res = await approveDevice(
					session.user.id,
					body.user_code,
					body.approve !== false,
				).catch(() => null);
				if (res === null) {
					return Response.json({ error: "server_error" }, { status: 500 });
				}
				if (res === "unknown") {
					return Response.json({ error: "unknown user_code" }, { status: 404 });
				}
				if (res === "duplicate") {
					return Response.json(
						{ error: "a machine with this name already exists" },
						{ status: 409 },
					);
				}
				return Response.json({ ok: true });
			},
		},
	},
	validateSearch: (search: Record<string, unknown>): { code?: string } =>
		typeof search.code === "string" ? { code: search.code } : {},
});

function DevicePage() {
	const { code } = Route.useSearch();
	const [userCode, setUserCode] = useState(code ?? "");
	const [notice, setNotice] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function submit(approve: boolean) {
		setPending(true);
		setNotice(null);
		setError(null);
		try {
			const res = await fetch("/device", {
				body: JSON.stringify({ approve, user_code: userCode.trim() }),
				headers: { "content-type": "application/json" },
				method: "POST",
			});
			const data = (await res.json().catch(() => ({}))) as {
				error?: string;
			};
			if (!res.ok) {
				setError(data.error ?? "Approval failed");
				return;
			}
			setNotice(
				approve
					? "Machine approved — it can now connect."
					: "Enrollment denied.",
			);
		} finally {
			setPending(false);
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
					{error ? <Alert variant="destructive">{error}</Alert> : null}
					{notice ? <Alert>{notice}</Alert> : null}
					<div className="flex gap-2">
						<Button
							disabled={pending || userCode.trim().length === 0}
							onClick={() => void submit(true)}
							type="button"
							variant="primary"
						>
							Approve
						</Button>
						<Button
							disabled={pending || userCode.trim().length === 0}
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
