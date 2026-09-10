import { createFileRoute } from "@tanstack/react-router";

import { KeyRound } from "#/components/icons.tsx";
import { Badge } from "#/components/ui/badge.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Card } from "#/components/ui/card.tsx";

export const Route = createFileRoute("/(app)/settings/model-providers")({
	component: ModelProvidersPage,
});

const PROVIDERS = [
	{
		initial: "O",
		keyConfigured: false,
		models: [
			{ id: "gpt-5.2", tags: ["reasoning", "coding"] },
			{ id: "gpt-5-mini", tags: ["fast", "coding"] },
		],
		name: "OpenAI",
	},
	{
		initial: "A",
		keyConfigured: false,
		models: [
			{ id: "claude-opus-4-6", tags: ["reasoning", "coding"] },
			{ id: "claude-sonnet-4-6", tags: ["fast", "coding"] },
		],
		name: "Anthropic",
	},
	{
		initial: "G",
		keyConfigured: false,
		models: [
			{ id: "gemini-3-pro", tags: ["reasoning", "long-context"] },
			{ id: "gemini-3-flash", tags: ["fast", "long-context"] },
		],
		name: "Google",
	},
] as const;

function ModelProvidersPage() {
	const models = PROVIDERS.flatMap((p) =>
		p.models.map((m) => ({ ...m, provider: p.name })),
	);

	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-semibold text-2xl tracking-tight">
					Model Providers
				</h1>
				<p className="text-muted-foreground text-sm">
					Model providers, their supported models, and API keys.
				</p>
			</div>

			<section className="space-y-3">
				<h2 className="font-semibold text-sm">Providers</h2>
				<Card className="overflow-hidden p-0">
					<div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2 text-xs">
						<span className="font-semibold">{PROVIDERS.length} providers</span>
					</div>
					<div>
						{PROVIDERS.map((p) => (
							<div
								className="flex flex-col gap-3 border-b px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
								key={p.name}
							>
								<div className="flex min-w-0 items-center gap-3">
									<span
										aria-hidden={true}
										className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted font-semibold text-sm"
									>
										{p.initial}
									</span>
									<div className="min-w-0">
										<p className="font-semibold text-sm">{p.name}</p>
										<div className="mt-1 flex flex-wrap items-center gap-1.5">
											{p.models.map((m) => (
												<Badge
													className="font-mono text-[11px]"
													key={m.id}
													variant="outline"
												>
													{m.id}
												</Badge>
											))}
										</div>
									</div>
								</div>
								<div className="flex shrink-0 items-center gap-2">
									<Badge variant={p.keyConfigured ? "success" : "outline"}>
										{p.keyConfigured ? "API key set" : "no API key"}
									</Badge>
									<Button size="sm" type="button" variant="outline">
										<KeyRound className="size-4.25" />
										Configure key
									</Button>
								</div>
							</div>
						))}
					</div>
				</Card>
			</section>

			<section className="space-y-3">
				<h2 className="font-semibold text-sm">Models</h2>
				<Card className="overflow-hidden p-0">
					<div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2 text-xs">
						<span className="font-semibold">{models.length} models</span>
						<span className="text-muted-foreground">· all providers</span>
					</div>
					<div>
						{models.map((m) => (
							<div
								className="flex flex-col gap-2 border-b px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
								key={m.id}
							>
								<div className="min-w-0">
									<p className="font-mono font-semibold text-sm">{m.id}</p>
									<p className="text-muted-foreground text-xs">{m.provider}</p>
								</div>
								<div className="flex shrink-0 flex-wrap items-center gap-1.5">
									{m.tags.map((t) => (
										<Badge key={t} variant="outline">
											{t}
										</Badge>
									))}
								</div>
							</div>
						))}
					</div>
				</Card>
			</section>
		</div>
	);
}
