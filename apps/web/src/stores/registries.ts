import { useSelector } from "@tanstack/react-store";
import { Store } from "@tanstack/store";

import {
	type InstalledMcpEntry,
	loadStore as loadMcp,
	EMPTY_STORE as MCP_EMPTY,
	type McpStore,
	parseStore as parseMcp,
	saveStore as saveMcp,
} from "#/lib/mcp/mcp.ts";
import {
	type CustomModel,
	type CustomProvider,
	type DetectedModel,
	loadStore as loadProviders,
	type ModelProviderStore,
	EMPTY_STORE as PROVIDERS_EMPTY,
	type ProviderAccount,
	parseStore as parseProviders,
	saveStore as saveProviders,
} from "#/lib/model-providers/types.ts";
import {
	type InstalledSkillEntry,
	loadStore as loadSkills,
	parseStore as parseSkills,
	EMPTY_STORE as SKILLS_EMPTY,
	type SkillsStore,
	saveStore as saveSkills,
} from "#/lib/skills/skills.ts";
import { onStorageKey } from "./persist.ts";

/* ------------------------------------------------------------------ */
/* MCP servers                                                         */
/* ------------------------------------------------------------------ */

export const mcpStore = new Store<McpStore>(MCP_EMPTY);

export function hydrateMcpStore() {
	if (typeof window === "undefined") return;
	if (mcpStore.state.items.length > 0) return;
	try {
		const next = loadMcp();
		if (next.items.length > 0) mcpStore.setState(() => next);
	} catch {
		// ignore — keep empty
	}
}

if (typeof window !== "undefined") {
	mcpStore.subscribe((v) => saveMcp(v));
	onStorageKey("uma:mcp-servers:v1", (raw) => {
		if (raw === null) return;
		try {
			mcpStore.setState(() => parseMcp(raw));
		} catch {
			// ignore malformed cross-tab payloads
		}
	});
}

export function addMcpItem(item: InstalledMcpEntry) {
	mcpStore.setState((prev) => ({ items: [...prev.items, item] }));
}

export function removeMcpItem(id: string) {
	mcpStore.setState((prev) => ({
		items: prev.items.filter((i) => i.id !== id),
	}));
}

export function updateMcpItem(id: string, patch: Partial<InstalledMcpEntry>) {
	mcpStore.setState((prev) => ({
		items: prev.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
	}));
}

export function useMcpStore() {
	const store = useSelector(mcpStore, (s) => s);
	return {
		addItem: addMcpItem,
		removeItem: removeMcpItem,
		store,
		updateItem: updateMcpItem,
	};
}

export function useMcpItems(): InstalledMcpEntry[] {
	return useSelector(mcpStore, (s) => s.items);
}

/* ------------------------------------------------------------------ */
/* Skills                                                              */
/* ------------------------------------------------------------------ */

export const skillsStore = new Store<SkillsStore>(SKILLS_EMPTY);

export function hydrateSkillsStore() {
	if (typeof window === "undefined") return;
	if (skillsStore.state.items.length > 0) return;
	try {
		const next = loadSkills();
		if (next.items.length > 0) skillsStore.setState(() => next);
	} catch {
		// ignore
	}
}

if (typeof window !== "undefined") {
	skillsStore.subscribe((v) => saveSkills(v));
	onStorageKey("uma:skills:v1", (raw) => {
		if (raw === null) return;
		try {
			skillsStore.setState(() => parseSkills(raw));
		} catch {
			// ignore
		}
	});
}

export function addSkillItem(item: InstalledSkillEntry) {
	skillsStore.setState((prev) => ({ items: [...prev.items, item] }));
}

export function removeSkillItem(id: string) {
	skillsStore.setState((prev) => ({
		items: prev.items.filter((i) => i.id !== id),
	}));
}

export function updateSkillItem(
	id: string,
	patch: Partial<InstalledSkillEntry>,
) {
	skillsStore.setState((prev) => ({
		items: prev.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
	}));
}

export function useSkillsStore() {
	const store = useSelector(skillsStore, (s) => s);
	return {
		addItem: addSkillItem,
		removeItem: removeSkillItem,
		store,
		updateItem: updateSkillItem,
	};
}

export function useSkillItems(): InstalledSkillEntry[] {
	return useSelector(skillsStore, (s) => s.items);
}

