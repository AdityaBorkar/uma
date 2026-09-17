import { useToast } from "#/components/ui/toaster.tsx";

/**
 * Shared mutation toast helpers. Registry pages (prompt-templates/
 * subagents/model-providers) repeated the same
 * `onError: e => toast({description: e instanceof Error ? e.message : …,
 * title: "Failed to …", variant: "destructive"})` triplets for
 * create/update/remove.
 */
export function mutationErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}

export function useCrudToasts(noun: string) {
	const { toast } = useToast();

	function onCreateError(e: unknown) {
		toast({
			description: mutationErrorMessage(e, "Create failed"),
			title: `Failed to create ${noun}`,
			variant: "destructive",
		});
	}

	function onUpdateError(e: unknown) {
		toast({
			description: mutationErrorMessage(e, "Update failed"),
			title: `Failed to update ${noun}`,
			variant: "destructive",
		});
	}

	function onRemoveError(e: unknown) {
		toast({
			description: mutationErrorMessage(e, "Delete failed"),
			title: `Failed to delete ${noun}`,
			variant: "destructive",
		});
	}

	function notifyCreated(description: string) {
		toast({ description, title: `${cap(noun)} created` });
	}

	function notifyUpdated(description: string) {
		toast({ description, title: `${cap(noun)} updated` });
	}

	function notifyDeleted() {
		toast({ title: `${cap(noun)} deleted` });
	}

	return {
		notifyCreated,
		notifyDeleted,
		notifyUpdated,
		onCreateError,
		onRemoveError,
		onUpdateError,
		toast,
	};
}

function cap(noun: string): string {
	return noun.charAt(0).toUpperCase() + noun.slice(1);
}
