import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { Check, LogOut, Plus, X } from "#/components/icons.tsx";
import {
	ListErrorAlert,
	ListLoadingCard,
	PageHeader,
} from "#/components/lists/shared.tsx";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "#/components/ui/avatar.tsx";
import { Badge } from "#/components/ui/badge.tsx";
import { Button } from "#/components/ui/button.tsx";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "#/components/ui/card.tsx";
import { authClient } from "#/lib/auth/client.ts";

export const Route = createFileRoute("/(app)/settings/account")({
	component: AccountPage,
	head: () => ({
		meta: [
			{ title: "Account — Planner" },
			{
				content: "Manage your profile and sign out.",
				name: "description",
			},
		],
	}),
});

type DeviceAccount = {
	session: { token: string };
	user: {
		id: string;
		name: string;
		email: string;
		image?: string | null;
	};
};

function AccountPage() {
	const { data: session } = authClient.useSession();
	const user = session?.user;
	const navigate = useNavigate();

	async function handleSignOut() {
		await authClient.signOut();
		void navigate({ search: { redirect: "/settings/projects" }, to: "/" });
	}

	return (
		<div className="space-y-6">
			<PageHeader
				description="Manage your account and profile."
				title="Account"
			/>

			<Card className="overflow-hidden rounded-md border">
				<CardHeader className="border-b bg-muted/50">
					<CardTitle className="font-semibold text-sm">Profile</CardTitle>
				</CardHeader>
				<CardContent className="flex items-center gap-4 py-4">
					<Avatar className="h-12 w-12 border">
						{user?.image ? (
							<AvatarImage alt={user.name ?? "User"} src={user.image} />
						) : null}
						<AvatarFallback>
							{user?.name?.charAt(0).toUpperCase() ??
								user?.email?.charAt(0).toUpperCase() ??
								"U"}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0">
						<p className="font-semibold text-sm">
							{user?.name ?? "Unnamed user"}
						</p>
						<p className="truncate text-muted-foreground text-sm">
							{user?.email ?? "No email"}
						</p>
						{user?.id ? (
							<p className="mt-1 text-muted-foreground text-xs">
								ID: {user.id}
							</p>
						) : null}
					</div>
				</CardContent>
			</Card>

			<SignedInAccounts activeUserId={user?.id} />

			<Card className="overflow-hidden rounded-md border">
				<CardHeader className="border-b bg-muted/50">
					<CardTitle className="font-semibold text-sm">Session</CardTitle>
				</CardHeader>
				<CardContent className="flex items-center justify-between gap-4 py-4">
					<div className="min-w-0">
						<p className="font-semibold text-sm">Sign out</p>
						<p className="text-muted-foreground text-sm">
							End this session and return to the sign-in page. Your projects and
							documents stay saved.
						</p>
					</div>
					<Button
						className="shrink-0"
						onClick={() => void handleSignOut()}
						type="button"
						variant="outline"
					>
						<LogOut className="size-4.25" />
						Sign out
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}

function SignedInAccounts({
	activeUserId,
}: {
	activeUserId: string | undefined;
}) {
	const [accounts, setAccounts] = useState<DeviceAccount[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pendingToken, setPendingToken] = useState<string | null>(null);
	const [isAdding, setIsAdding] = useState(false);

	const load = useCallback(async () => {
		setError(null);
		const res = await authClient.multiSession.listDeviceSessions();
		if (res.error) {
			setError(res.error.message ?? "Couldn't load signed-in accounts.");
			setAccounts([]);
			return;
		}
		setAccounts((res.data ?? []) as DeviceAccount[]);
	}, []);

	useEffect(() => {
		void load();
	}, [load, activeUserId]);

	async function handleSwitch(sessionToken: string) {
		setPendingToken(sessionToken);
		setError(null);
		const res = await authClient.multiSession.setActive({ sessionToken });
		setPendingToken(null);
		if (res.error) {
			setError(res.error.message ?? "Couldn't switch accounts.");
			return;
		}
		await load();
	}

	async function handleRemove(sessionToken: string) {
		setPendingToken(sessionToken);
		setError(null);
		const res = await authClient.multiSession.revoke({ sessionToken });
		setPendingToken(null);
		if (res.error) {
			setError(res.error.message ?? "Couldn't remove this account.");
			return;
		}
		await load();
	}

	async function handleAddAccount() {
		setIsAdding(true);
		setError(null);
		try {
			await authClient.signIn.social({
				callbackURL: "/settings/account",
				provider: "google",
			});
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Couldn't start Google sign-in.",
			);
			setIsAdding(false);
		}
	}

	return (
		<Card className="overflow-hidden rounded-md border p-0">
			<CardHeader className="border-b bg-muted/50">
				<CardTitle className="font-semibold text-sm">
					Signed-in accounts{" "}
					{accounts ? (
						<span className="font-normal text-muted-foreground">
							· {accounts.length}
						</span>
					) : null}
				</CardTitle>
			</CardHeader>
			<CardContent className="p-0">
				{accounts === null ? (
					<div className="px-4 py-3">
						<ListLoadingCard label="Loading signed-in accounts…" />
					</div>
				) : accounts.length === 0 ? (
					<p className="px-4 py-6 text-center text-muted-foreground text-sm">
						No other accounts signed in on this device.
					</p>
				) : (
					<ul className="divide-y divide-border">
						{accounts.map(({ session, user }) => {
							const isActive = user.id === activeUserId;
							const isPending = pendingToken === session.token;
							return (
								<li
									className="flex items-center gap-3 px-4 py-3"
									key={session.token}
								>
									<Avatar className="h-9 w-9 border">
										{user.image ? (
											<AvatarImage alt={user.name} src={user.image} />
										) : null}
										<AvatarFallback>
											{user.name?.charAt(0).toUpperCase() ??
												user.email?.charAt(0).toUpperCase() ??
												"U"}
										</AvatarFallback>
									</Avatar>
									<div className="min-w-0 flex-1">
										<p className="flex items-center gap-2 truncate font-semibold text-sm">
											<span className="truncate">{user.name}</span>
											{isActive ? (
												<Badge className="shrink-0" variant="success">
													<Check className="size-3" />
													Active
												</Badge>
											) : null}
										</p>
										<p className="truncate text-muted-foreground text-sm">
											{user.email}
										</p>
									</div>
									{isActive ? null : (
										<div className="flex shrink-0 items-center gap-2">
											<Button
												disabled={isPending}
												onClick={() => void handleSwitch(session.token)}
												size="sm"
												type="button"
												variant="outline"
											>
												{isPending ? "Switching…" : "Switch"}
											</Button>
											<Button
												aria-label={`Remove ${user.email}`}
												disabled={isPending}
												onClick={() => void handleRemove(session.token)}
												size="icon-sm"
												title={`Remove ${user.email}`}
												type="button"
												variant="ghost"
											>
												<X className="size-4" />
											</Button>
										</div>
									)}
								</li>
							);
						})}
					</ul>
				)}
				{error ? (
					<div className="border-t px-4 py-3">
						<ListErrorAlert
							error={new Error(error)}
							onRetry={() => void load()}
							title="Accounts error"
						/>
					</div>
				) : null}
			</CardContent>
			<CardFooter className="justify-between">
				<p className="text-muted-foreground text-xs">
					Switch accounts on this device without signing out.
				</p>
				<Button
					disabled={isAdding}
					onClick={() => void handleAddAccount()}
					size="sm"
					type="button"
					variant="outline"
				>
					<Plus className="size-4" />
					{isAdding ? "Redirecting…" : "Add account"}
				</Button>
			</CardFooter>
		</Card>
	);
}