/* ------------------------------------------------------------------ */
/* Model providers (accounts + manual models + custom providers)       */
/* ------------------------------------------------------------------ */

export const providerStore = new Store<ModelProviderStore>(PROVIDERS_EMPTY);

export function hydrateProviderStore() {
	if (typeof window === "undefined") return;
	const s = providerStore.state;
	if (s.accounts.length + s.models.length + s.providers.length > 0) return;
	try {
		const next = loadProviders();
		if (next.accounts.length + next.models.length + next.providers.length > 0) {
			providerStore.setState(() => next);
		}
	} catch {
		// ignore
	}
}

if (typeof window !== "undefined") {
	providerStore.subscribe((v) => saveProviders(v));
	onStorageKey("uma:model-providers:v1", (raw) => {
		if (raw === null) return;
		try {
			providerStore.setState(() => parseProviders(raw));
		} catch {
			// ignore
		}
	});
}

export function addProvider(provider: CustomProvider) {
	providerStore.setState((prev) => ({
		...prev,
		providers: [...prev.providers, provider],
	}));
}

export function addProviderModel(model: CustomModel) {
	providerStore.setState((prev) => ({
		...prev,
		models: [...prev.models, model],
	}));
}

export function addProviderAccount(account: ProviderAccount) {
	providerStore.setState((prev) => ({
		...prev,
		accounts: [...prev.accounts, account],
	}));
}

export function removeProviderAccount(id: string) {
	providerStore.setState((prev) => ({
		...prev,
		accounts: prev.accounts.filter((a) => a.id !== id),
	}));
}

export function removeProviderModel(customId: string) {
	providerStore.setState((prev) => ({
		...prev,
		models: prev.models.filter((m) => m.customId !== customId),
	}));
}

export function removeProvider(id: string) {
	providerStore.setState((prev) => {
		const provider = prev.providers.find((p) => p.id === id);
		return {
			accounts: provider
				? prev.accounts.filter((a) => a.provider !== provider.name)
				: prev.accounts,
			models: provider
				? prev.models.filter((m) => m.provider !== provider.name)
				: prev.models,
			providers: prev.providers.filter((p) => p.id !== id),
		};
	});
}

export function updateProviderAccount(
	id: string,
	patch: Omit<ProviderAccount, "createdAt" | "id">,
) {
	providerStore.setState((prev) => ({
		...prev,
		accounts: prev.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
	}));
}

export function updateDetectedModel(
	providerId: string,
	modelId: string,
	patch: DetectedModel,
) {
	providerStore.setState((prev) => ({
		...prev,
		providers: prev.providers.map((p) =>
			p.id === providerId
				? {
						...p,
						models: p.models.map((m) => (m.id === modelId ? { ...patch } : m)),
					}
				: p,
		),
	}));
}

export function updateManualModel(
	customId: string,
	patch: Omit<CustomModel, "customId">,
) {
	providerStore.setState((prev) => ({
		...prev,
		models: prev.models.map((m) =>
			m.customId === customId ? { ...m, ...patch } : m,
		),
	}));
}

export function updateProvider(
	id: string,
	patch: { baseUrl: string; models?: DetectedModel[]; name: string },
) {
	providerStore.setState((prev) => {
		const existing = prev.providers.find((p) => p.id === id);
		const renamed = existing && existing.name !== patch.name;
		return {
			accounts: renamed
				? prev.accounts.map((a) =>
						a.provider === existing.name ? { ...a, provider: patch.name } : a,
					)
				: prev.accounts,
			models: renamed
				? prev.models.map((m) =>
						m.provider === existing.name ? { ...m, provider: patch.name } : m,
					)
				: prev.models,
			providers: prev.providers.map((p) =>
				p.id === id
					? {
							...p,
							baseUrl: patch.baseUrl,
							models: patch.models ?? p.models,
							name: patch.name,
						}
					: p,
			),
		};
	});
}

export function useProviderStore() {
	const store = useSelector(providerStore, (s) => s);
	return {
		addAccount: addProviderAccount,
		addModel: addProviderModel,
		addProvider,
		removeAccount: removeProviderAccount,
		removeModel: removeProviderModel,
		removeProvider,
		store,
		updateAccount: updateProviderAccount,
		updateDetectedModel,
		updateManualModel,
		updateProvider,
	};
}

export function hydrateAllRegistries() {
	hydrateMcpStore();
	hydrateSkillsStore();
	hydrateProviderStore();
}
