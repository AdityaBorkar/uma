import type { FrontmatterValue } from "#/components/documents.fns.ts";
import { Card, CardContent } from "#/components/ui/card.tsx";
import { Separator } from "#/components/ui/separator.tsx";
import { formatAgo } from "#/lib/age.ts";

function eventLabel(
	kind: string,
	payload: Record<string, FrontmatterValue>,
): string {
	switch (kind) {
		case "renamed":
			return `renamed ${payload.from} → ${payload.to}`;
		case "labeled":
			return `added label ${String(payload.label ?? "")}`;
		case "unlabeled":
			return `removed label ${String(payload.label ?? "")}`;
		default:
			return kind;
	}
}

interface DocEvent {
	createdAt: string;
	id: string;
	kind: string;
	payload: Record<string, FrontmatterValue>;
}

interface Props {
	events: DocEvent[] | undefined;
	frontmatter: Record<string, FrontmatterValue>;
}

export function DocumentTimeline({ events, frontmatter }: Props) {
	const list = events ?? [];
	return (
		<Card>
			<CardContent className="space-y-3 p-4">
				<h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Timeline
				</h3>
				<Separator />
				{list.length === 0 ? (
					<p className="text-muted-foreground text-xs">No events yet.</p>
				) : (
					list.map((event) => (
						<div
							className="text-muted-foreground text-xs leading-5"
							key={event.id}
						>
							<span className="font-medium text-foreground">
								{event.kind === "opened"
									? "opened"
									: eventLabel(event.kind, event.payload)}
							</span>{" "}
							· {formatAgo(event.createdAt)}
						</div>
					))
				)}
				{Object.keys(frontmatter).length > 0 ? (
					<>
						<Separator />
						<details className="text-xs">
							<summary className="cursor-pointer font-medium text-muted-foreground uppercase tracking-wide">
								Frontmatter (raw)
							</summary>
							<dl className="mt-2 space-y-1">
								{Object.entries(frontmatter).map(([key, value]) => (
									<div key={key}>
										<dt className="inline font-mono font-semibold">{key}</dt>
										<dd className="ml-2 inline font-mono text-muted-foreground">
											{JSON.stringify(value)}
										</dd>
									</div>
								))}
							</dl>
						</details>
					</>
				) : null}
			</CardContent>
		</Card>
	);
}
