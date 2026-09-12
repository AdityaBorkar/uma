import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig({
	build: {
		outDir: ".output",
	},
	plugins: [
		devtools(),
		nitro({
			features: { websocket: true },
		}),
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
		strictPort: true,
	},
});

export default config;
