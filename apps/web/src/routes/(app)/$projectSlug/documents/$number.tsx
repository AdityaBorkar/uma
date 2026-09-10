import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import posthog from "posthog-js";
import { useEffect, useState } from "react";

import { DocumentComments } from "#/components/documents/DocumentComments.tsx";
import { DocumentEditorSection } from "#/components/documents/DocumentEditorSection.tsx";
import { DocumentFieldsSidebar } from "#/components/documents/DocumentFieldsSidebar.tsx";
import { DocumentHeader } from "#/components/documents/DocumentHeader.tsx";
import { DocumentTimeline } from "#/components/documents/DocumentTimeline.tsx";
import {
	cleanMeta,
	parseLabels,
	useDocumentDraft,
	validateDraft,
} from "#/components/documents/useDocumentDraft.ts";
import { loadDocument } from "#/components/documents.fns.ts";
import { Button } from "#/components/ui/button.tsx";
import { Card, CardContent } from "#/components/ui/card.tsx";
import { Skeleton } from "#/components/ui/skeleton.tsx";
import { useToast } from "#/components/ui/toaster.tsx";
import { rpc, rpcPathKey } from "#/lib/rpc.ts";

export const Route = createFileRoute("/(app)/$projectSlug/documents/$number")({
	component: DocumentDetailPage,
});

// react-doctor-disable-next-line react-doctor/no-giant-component -- page composes Document* sections; further split would obscure data-flow (pending defer)
function DocumentDetailPage() {
	const { number, projectSlug } = Route.useParams();
	const docNumber = Number(number);
	const navigate = useNavigate();
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [commentText, setCommentText] = useState("");
	const draft = useDocumentDraft();
	const { state, hydrate, setSaveError, clearDirty } = draft;

	const pageQuery = useQuery({
		queryFn: () => loadDocument({ data: { number: docNumber } }),
		queryKey: ["document", docNumber],
	});
	const doc = pageQuery.data?.document;

	// Post-load hydration of editable fields. Guarded by `dirty` so user edits
	// are not clobbered; the initial render has no raw yet, so deriving before
	// render would still require an effect. This is intentional async-data hydration.
	// react-doctor-disable-next-line react-hooks-js/set-state-in-effect -- hydrates editable state after raw loads
	useEffect(() => {
		if (!doc || state.dirty) {
			return;
		}
		hydrate(doc);
	}, [doc, state.dirty, hydrate]);

	function resetToRaw() {
		if (doc) {
			hydrate(doc);
		}
	}

	function invalidate() {
		void queryClient.invalidateQueries({ queryKey: ["document", docNumber] });
		void queryClient.invalidateQueries({
			queryKey: rpcPathKey(rpc.documents.list.key()),
		});
	}

	const closeMut = useMutation(
		rpc.documents.close.mutationOptions({
			onError: (e: unknown) =>
				toast({
					description: String(e),
					title: "Error",
					variant: "destructive",
				}),
			onSuccess: () => invalidate(),
		}),
	);
	const reopenMut = useMutation(
		rpc.documents.reopen.mutationOptions({
			onError: (e: unknown) =>
				toast({
					description: String(e),
					title: "Error",
					variant: "destructive",
				}),
			onSuccess: () => invalidate(),
		}),
	);
	const deleteMut = useMutation(
		rpc.documents.remove.mutationOptions({
			onError: (e: unknown) =>
				toast({
					description: String(e),
					title: "Error",
					variant: "destructive",
				}),
			onSuccess: () => {
				posthog.capture("document_deleted");
				void navigate({
					params: { projectSlug },
					to: "/$projectSlug/documents",
				});
			},
		}),
	);
	const commentMut = useMutation(
		rpc.documents.comments.create.mutationOptions({
			onError: (e: unknown) =>
				toast({
					description: String(e),
					title: "Error",
					variant: "destructive",
				}),
			onSuccess: () => {
				setCommentText("");
				posthog.capture("comment_added");
				void queryClient.invalidateQueries({
					queryKey: ["document", docNumber],
				});
			},
		}),
	);
	const updateMut = useMutation(
		rpc.documents.update.mutationOptions({
			onError: (e: unknown) => {
				const msg = e instanceof Error ? e.message : String(e);
				setSaveError(msg);
			},
			onSuccess: (updated) => {
				setSaveError(null);
				clearDirty();
				invalidate();
				posthog.capture("document_updated", { bytes: updated.body.length });
				toast({ description: `#${updated.number}`, title: "Document updated" });
			},
		}),
	);

	if (pageQuery.isPending) {
		return (
			<div className="mx-auto max-w-[1280px] space-y-4">
				<Skeleton className="h-8 w-2/3" />
				<Skeleton className="h-[520px] w-full" />
			</div>
		);
	}
	if (pageQuery.isError || !doc) {
		return (
			<Card className="py-10">
				<CardContent className="text-center">
					<p className="text-destructive text-sm">
						{pageQuery.error instanceof Error
							? pageQuery.error.message
							: "Failed to load document"}
					</p>
					<Button asChild={true} className="mt-4" variant="outline">
						<Link params={{ projectSlug }} to="/$projectSlug/documents">
							Back to documents
						</Link>
					</Button>
				</CardContent>
			</Card>
		);
	}

	const isClosed = doc.state === "closed";
	const canEdit = !isClosed;

	async function handleSave() {
		setSaveError(null);
		const invalid = validateDraft(state.title, state.body);
		if (invalid) {
			setSaveError(invalid);
			return;
		}
		await updateMut.mutateAsync({
			body: state.body,
			labels: parseLabels(state.labelsText),
			meta: cleanMeta(state.meta),
			number: docNumber,
			title: state.title.trim(),
		});
	}

	return (
		<div className="mx-auto max-w-[1280px] space-y-6">
			<DocumentHeader
				canEdit={canEdit}
				doc={doc}
				draft={draft}
				isSaving={updateMut.isPending}
				onCancel={resetToRaw}
				onClose={() => closeMut.mutate({ number: docNumber })}
				onDelete={() => deleteMut.mutate({ number: docNumber })}
				onReopen={() => reopenMut.mutate({ number: docNumber })}
				onSave={handleSave}
				onSwitchSourceMode={() => draft.switchMode("source")}
				pendingClose={closeMut.isPending}
				pendingDelete={deleteMut.isPending}
				pendingReopen={reopenMut.isPending}
				projectSlug={projectSlug}
			/>

			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
				<div className="min-w-0 space-y-6">
					<DocumentEditorSection
						canEdit={canEdit}
						docHtml={doc.html}
						draft={draft}
						isClosed={isClosed}
						rawNumber={doc.number}
					/>

					<DocumentComments
						comments={pageQuery.data.comments}
						commentText={commentText}
						isClosed={isClosed}
						onChange={setCommentText}
						onSubmit={() =>
							commentMut.mutate({
								body: commentText.trim(),
								documentNumber: docNumber,
							})
						}
						pending={commentMut.isPending}
					/>
				</div>

				<aside className="space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
					<DocumentFieldsSidebar
						canEdit={canEdit}
						draft={draft}
						isSaving={updateMut.isPending}
						kind={doc.kind}
						onReset={resetToRaw}
						onSave={handleSave}
						projectName={doc.projectName}
					/>

					<DocumentTimeline
						events={pageQuery.data.events}
						frontmatter={doc.frontmatter}
					/>
				</aside>
			</div>
		</div>
	);
}
