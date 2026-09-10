import { useCallback, useEffect, useState } from "react";

import { mdxToHtml } from "#/components/mdx-editor.ts";

export type EditorMode = "rich" | "source";

export interface DraftRaw {
	body: string;
	labels?: string[] | null;
	meta?: unknown;
	title: string;
}

export interface DraftState {
	body: string;
	dirty: boolean;
	labelsText: string;
	meta: Record<string, unknown>;
	mode: EditorMode;
	notice: string | null;
	/** Bumped when `body` is replaced wholesale, so the rich editor remounts. */
	revision: number;
	richHtml: string;
	saveError: string | null;
	title: string;
}

export type DocumentDraft = ReturnType<typeof useDocumentDraft>;

/** Single canonical MDX→HTML conversion; null = outside editor allowlist. */
export function toEditableHtml(source: string): string | null {
	try {
		return mdxToHtml(source);
	} catch {
		return null;
	}
}

/** Drop unset controls so empty strings never hit the kind Zod schema. */
export function cleanMeta(meta: Record<string, unknown>) {
	return Object.fromEntries(
		Object.entries(meta).filter(
			([, v]) => v !== undefined && v !== null && v !== "",
		),
	);
}

export function parseLabels(labelsText: string): string[] {
	return labelsText
		.split(",")
		.map((l) => l.trim())
		.filter(Boolean);
}

export function validateDraft(title: string, body: string): string | null {
	if (title.trim().length < 2) {
		return "Title must be at least 2 characters";
	}
	if (body.trim().length === 0) {
		return "Body cannot be empty";
	}
	return null;
}

export function hydrateFromRaw(
	raw: DraftRaw,
): Omit<DraftState, "dirty" | "revision"> {
	const html = toEditableHtml(raw.body);
	const outsideAllowlist = html === null;
	return {
		body: raw.body,
		labelsText: (raw.labels ?? []).join(", "),
		meta: (raw.meta ?? {}) as Record<string, unknown>,
		mode: outsideAllowlist ? "source" : "rich",
		notice: outsideAllowlist
			? "This body uses markup outside the rich editor — editing as raw MDX source."
			: null,
		richHtml: html ?? "",
		saveError: null,
		title: raw.title,
	};
}

const initialDraftState: DraftState = {
	body: "",
	dirty: false,
	labelsText: "",
	meta: {},
	mode: "rich",
	notice: null,
	revision: 0,
	richHtml: "",
	saveError: null,
	title: "",
};

export function useDocumentDraft(initial?: Partial<DraftRaw>) {
	const [state, setState] = useState<DraftState>(() => ({
		...initialDraftState,
		...(initial
			? hydrateFromRaw({
					body: initial.body ?? "",
					labels: initial.labels ?? [],
					meta: initial.meta ?? {},
					title: initial.title ?? "",
				})
			: {}),
	}));

	/** Every user-entered field goes through here, so `dirty` can't be missed. */
	const update = useCallback(
		<K extends keyof DraftState>(key: K, value: DraftState[K]) => {
			setState((s) => ({ ...s, [key]: value, dirty: true }));
		},
		[],
	);

	const setTitle = useCallback((v: string) => update("title", v), [update]);
	const setBody = useCallback((v: string) => update("body", v), [update]);
	const setLabelsText = useCallback(
		(v: string) => update("labelsText", v),
		[update],
	);
	const setMeta = useCallback(
		(next: Record<string, unknown>) => update("meta", next),
		[update],
	);

	const setSaveError = useCallback((value: string | null) => {
		setState((s) => ({ ...s, saveError: value }));
	}, []);

	const clearDirty = useCallback(() => {
		setState((s) => ({ ...s, dirty: false }));
	}, []);

	/**
	 * Server truth replaces the draft. The revision only bumps when the
	 * editor-visible content changed (raw body can differ from the server's
	 * frontmatter-rewritten body while rendering identically), so a post-save
	 * hydrate doesn't remount the editor and steal focus, while Reset does.
	 */
	const hydrate = useCallback((raw: DraftRaw) => {
		setState((s) => {
			const next = { ...s, ...hydrateFromRaw(raw), dirty: false };
			const changed = toEditableHtml(next.body) !== toEditableHtml(s.body);
			return changed ? { ...next, revision: s.revision + 1 } : next;
		});
	}, []);

	const switchMode = useCallback((next: EditorMode) => {
		setState((s) => {
			if (next === s.mode) {
				return s;
			}
			if (next === "rich") {
				const html = toEditableHtml(s.body);
				if (html === null) {
					return {
						...s,
						notice:
							"This content uses markup outside the editor's allowlist — edit it as raw MDX source.",
					};
				}
				return { ...s, mode: next, notice: null, richHtml: html };
			}
			return { ...s, mode: next, notice: null };
		});
	}, []);

	useEffect(() => {
		if (!state.dirty) {
			return;
		}
		const handler = (event: BeforeUnloadEvent) => {
			event.preventDefault();
		};
		window.addEventListener("beforeunload", handler);
		return () => window.removeEventListener("beforeunload", handler);
	}, [state.dirty]);

	return {
		clearDirty,
		hydrate,
		setBody,
		setLabelsText,
		setMeta,
		setSaveError,
		setTitle,
		state,
		switchMode,
	};
}
