import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { KeyRound, Plus } from "#/components/icons.tsx";
import { ListEmptyCard, PageHeader } from "#/components/lists/shared.tsx";
import {
	AddAccountDialog,
	EditAccountDialog,
} from "#/components/model-providers/account-dialogs.tsx";
import {
	AccountActions,
	type ModelRow,
	ModelTable,
	ProviderActions,
} from "#/components/model-providers/cells.tsx";
import {
	AddModelDialog,
	EditModelDialog,
} from "#/components/model-providers/model-dialogs.tsx";
import {
	AddProviderDialog,
	EditProviderDialog,
} from "#/components/model-providers/provider-dialogs.tsx";
import { Badge } from "#/components/ui/badge.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Card } from "#/components/ui/card.tsx";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table.tsx";
import { useToast } from "#/components/ui/toaster.tsx";
import type {
	CustomModel,
	CustomProvider,
	DetectedModel,
	ProviderAccount,
} from "#/lib/model-providers/types.ts";
import { maskKey } from "#/lib/model-providers/types.ts";
import { hydrateProviderStore, useProviderStore } from "#/stores/registries.ts";

export const Route = createFileRoute("/(app)/settings/model-providers")({
	component: ModelProvidersPage,
	head: () => ({
		meta: [
			{ title: "Model Providers — Planner" },
			{
				content:
					"Manage model providers, API keys and models stored in this browser.",
				name: "description",
			},
		],
	}),
});

