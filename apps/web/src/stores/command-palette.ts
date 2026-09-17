import { Store } from "@tanstack/store";

/** Global open state for the command palette. No provider required. */
export const commandPaletteOpenStore = new Store(false);

export function setCommandPaletteOpen(open: boolean) {
	commandPaletteOpenStore.setState(() => open);
}

export function openCommandPalette() {
	setCommandPaletteOpen(true);
}

export function closeCommandPalette() {
	setCommandPaletteOpen(false);
}

export function toggleCommandPalette() {
	commandPaletteOpenStore.setState((open) => !open);
}

export type CreateIntent = "project" | "task" | "document" | null;

/**
 * One-shot intent for creation commands. The palette sets it (and navigates
 * to the owning page when needed); the owning surface consumes it by opening
 * its dialog and clearing the store. Scoped narrowly per surface so AppShell
 * only reacts to `"project"`, the tasks page to `"task"`, and the documents
 * page to `"document"`.
 */
export const createIntentStore = new Store<CreateIntent>(null);

export function requestCreate(intent: Exclude<CreateIntent, null>) {
	createIntentStore.setState(() => intent);
}

export function clearCreateIntent() {
	createIntentStore.setState(() => null);
}
