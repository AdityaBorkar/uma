/**
 * Shared vocabulary for the project-scope selector. Both the desktop
 * `AppSidebar` select and the mobile `<select>` in `AppShell` render these
 * values, and `AppShell.handleScopeSelect` is the single dispatcher for them.
 */

export const SCOPE_VALUE = {
	create: "__create",
	multi: "__multi",
	settings: "__settings",
} as const;

export type ScopeValue = (typeof SCOPE_VALUE)[keyof typeof SCOPE_VALUE];
