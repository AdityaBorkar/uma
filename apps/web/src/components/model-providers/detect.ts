import { useState } from "react";

import { apiUrl } from "#/env.ts";
import type { DetectedModel } from "#/lib/model-providers/types.ts";

export type DetectStatus = "idle" | "detecting" | "detected" | "error";

export function useModelDetect() {
	const [status, setStatus] = useState<DetectStatus>("idle");
	const [error, setError] = useState("");
	const [models, setModels] = useState<DetectedModel[]>([]);
	const [modelsUrl, setModelsUrl] = useState("");

	function reset(modelsFallback: DetectedModel[] = []): void {
		setStatus("idle");
		setError("");
		setModels(modelsFallback);
		setModelsUrl("");
	}

	async function detect(baseUrl: string): Promise<void> {
		setStatus("detecting");
		setError("");
		try {
			const res = await fetch(
				apiUrl(
					`/api/model-providers/detect?baseUrl=${encodeURIComponent(baseUrl.trim())}`,
				),
			);
			const data = (await res.json()) as {
				count?: number;
				error?: string;
				models?: DetectedModel[];
				modelsUrl?: string;
			};
			if (!res.ok) throw new Error(data.error ?? "Detection failed");
			setModels(Array.isArray(data.models) ? data.models : []);
			setModelsUrl(data.modelsUrl ?? "");
			setStatus("detected");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Detection failed");
			setStatus("error");
		}
	}

	return { detect, error, models, modelsUrl, reset, setModels, status };
}

export function parseReasoningVariants(raw: string): string[] {
	return [
		...new Set(
			raw
				.split(",")
				.map((v) => v.trim())
				.filter(Boolean),
		),
	];
}

export function slugifyModelId(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}
