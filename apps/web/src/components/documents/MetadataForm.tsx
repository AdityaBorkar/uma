import { FormField } from "#/components/forms/FormField.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Select } from "#/components/ui/select.tsx";
import { documentMetaFields } from "#/schemas/schema.ts";

/**
 * Kind-specific metadata controls for the Document composer
 * (docs/adr/004-documents-single-primitive.md §7).
 *
 * Fields come from the explicit `documentMetaFields(kind)` descriptor that
 * mirrors the server-side `documentMetaSchema(kind)` — no Zod introspection.
 * Kinds without declared extras render nothing; their `meta` stays `{}`.
 */

function asString(value: unknown): string {
	return typeof value === "string" ? value : "";
}

export function MetadataForm({
	kind,
	onChange,
	value,
}: {
	kind: string;
	onChange: (meta: Record<string, unknown>) => void;
	value: Record<string, unknown>;
}) {
	const fields = documentMetaFields(kind);
	if (fields.length === 0) {
		return null;
	}

	function update(name: string, next: string) {
		onChange({ ...value, [name]: next });
	}

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
			{fields.map((field) => (
				<FormField
					id={`doc-meta-${field.name}`}
					key={field.name}
					label={
						<>
							{field.label}
							<span className="ml-1 text-muted-foreground text-xs">
								({field.name})
							</span>
						</>
					}
				>
					{field.options ? (
						<Select
							id={`doc-meta-${field.name}`}
							onChange={(e) => update(field.name, e.target.value)}
							value={asString(value[field.name])}
						>
							<option value="">Not set</option>
							{field.options.map((option) => (
								<option key={option} value={option}>
									{option}
								</option>
							))}
						</Select>
					) : (
						<Input
							id={`doc-meta-${field.name}`}
							maxLength={100}
							onChange={(e) => update(field.name, e.target.value)}
							placeholder={field.label}
							value={asString(value[field.name])}
						/>
					)}
				</FormField>
			))}
		</div>
	);
}
