import { useSelector } from "@tanstack/react-store";

import {
	createListRegistry,
	createPersistentStore,
} from "#/lib/local-store.ts";
import {
	type InstalledMcpEntry,
	InstalledMcpEntrySchema,
	STORAGE_KEY as MCP_KEY,
	McpStoreSchema,
} from "#/lib/mcp/mcp.ts";
import {
	type CustomModel,
	type CustomProvider,
	type DetectedModel,
	ModelProviderStoreSchema,
	STORAGE_KEY as PROVIDERS_KEY,
	type ProviderAccount,
} from "#/lib/model-providers/types.ts";
import {
	type InstalledSkillEntry,
	InstalledSkillEntrySchema,
	STORAGE_KEY as SKILLS_KEY,
	SkillsStoreSchema,
} from "#/lib/skills/skills.ts";

/* MCP servers */

const mcpRegistry = createListRegistry<InstalledMcpEntry>(
	MCP_KEY,
	InstalledMcpEntrySchema,
);

export const mcpStore = mcpRegistry.store;
export const hydrateMcpStore = mcpRegistry.hydrateStore;
export const addMcpItem = mcpRegistry.addItem;
export const removeMcpItem = mcpRegistry.removeItem;
export const updateMcpItem = mcpRegistry.updateItem;

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

/* Skills */

const skillsRegistry = createListRegistry<InstalledSkillEntry>(
	SKILLS_KEY,
	InstalledSkillEntrySchema,
);

export const skillsStore = skillsRegistry.store;
export const hydrateSkillsStore = skillsRegistry.hydrateStore;
export const addSkillItem = skillsRegistry.addItem;
export const removeSkillItem = skillsRegistry.removeItem;
export const updateSkillItem = skillsRegistry.updateItem;

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

/* Model providers */

import { defineLocalStore } from "#/lib/local-store.ts";

const providersDef = defineLocalStore(PROVIDERS_KEY, ModelProviderStoreSchema, {
	accounts: [],
	models: [],
	providers: [],
});

const providersPersistent = createPersistentStore(providersDef);

export const providerStore = providersPersistent.store;

export function hydrateProviderStore(): void {
	providersPersistent.hydrate(
		(s) => s.accounts.length + s.models.length + s.providers.length === 0,
	);
}

export function addProvider(provider: CustomProvider): void {
	providerStore.setState((prev) => ({
		...prev,
		providers: [...prev.providers, provider],
	}));
}

export function addProviderModel(model: CustomModel): void {
	providerStore.setState((prev) => ({
		...prev,
		models: [...prev.models, model],
	}));
}

export function addProviderAccount(account: ProviderAccount): void {
	providerStore.setState((prev) => ({
		...prev,
		accounts: [...prev.accounts, account],
	}));
}

export function removeProviderAccount(id: string): void {
	providerStore.setState((prev) => ({
		...prev,
		accounts: prev.accounts.filter((a) => a.id !== id),
	}));
}

export function removeProviderModel(customId: string): void {
	providerStore.setState((prev) => ({
		...prev,
		models: prev.models.filter((m) => m.customId !== customId),
	}));
}

export function removeProvider(id: string): void {
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
): void {
	providerStore.setState((prev) => ({
		...prev,
		accounts: prev.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
	}));
}

export function updateDetectedModel(
	providerId: string,
	modelId: string,
	patch: DetectedModel,
): void {
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
): void {
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
): void {
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

export function hydrateAllRegistries(): void {
	hydrateMcpStore();
	hydrateSkillsStore();
	hydrateProviderStore();
}

// Re-export schemas for callers that need validation without a second import.
export { McpStoreSchema, SkillsStoreSchema };
