import { PostHogProvider as BasePostHogProvider } from "@posthog/react";
import posthog from "posthog-js";
import type { ReactNode } from "react";

if (
	typeof window !== "undefined" &&
	import.meta.env.PUBLIC_POSTHOG_KEY &&
	!import.meta.env.DEV
) {
	posthog.init(import.meta.env.PUBLIC_POSTHOG_KEY, {
		api_host: import.meta.env.PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
		capture_pageview: false,
		defaults: "2025-11-30",
		person_profiles: "identified_only",
	});
}

interface PostHogProviderProps {
	children: ReactNode;
}

export default function PostHogProvider({ children }: PostHogProviderProps) {
	if (import.meta.env.DEV) {
		return <>{children}</>;
	}
	return <BasePostHogProvider client={posthog}>{children}</BasePostHogProvider>;
}