function ProvidersSection({
	onEdit,
	onRemove,
	providers,
}: {
	onEdit: (p: CustomProvider) => void;
	onRemove: (p: CustomProvider) => void;
	providers: CustomProvider[];
}) {
	if (providers.length === 0) {
		return (
			<ListEmptyCard
				description="Add a provider to detect its models, then attach API keys and register models."
				title="No providers"
			/>
		);
	}
	return (
		<Card className="overflow-hidden p-0">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="max-w-55">Provider</TableHead>
						<TableHead className="max-w-65">Base URL</TableHead>
						<TableHead className="w-24">Models</TableHead>
						<TableHead className="w-12 text-right">
							<span className="sr-only">More actions</span>
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{providers.map((p) => (
						<TableRow className="h-12" key={p.id}>
							<TableCell className="max-w-55">
								<span className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
									<span
										aria-hidden={true}
										className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted font-semibold text-xs"
									>
										{p.name.charAt(0).toUpperCase()}
									</span>
									<span className="truncate font-medium" title={p.name}>
										{p.name}
									</span>
								</span>
							</TableCell>
							<TableCell className="max-w-65">
								<span
									className="block truncate font-mono text-muted-foreground text-xs"
									title={p.baseUrl}
								>
									{p.baseUrl}
								</span>
							</TableCell>
							<TableCell className="w-24 whitespace-nowrap">
								<Badge className="whitespace-nowrap" variant="outline">
									{p.models.length} model{p.models.length === 1 ? "" : "s"}
								</Badge>
							</TableCell>
							<TableCell className="w-12 text-right whitespace-nowrap">
								<ProviderActions
									baseUrl={p.baseUrl}
									name={p.name}
									onEdit={() => onEdit(p)}
									remove={() => onRemove(p)}
								/>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</Card>
	);
}

function AccountsSection({
	accounts,
	onEdit,
	onRemove,
}: {
	accounts: ProviderAccount[];
	onEdit: (a: ProviderAccount) => void;
	onRemove: (a: ProviderAccount) => void;
}) {
	if (accounts.length === 0) {
		return (
			<ListEmptyCard
				description="Attach an API key to a provider to mark it configured."
				title="No accounts"
			/>
		);
	}
	return (
		<Card className="overflow-hidden p-0">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="max-w-50">Account</TableHead>
						<TableHead className="max-w-40">Provider</TableHead>
						<TableHead className="max-w-40">API key</TableHead>
						<TableHead className="w-28">Status</TableHead>
						<TableHead className="w-12 text-right">
							<span className="sr-only">More actions</span>
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{accounts.map((a) => (
						<TableRow className="h-12" key={a.id}>
							<TableCell className="max-w-50">
								<span className="block truncate font-medium" title={a.label}>
									{a.label}
								</span>
							</TableCell>
							<TableCell className="max-w-40">
								<span
									className="block truncate text-muted-foreground text-xs"
									title={a.provider}
								>
									{a.provider}
								</span>
							</TableCell>
							<TableCell className="max-w-40">
								<span className="block truncate font-mono text-muted-foreground text-xs">
									{maskKey(a.apiKey)}
								</span>
							</TableCell>
							<TableCell className="w-28 whitespace-nowrap">
								<Badge className="whitespace-nowrap" variant="success">
									API key set
								</Badge>
							</TableCell>
							<TableCell className="w-12 text-right whitespace-nowrap">
								<AccountActions
									label={a.label}
									onEdit={() => onEdit(a)}
									remove={() => onRemove(a)}
								/>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</Card>
	);
}

function ModelProvidersPage() {
	const { toast } = useToast();
	const {
		addAccount,
		addModel,
		addProvider,
		removeAccount,
		removeModel,
		removeProvider,
		store,
		updateAccount,
		updateDetectedModel,
		updateManualModel,
		updateProvider,
	} = useProviderStore();
	const [providerOpen, setProviderOpen] = useState(false);
	const [modelOpen, setModelOpen] = useState(false);
	const [accountOpen, setAccountOpen] = useState(false);
	const [accountProvider, setAccountProvider] = useState<string>("");
	const [editingProvider, setEditingProvider] = useState<CustomProvider | null>(
		null,
	);
	const [editingAccount, setEditingAccount] = useState<ProviderAccount | null>(
		null,
	);
	const [editingManualModel, setEditingManualModel] =
		useState<CustomModel | null>(null);
	const [editingDetected, setEditingDetected] = useState<{
		providerId: string;
		model: DetectedModel;
		providerName: string;
	} | null>(null);

	useEffect(() => {
		hydrateProviderStore();
	}, []);

	const providerNames = useMemo(
		() => store.providers.map((p) => p.name),
		[store.providers],
	);

	const existingNames = useMemo(
		() => providerNames.map((n) => n.toLowerCase()),
		[providerNames],
	);

	const customRows: ModelRow[] = [
		...store.providers.flatMap((p) =>
			p.models.map((m) => ({
				edit: () =>
					setEditingDetected({
						model: m,
						providerId: p.id,
						providerName: p.name,
					}),
				key: `custom:${p.id}:${m.id}`,
				model: m,
				provider: p.name,
			})),
		),
		...store.models.map((m) => ({
			edit: () => setEditingManualModel(m),
			key: `manual:${m.customId}`,
			model: m,
			provider: m.provider,
			remove: () => {
				removeModel(m.customId);
				toast({ description: m.id, title: "Model removed" });
			},
		})),
	];

	function openAccountDialog(providerName: string): void {
		setAccountProvider(providerName);
		setAccountOpen(true);
	}

	return (
		<div className="space-y-6">
			<PageHeader
				description="Manage model providers, API keys and models stored in this browser."
				title="Model Providers"
			/>
			<div className="flex flex-wrap items-center gap-2">
				<Button
					onClick={() => setProviderOpen(true)}
					size="sm"
					type="button"
					variant="primary"
				>
					<Plus className="size-4.25" />
					Add Provider
				</Button>
				<Button
					disabled={providerNames.length === 0}
					onClick={() => setModelOpen(true)}
					size="sm"
					title={
						providerNames.length === 0 ? "Add a provider first" : undefined
					}
					type="button"
					variant="outline"
				>
					<Plus className="size-4.25" />
					Add Model
				</Button>
				<Button
					disabled={providerNames.length === 0}
					onClick={() => openAccountDialog(providerNames[0] ?? "")}
					size="sm"
					title={
						providerNames.length === 0 ? "Add a provider first" : undefined
					}
					type="button"
					variant="outline"
				>
					<KeyRound className="size-4.25" />
					Add Account
				</Button>
			</div>

			<section className="space-y-3">
				<h2 className="font-semibold text-sm">Providers</h2>
				<ProvidersSection
					onEdit={setEditingProvider}
					onRemove={(p) => {
						removeProvider(p.id);
						toast({ description: p.name, title: "Provider removed" });
					}}
					providers={store.providers}
				/>
			</section>

			<section className="space-y-3">
				<h2 className="font-semibold text-sm">Accounts</h2>
				<AccountsSection
					accounts={store.accounts}
					onEdit={setEditingAccount}
					onRemove={(a) => {
						removeAccount(a.id);
						toast({ description: a.label, title: "Account removed" });
					}}
				/>
			</section>

			<section className="space-y-3">
				<h2 className="font-semibold text-sm">Models</h2>
				<Card className="overflow-hidden p-0">
					<ModelTable rows={customRows} />
				</Card>
			</section>

			<AddProviderDialog
				existingNames={existingNames}
				onOpenChange={setProviderOpen}
				onSave={(provider) => {
					addProvider(provider);
					toast({
						description: `${provider.models.length} models detected`,
						title: `Provider ${provider.name} saved`,
					});
				}}
				open={providerOpen}
			/>
			<AddModelDialog
				onOpenChange={setModelOpen}
				onSave={(model) => {
					addModel(model);
					toast({
						description: `${model.id} on ${model.provider}`,
						title: "Model saved",
					});
				}}
				open={modelOpen}
				providerNames={providerNames}
			/>
			<AddAccountDialog
				initialProvider={accountProvider}
				onOpenChange={setAccountOpen}
				onSave={(account) => {
					addAccount(account);
					toast({
						description: `${account.label} on ${account.provider}`,
						title: "Account saved",
					});
				}}
				open={accountOpen}
				providerNames={providerNames}
			/>
			<EditProviderDialog
				existingNames={existingNames}
				onOpenChange={(next) => {
					if (!next) setEditingProvider(null);
				}}
				onSave={(patch) => {
					if (!editingProvider) return;
					updateProvider(editingProvider.id, patch);
					toast({ description: patch.name, title: "Provider updated" });
					setEditingProvider(null);
				}}
				open={editingProvider !== null}
				provider={editingProvider}
			/>
			<EditAccountDialog
				account={editingAccount}
				onOpenChange={(next) => {
					if (!next) setEditingAccount(null);
				}}
				onSave={(patch) => {
					if (!editingAccount) return;
					updateAccount(editingAccount.id, patch);
					toast({ description: patch.label, title: "Account updated" });
					setEditingAccount(null);
				}}
				open={editingAccount !== null}
				providerNames={providerNames}
			/>
			<EditModelDialog
				allowProviderChange={true}
				initial={editingManualModel}
				onOpenChange={(next) => {
					if (!next) setEditingManualModel(null);
				}}
				onSave={(patch) => {
					if (!editingManualModel) return;
					updateManualModel(editingManualModel.customId, patch);
					toast({ description: patch.id, title: "Model updated" });
					setEditingManualModel(null);
				}}
				open={editingManualModel !== null}
				providerNames={providerNames}
				title="Edit model"
			/>
			<EditModelDialog
				allowProviderChange={false}
				initial={
					editingDetected
						? {
								...editingDetected.model,
								provider: editingDetected.providerName,
							}
						: null
				}
				onOpenChange={(next) => {
					if (!next) setEditingDetected(null);
				}}
				onSave={(patch) => {
					if (!editingDetected) return;
					updateDetectedModel(
						editingDetected.providerId,
						editingDetected.model.id,
						patch,
					);
					toast({ description: patch.id, title: "Model updated" });
					setEditingDetected(null);
				}}
				open={editingDetected !== null}
				providerNames={providerNames}
				title="Edit detected model"
			/>
		</div>
	);
}
