import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import posthog from "posthog-js";

import { DocumentForm } from "#/components/documents/DocumentForm.tsx";
import { Card, CardContent } from "#/components/ui/card.tsx";
import { Skeleton } from "#/components/ui/skeleton.tsx";
import { useToast } from "#/components/ui/toaster.tsx";
import { rpc, rpcPathKey } from "#/lib/rpc.ts";

export const Route = createFileRoute(
	"/(app)/$projectSlug/documents/$number/edit",
)({
	component: EditDocumentPage,
});

function EditDocumentPage() {
	const { number, projectSlug } = Route.useParams();
	const docNumber = Number(number);
	const navigate = useNavigate();
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const docQuery = useQuery(
		rpc.documents.get.queryOptions({ input: { number: docNumber } }),
	);

	const updateMut = useMutation(
		rpc.documents.update.mutationOptions({
			onError: () => {
				// Surfaced inline by the form.
			},
			onSuccess: (doc) => {
				void queryClient.invalidateQueries({
					queryKey: rpcPathKey(rpc.documents.list.key()),
				});
				void queryClient.invalidateQueries({
					queryKey: ["document", docNumber],
				});
				posthog.capture("document_updated", { bytes: doc.body.length });
				toast({ description: `#${doc.number}`, title: "Document updated" });
				void navigate({
					params: {
						number,
						projectSlug,
					},
					to: "/$projectSlug/documents/$number",
				});
			},
		}),
	);

	if (docQuery.isPending) {
		return (
			<div className="mx-auto max-w-3xl space-y-4">
				<Skeleton className="h-8 w-1/3" />
				<Skeleton className="h-96 w-full" />
			</div>
		);
	}
	if (docQuery.isError || !docQuery.data) {
		return (
			<Card className="py-12">
				<CardContent className="text-center text-destructive text-sm">
					Failed to load document
				</CardContent>
			</Card>
		);
	}

	const doc = docQuery.data;

	return (
		<div className="mx-auto max-w-3xl space-y-6">
			<div>
				<h1 className="font-bold text-2xl tracking-tight">
					Edit #{doc.number}
				</h1>
				<p className="text-muted-foreground text-sm">
					Compose in the rich editor — content saves as MDX, kind-specific
					fields save as JSONB metadata. Use Source mode for raw MDX.
				</p>
			</div>
			<Card>
				<CardContent className="pt-6">
					<p className="mb-4 text-muted-foreground text-xs">
						Kind and Project are locked after creation.
					</p>
					<DocumentForm
						initial={{
							body: doc.body,
							kind: doc.kind,
							labels: doc.labels,
							meta: doc.meta,
							projectName: doc.projectName,
							title: doc.title,
						}}
						loading={updateMut.isPending}
						onCancel={() =>
							void navigate({
								params: {
									number,
									projectSlug,
								},
								to: "/$projectSlug/documents/$number",
							})
						}
						onSubmit={async (values) => {
							await updateMut.mutateAsync({
								body: values.body,
								labels: values.labels,
								meta: values.meta,
								number: docNumber,
								title: values.title,
							});
						}}
						submitLabel="Save changes"
					/>
				</CardContent>
			</Card>
		</div>
	);
}
