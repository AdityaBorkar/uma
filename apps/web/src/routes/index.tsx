import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert.tsx";
import { Button } from "#/components/ui/button.tsx";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "#/components/ui/card.tsx";
import { Skeleton } from "#/components/ui/skeleton.tsx";
import { authClient } from "#/lib/auth/client.ts";

export const Route = createFileRoute("/")({
	component: LoginPage,
	validateSearch: (
		search: Record<string, unknown>,
	): { redirect: string; error?: string } => ({
		error: typeof search.error === "string" ? search.error : undefined,
		redirect:
			typeof search.redirect === "string" && search.redirect.length > 0
				? search.redirect
				: "/settings/projects",
	}),
});

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
			<path
				d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
				fill="#4285F4"
			/>
			<path
				d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
				fill="#34A853"
			/>
			<path
				d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
				fill="#FBBC05"
			/>
			<path
				d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
				fill="#EA4335"
			/>
		</svg>
	);
}

function LoginPage() {
	const { redirect, error: searchError } = useSearch({ from: "/" });
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();
	const [isSigningIn, setIsSigningIn] = useState(false);
	const [error, setError] = useState<string | null>(searchError ?? null);

	useEffect(() => {
		if (!isPending && session?.user) {
			void navigate({ to: redirect });
		}
	}, [isPending, session, redirect, navigate]);

	const handleGoogleSignIn = async () => {
		setIsSigningIn(true);
		setError(null);
		try {
			await authClient.signIn.social({
				callbackURL: redirect,
				provider: "google",
			});
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to sign in with Google",
			);
			setIsSigningIn(false);
		}
	};

	return (
		<div className="mx-auto flex min-h-[calc(100vh-49px)] max-w-md flex-col justify-center px-4 py-10">
			<div className="mb-6 flex flex-col items-center text-center">
				<span className="flex h-10 w-10 items-center justify-center rounded-full border bg-muted font-semibold text-sm">
					P
				</span>
				<h1 className="mt-4 font-semibold text-2xl tracking-tight">
					Welcome back
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Sign in to continue to your workspace.
				</p>
			</div>

			<Card>
				<CardHeader className="border-b bg-muted/50 py-3">
					<CardTitle className="text-sm">Sign in</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-4 pt-4">
					{error ? (
						<Alert variant="destructive">
							<AlertTitle>Sign-in failed</AlertTitle>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					) : null}

					{isPending ? (
						<Skeleton className="h-8 w-full rounded-md" />
					) : session?.user ? (
						<>
							<p className="text-muted-foreground text-sm">
								Signed in as{" "}
								<span className="font-medium text-foreground">
									{session.user.email}
								</span>
							</p>
							<Button
								onClick={() => void navigate({ to: redirect })}
								variant="primary"
							>
								Continue to app
							</Button>
						</>
					) : (
						<>
							<Button
								className="h-8 w-full font-medium"
								disabled={isSigningIn}
								onClick={handleGoogleSignIn}
								type="button"
								variant="outline"
							>
								<GoogleIcon className="size-4.25 shrink-0" />
								{isSigningIn ? "Redirecting…" : "Continue with Google"}
							</Button>
							<p className="text-muted-foreground text-xs leading-relaxed">
								By continuing, you agree to our Terms and Privacy Policy.
							</p>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
