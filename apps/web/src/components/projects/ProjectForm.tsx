import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Label } from "#/components/ui/label.tsx";
import { Select } from "#/components/ui/select.tsx";
import { Skeleton } from "#/components/ui/skeleton.tsx";
import { Textarea } from "#/components/ui/textarea.tsx";
import { fieldErrors } from "#/lib/forms.ts";
import { rpc } from "#/lib/rpc.ts";
import { ProjectCreateInput } from "#/schemas/schema.ts";

interface GithubRepoOption {
	description: string | null;
	fullName: string;
	name: string;
	private: boolean;
}

interface Values {
	githubRepoFullName: string;
	name: string;
}

interface Props {
	defaultValues?: Partial<{
		description: string | null;
		githubRepoFullName: string | null;
		id: string;
		name: string;
	}>;
	loading?: boolean;
	onCancel?: () => void;
	onSubmit: (values: Values & { id?: string }) => Promise<void> | void;
	submitLabel?: string;
}

function isMissingConnectionError(error: unknown): boolean {
	const msg = error instanceof Error ? error.message : String(error ?? "");
	return (
		msg.toLowerCase().includes("github connection") ||
		msg.toLowerCase().includes("not connected") ||
		msg.toLowerCase().includes("reconnect github")
	);
}

export function ProjectForm({
	defaultValues,
	onSubmit,
	onCancel,
	submitLabel = "Save",
	loading,
}: Props) {
	const [repoFullName, setRepoFullName] = useState(
		defaultValues?.githubRepoFullName ?? "",
	);
	const [name, setName] = useState(defaultValues?.name ?? "");
	const [repoFilter, setRepoFilter] = useState("");
	const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>(
		{},
	);

	const connectionQuery = useQuery(
		rpc.connections.get.queryOptions({
			input: { provider: "github" },
		}),
	);
	const reposQuery = useQuery({
		...rpc.connections.githubRepos.queryOptions(),
		enabled: Boolean(
			connectionQuery.data && connectionQuery.data.status === "connected",
		),
	});

	const connectMut = useMutation(
		rpc.connections.getAuthUrl.mutationOptions({}),
	);

	const fetchedRepos: GithubRepoOption[] = useMemo(
		() => (reposQuery.data as GithubRepoOption[] | undefined) ?? [],
		[reposQuery.data],
	);

	// Keep the stored repo selectable even if it no longer appears in the
	// GitHub list (renamed, deleted, or revoked access) so edit never blanks.
	const repos: GithubRepoOption[] = useMemo(() => {
		const existing = defaultValues?.githubRepoFullName;
		if (
			existing &&
			!fetchedRepos.some((r) => r.fullName === existing)
		) {
			return [
				{
					description: defaultValues?.description ?? null,
					fullName: existing,
					name: existing.split('/')[1] ?? existing,
					private: false,
				},
				...fetchedRepos,
			];
		}
		return fetchedRepos;
	}, [fetchedRepos, defaultValues?.githubRepoFullName, defaultValues?.description]);

	const selectedRepo = useMemo(
		() => repos.find((r) => r.fullName === repoFullName) ?? null,
		[repos, repoFullName],
	);

	// Prefill the project name from the repo name on first selection. Once
	// the user edits the name manually we leave it alone.
	useEffect(() => {
		if (!selectedRepo) {
			return;
		}
		if (!name) {
			setName(selectedRepo.name);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- prefill only
	}, [selectedRepo?.fullName]);

	const filteredRepos = useMemo(() => {
		const q = repoFilter.trim().toLowerCase();
		if (!q) {
			return repos;
		}
		return repos.filter((r) => r.fullName.toLowerCase().includes(q));
	}, [repos, repoFilter]);

	const connectionMissing =
		connectionQuery.data === null ||
		(connectionQuery.data !== undefined &&
			connectionQuery.data.status !== "connected");
	const reposMissingConnection =
		reposQuery.isError && isMissingConnectionError(reposQuery.error);

	function handleConnect() {
		connectMut.mutate(
			{ provider: "github" },
			{
				onSuccess: (data) => {
					window.location.href = data.url;
				},
			},
		);
	}

	/** Validation is the canonical Zod schema — no duplicated rules here. */
	function validate(): boolean {
		const result = ProjectCreateInput.safeParse({
			githubRepoFullName: repoFullName || undefined,
			name,
		});
		if (!result.success) {
			setErrors(fieldErrors(result.error));
			return false;
		}
		setErrors({});
		return true;
	}

	const submitText = loading ? "Saving…" : submitLabel;

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!validate()) {
			return;
		}
		const id = defaultValues?.id;
		if (id) {
			await onSubmit({ githubRepoFullName: repoFullName, id, name });
		} else {
			await onSubmit({ githubRepoFullName: repoFullName, name });
		}
	}

	if (connectionQuery.isPending) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-8 w-full" />
				<Skeleton className="h-8 w-full" />
				<Skeleton className="h-20 w-full" />
			</div>
		);
	}

	if (connectionMissing || reposMissingConnection) {
		return (
			<div className="space-y-4">
				<Alert variant="destructive">
					<AlertTitle>GitHub connection not available</AlertTitle>
					<AlertDescription>
						GitHub repository is mandatory for project creation. Connect GitHub
						in Settings → Account, then pick a repository to create your
						project.
					</AlertDescription>
				</Alert>
				<div className="flex justify-end gap-2">
					{onCancel ? (
						<Button onClick={onCancel} type="button" variant="outline">
							Cancel
						</Button>
					) : null}
					<Button
						disabled={connectMut.isPending}
						onClick={handleConnect}
						type="button"
					>
						{connectMut.isPending ? "Redirecting…" : "Connect GitHub"}
					</Button>
				</div>
				{connectMut.isError ? (
					<p className="text-destructive text-xs">
						{connectMut.error instanceof Error
							? connectMut.error.message
							: "Failed to start GitHub connect"}
					</p>
				) : null}
			</div>
		);
	}

	if (connectionQuery.isError) {
		return (
			<Alert variant="destructive">
				<AlertTitle>Failed to check GitHub connection</AlertTitle>
				<AlertDescription>
					{connectionQuery.error instanceof Error
						? connectionQuery.error.message
						: "Unknown error"}{" "}
					<button
						className="underline underline-offset-2"
						onClick={() => void connectionQuery.refetch()}
						type="button"
					>
						Retry
					</button>
				</AlertDescription>
			</Alert>
		);
	}

	if (reposQuery.isPending) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-8 w-full" />
				<Skeleton className="h-8 w-full" />
				<Skeleton className="h-20 w-full" />
			</div>
		);
	}

	if (reposQuery.isError) {
		return (
			<div className="space-y-4">
				<Alert variant="destructive">
					<AlertTitle>Failed to load GitHub repositories</AlertTitle>
					<AlertDescription>
						{reposQuery.error instanceof Error
							? reposQuery.error.message
							: "Unknown error"}{" "}
						<button
							className="underline underline-offset-2"
							onClick={() => void reposQuery.refetch()}
							type="button"
						>
							Retry
						</button>
					</AlertDescription>
				</Alert>
				<div className="flex justify-end gap-2">
					{onCancel ? (
						<Button onClick={onCancel} type="button" variant="outline">
							Cancel
						</Button>
					) : null}
				</div>
			</div>
		);
	}

	return (
		<form className="space-y-4" onSubmit={handleSubmit}>
			<div className="space-y-2">
				<Label htmlFor="github-repo-filter">Filter repositories</Label>
				<Input
					id="github-repo-filter"
					onChange={(e) => setRepoFilter(e.target.value)}
					placeholder="Filter by owner/repo"
					value={repoFilter}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="github-repo">GitHub repository *</Label>
				<Select
					id="github-repo"
					onChange={(e) => {
						const next = e.target.value;
						setRepoFullName(next);
						const picked = repos.find((r) => r.fullName === next);
						if (picked && !name) {
							setName(picked.name);
						}
					}}
					value={repoFullName}
				>
					<option value="">Select a repository…</option>
					{filteredRepos.map((repo) => (
						<option key={repo.fullName} value={repo.fullName}>
							{repo.fullName}
							{repo.private ? " (private)" : ""}
						</option>
					))}
				</Select>
				{errors.githubRepoFullName ? (
					<p className="text-destructive text-xs">
						{errors.githubRepoFullName}
					</p>
				) : null}
				{repos.length === 0 ? (
					<p className="text-muted-foreground text-xs">
						No repositories found for the connected GitHub account.
					</p>
				) : null}
			</div>
			<div className="space-y-2">
				<Label htmlFor="name">Name *</Label>
				<Input
					id="name"
					onChange={(e) => setName(e.target.value)}
					placeholder="Acme Portal"
					value={name}
				/>
				{errors.name ? (
					<p className="text-destructive text-xs">{errors.name}</p>
				) : null}
			</div>
			<div className="space-y-2">
				<Label htmlFor="description">Description</Label>
				<Textarea
					aria-describedby="description-sync-hint"
					disabled={true}
					id="description"
					placeholder="Synced from the GitHub repository description"
					rows={3}
					value={selectedRepo?.description ?? ""}
				/>
				<p className="text-muted-foreground text-xs" id="description-sync-hint">
					Synced from the GitHub repository description always.
				</p>
			</div>
			<div className="flex justify-end gap-2 pt-2">
				{onCancel ? (
					<Button onClick={onCancel} type="button" variant="outline">
						Cancel
					</Button>
				) : null}
				<Button disabled={Boolean(loading)} type="submit">
					{submitText}
				</Button>
			</div>
		</form>
	);
}
