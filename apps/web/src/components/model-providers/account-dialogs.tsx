import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert.tsx";
import { Button } from "#/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Label } from "#/components/ui/label.tsx";
import { Select } from "#/components/ui/select.tsx";
import type { ProviderAccount } from "#/lib/model-providers/types.ts";

export function AddAccountDialog({
	initialProvider,
	onOpenChange,
	onSave,
	open,
	providerNames,
}: {
	initialProvider: string;
	onOpenChange: (open: boolean) => void;
	onSave: (account: ProviderAccount) => void;
	open: boolean;
	providerNames: string[];
}) {
	const [provider, setProvider] = useState(initialProvider);
	const [label, setLabel] = useState("");
	const [apiKey, setApiKey] = useState("");

	useEffect(() => {
		if (open) setProvider(initialProvider);
	}, [open, initialProvider]);

	function reset(): void {
		setProvider(initialProvider);
		setLabel("");
		setApiKey("");
	}

	function handleSave(): void {
		onSave({
			apiKey,
			createdAt: new Date().toISOString(),
			id: crypto.randomUUID(),
			label: label.trim(),
			provider,
		});
		reset();
		onOpenChange(false);
	}

	return (
		<Dialog
			onOpenChange={(next) => {
				if (!next) reset();
				onOpenChange(next);
			}}
			open={open}
		>
			<DialogContent className="p-0" onClose={() => onOpenChange(false)}>
				<DialogHeader className="px-4 py-3">
					<DialogTitle>Add account</DialogTitle>
					<DialogDescription>
						Attach an API key to a provider. Keys stay in this browser only —
						they are never sent to the server.
					</DialogDescription>
				</DialogHeader>
				<div className="dialog-body space-y-4 overflow-y-auto px-4 py-4">
					{providerNames.length === 0 ? (
						<Alert>
							<AlertTitle>No providers yet</AlertTitle>
							<AlertDescription>
								Add a provider first, then attach an API key to it.
							</AlertDescription>
						</Alert>
					) : null}
					<div className="space-y-1.5">
						<Label className="text-xs font-semibold" htmlFor="account-provider">
							Provider
						</Label>
						<Select
							id="account-provider"
							onChange={(e) => setProvider(e.target.value)}
							value={provider}
						>
							{providerNames.map((n) => (
								<option key={n} value={n}>
									{n}
								</option>
							))}
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs font-semibold" htmlFor="account-label">
							Account Label
						</Label>
						<Input
							id="account-label"
							onChange={(e) => setLabel(e.target.value)}
							placeholder="Personal key"
							value={label}
						/>
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs font-semibold" htmlFor="account-key">
							API Key
						</Label>
						<Input
							autoComplete="off"
							id="account-key"
							onChange={(e) => setApiKey(e.target.value)}
							placeholder="sk-…"
							type="password"
							value={apiKey}
						/>
					</div>
					<div className="flex items-center justify-end gap-2">
						<Button
							onClick={() => onOpenChange(false)}
							size="sm"
							type="button"
							variant="ghost"
						>
							Cancel
						</Button>
						<Button
							disabled={provider === "" || label.trim() === "" || apiKey === ""}
							onClick={handleSave}
							size="sm"
							type="button"
							variant="primary"
						>
							Save account
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export function EditAccountDialog({
	account,
	onOpenChange,
	onSave,
	open,
	providerNames,
}: {
	account: ProviderAccount | null;
	onOpenChange: (open: boolean) => void;
	onSave: (patch: Omit<ProviderAccount, "createdAt" | "id">) => void;
	open: boolean;
	providerNames: string[];
}) {
	const [provider, setProvider] = useState("");
	const [label, setLabel] = useState("");
	const [apiKey, setApiKey] = useState("");

	useEffect(() => {
		if (open && account) {
			setProvider(account.provider);
			setLabel(account.label);
			setApiKey(account.apiKey);
		}
	}, [open, account]);

	function handleSave(): void {
		onSave({ apiKey, label: label.trim(), provider });
		onOpenChange(false);
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="p-0" onClose={() => onOpenChange(false)}>
				<DialogHeader className="px-4 py-3">
					<DialogTitle>Edit account</DialogTitle>
					<DialogDescription>
						Update the label, provider, or API key. Keys stay in this browser
						only.
					</DialogDescription>
				</DialogHeader>
				<div className="dialog-body space-y-4 overflow-y-auto px-4 py-4">
					<div className="space-y-1.5">
						<Label
							className="text-xs font-semibold"
							htmlFor="edit-account-provider"
						>
							Provider
						</Label>
						<Select
							id="edit-account-provider"
							onChange={(e) => setProvider(e.target.value)}
							value={provider}
						>
							{providerNames.map((n) => (
								<option key={n} value={n}>
									{n}
								</option>
							))}
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label
							className="text-xs font-semibold"
							htmlFor="edit-account-label"
						>
							Account Label
						</Label>
						<Input
							id="edit-account-label"
							onChange={(e) => setLabel(e.target.value)}
							value={label}
						/>
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs font-semibold" htmlFor="edit-account-key">
							API Key
						</Label>
						<Input
							autoComplete="off"
							id="edit-account-key"
							onChange={(e) => setApiKey(e.target.value)}
							type="password"
							value={apiKey}
						/>
					</div>
					<div className="flex items-center justify-end gap-2">
						<Button
							onClick={() => onOpenChange(false)}
							size="sm"
							type="button"
							variant="ghost"
						>
							Cancel
						</Button>
						<Button
							disabled={provider === "" || label.trim() === "" || apiKey === ""}
							onClick={handleSave}
							size="sm"
							type="button"
							variant="primary"
						>
							Save changes
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
