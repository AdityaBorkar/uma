import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import posthog from "posthog-js";

import { DocumentEditorSection } from "#/components/documents/DocumentEditorSection.tsx";
import { DocumentFieldsSidebar } from "#/components/documents/DocumentFieldsSidebar.tsx";
import { DocumentHeader } from "#/components/documents/DocumentHeader.tsx";
import { DocumentTimeline } from "#/components/documents/DocumentTimeline.tsx";
import { loadDocument } from "#/components/documents.fns.ts";
import { Button } from "#/components/ui/button.tsx";
import { Card, CardContent } from "#/components/ui/card.tsx";
import { Skeleton } from "#/components/ui/skeleton.tsx";
import { useToast } from "#/components/ui/toaster.tsx";
import { rpc } from "#/lib/rpc.ts";
import {
	cleanMeta,
	clearDraftDirty,
	hydrateDraft,
	parseLabels,
	setDraftSaveError,
	switchDraftMode,
	useDraftBeforeUnload,
	useDraftStore,
	useHydrateDraftFromDoc,
	validateDraft,
} from "#/stores/draft.ts";
import { invalidateDocuments } from "#/stores/invalidation.ts";

export const Route = createFileRoute("/(app)/$projectSlug/documents/$number")({
	component: DocumentDetailPage,
	head: () => ({
		meta: [
			{ title: "Document — Planner" },
			{
				content: "View and edit a document with history.",
				name: "description",
			},
		],
	}),
});

// react-doctor-disable-next-line react-doctor/no-giant-component -- page composes Document* sections; further split would obscure data-flow (pending defer)
function DocumentDetailPage() {
	const { number, projectSlug } = Route.useParams();
	const docNumber = Number(number);
	const navigate = useNavigate();
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const draftStore = useDraftStore();

	const pageQuery = useQuery({
		queryFn: () => loadDocument({ data: { number: docNumber } }),
		queryKey: ["document", docNumber],
	});
	const doc = pageQuery.data?.document;

	// Post-load hydration of editable fields. Guarded by `dirty` so user edits
	// are not clobbered; the store version replaces the old useState effect.
	useHydrateDraftFromDoc(draftStore, doc);
	useDraftBeforeUnload(draftStore);

	function resetToRaw() {
		if (doc) {
			hydrateDraft(draftStore, doc);
		}
	}

	function invalidate() {
		invalidateDocuments(queryClient, docNumber);
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
	const updateMut = useMutation(
		rpc.documents.update.mutationOptions({
			onError: (e: unknown) => {
				const msg = e instanceof Error ? e.message : String(e);
				setDraftSaveError(draftStore, msg);
			},
			onSuccess: (updated) => {
				setDraftSaveError(draftStore, null);
				clearDraftDirty(draftStore);
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
		const s = draftStore.state;
		setDraftSaveError(draftStore, null);
		const invalid = validateDraft(s.title, s.body);
		if (invalid) {
			setDraftSaveError(draftStore, invalid);
			return;
		}
		await updateMut.mutateAsync({
			body: s.body,
			labels: parseLabels(s.labelsText),
			meta: cleanMeta(s.meta),
			number: docNumber,
			title: s.title.trim(),
		});
	}

	return (
		<div className="mx-auto max-w-[1280px] space-y-6">
			<DocumentHeader
				canEdit={canEdit}
				doc={doc}
				draftStore={draftStore}
				isSaving={updateMut.isPending}
				onCancel={resetToRaw}
				onClose={() => closeMut.mutate({ number: docNumber })}
				onDelete={() => deleteMut.mutate({ number: docNumber })}
				onReopen={() => reopenMut.mutate({ number: docNumber })}
				onSave={handleSave}
				onSwitchSourceMode={() => switchDraftMode(draftStore, "source")}
				pendingClose={closeMut.isPending}
				pendingDelete={deleteMut.isPending}
				pendingReopen={reopenMut.isPending}
				projectSlug={projectSlug}
			/>

			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
				<div className="min-w-0">
					<DocumentEditorSection
						canEdit={canEdit}
						docHtml={doc.html}
						draftStore={draftStore}
						isClosed={isClosed}
						rawNumber={doc.number}
					/>
				</div>

				<aside className="space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
					<DocumentFieldsSidebar
						canEdit={canEdit}
						createdAt={doc.createdAt}
						draftStore={draftStore}
						isSaving={updateMut.isPending}
						kind={doc.kind}
						onReset={resetToRaw}
						onSave={handleSave}
						projectName={doc.projectName}
						updatedAt={doc.updatedAt}
					/>

					<DocumentTimeline events={pageQuery.data.events} />
				</aside>
			</div>
		</div>
	);
}
