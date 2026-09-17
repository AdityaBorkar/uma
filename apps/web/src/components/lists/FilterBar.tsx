import type { ReactNode } from "react";

import { Card, CardContent } from "#/components/ui/card.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Label } from "#/components/ui/label.tsx";
import { Select } from "#/components/ui/select.tsx";

export interface FilterOption {
	label: string;
	value: string;
}

export interface FilterSelectSpec {
	id: string;
	label: string;
	onChange: (value: string) => void;
	options: FilterOption[];
	value: string;
	width?: "sm" | "md";
}

/**
 * Shared filter bar. Card variant matches tasks/documents
 * (`Card > CardContent bg-muted/50 flex-col sm:flex-row` + search Input#q
 * + N selects). Bare variant matches registry pages (skills/mcp/subagents/
 * prompt-templates: `flex gap-3 > max-w-sm search`).
 */
export function FilterBar({
	actions,
	filters = [],
	search,
	variant = "card",
}: {
	actions?: ReactNode | undefined;
	filters?: FilterSelectSpec[] | undefined;
	search: {
		id?: string | undefined;
		label?: string | undefined;
		onChange: (value: string) => void;
		placeholder: string;
		value: string;
	};
	variant?: "card" | "bare" | undefined;
}) {
	const searchId = search.id ?? "q";
	const searchBlock = (
		<div
			className={
				variant === "card"
					? "flex-1 space-y-1.5"
					: "w-full max-w-sm space-y-1.5"
			}
		>
			<Label className="font-semibold text-xs" htmlFor={searchId}>
				{search.label ?? "Search"}
			</Label>
			<Input
				id={searchId}
				onChange={(e) => search.onChange(e.target.value)}
				placeholder={search.placeholder}
				value={search.value}
			/>
		</div>
	);

	if (variant === "bare") {
		return (
			<div className="flex gap-3">
				{searchBlock}
				{actions}
			</div>
		);
	}

	return (
		<Card>
			<CardContent className="flex flex-col gap-3 bg-muted/50 sm:flex-row sm:items-end">
				{searchBlock}
				{filters.map((f) => (
					<div
						className={
							f.width === "sm"
								? "w-full space-y-1.5 sm:w-36"
								: "w-full space-y-1.5 sm:w-40"
						}
						key={f.id}
					>
						<Label className="font-semibold text-xs" htmlFor={f.id}>
							{f.label}
						</Label>
						<Select
							id={f.id}
							onChange={(e) => f.onChange(e.target.value)}
							value={f.value}
						>
							{f.options.map((o) => (
								<option key={o.value} value={o.value}>
									{o.label}
								</option>
							))}
						</Select>
					</div>
				))}
				{actions}
			</CardContent>
		</Card>
	);
}
