import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { LogOut } from "#/components/icons.tsx";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "#/components/ui/avatar.tsx";
import { Button } from "#/components/ui/button.tsx";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "#/components/ui/card.tsx";
import { authClient } from "#/lib/auth/client.ts";

export const Route = createFileRoute("/(app)/settings/account")({
	component: AccountPage,
});

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
			<div>
				<h1 className="font-semibold text-2xl">Account</h1>
				<p className="text-muted-foreground text-sm">
					Manage your account and profile.
				</p>
			</div>

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
