import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const config = defineConfig(({ mode }) => {
	// `CONTROL_PLANE_URL` is runtime env (no `PUBLIC_` prefix), so read it
	// from the process here for the dev proxy. Falls back to the same default
	// as `src/env.ts` (`CONTROL_PLANE_URL`).
	const runtimeEnv = {
		...process.env,
		...loadEnv(mode, process.cwd(), ""),
	};
	const controlPlane = runtimeEnv.CONTROL_PLANE_URL || "http://127.0.0.1:4000";

	return {
		build: {
			outDir: ".output",
		},
		plugins: [
			devtools(),
			tailwindcss(),
			tanstackStart(),
			viteReact(),
			babel({ presets: [reactCompilerPreset()] }),
		],
		resolve: {
			tsconfigPaths: true,
		},
		server: {
			host: "0.0.0.0",
			port: 3000,
			proxy: {
				// The control plane (`apps/server`) owns `/api/*` (incl. the
				// `/api/machines/ws` websocket). Proxy it in dev so the UI can
				// stay same-origin; in prod Caddy does this routing.
				"/api": {
					changeOrigin: false,
					target: controlPlane,
					ws: true,
				},
			},
			strictPort: true,
		},
	};
});

export default config;
