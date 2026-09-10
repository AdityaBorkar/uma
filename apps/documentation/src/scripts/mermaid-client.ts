/**
 * Client-side Mermaid renderer, loaded once from `layout.astro`.
 *
 * - Dynamically imports `mermaid` only when the current page actually
 *   contains a diagram (keeps diagram-free pages light).
 * - Handles every `.mermaid` mount on the page: the `<Mermaid />`
 *   Astro component used by `/visualize/*` (`pre.mermaid`), and ```mermaid
 *   fenced blocks in docs prose (converted to `div.mermaid` at build time
 *   by the `rehypeMermaid` plugin in `src/plugins/rehype-mermaid.mjs`).
 * - Re-runs on `astro:page-load` so diagrams survive View Transitions
 *   client-side navigation (`<ClientRouter />`).
 */

const SANS =
	"'Scoutie Sans Variable','Scoutie Sans',system-ui,-apple-system,'Segoe UI',sans-serif";
const MONO =
	"'JetBrains Mono Variable',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

let initPromise: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid() {
	if (!initPromise) {
		initPromise = import("mermaid").then((mod) => {
			const mermaid = mod.default;
			mermaid.initialize({
				flowchart: { htmlLabels: true, useMaxWidth: true },
				fontFamily: SANS,
				securityLevel: "strict",
				sequence: {
					actorFontFamily: SANS,
					messageFontFamily: SANS,
					noteFontFamily: SANS,
					useMaxWidth: true,
				},
				startOnLoad: false,
				theme: "dark",
				themeCSS: `
					.mermaid text { font-family: ${SANS} !important; }
					.mermaid code, .mermaid pre { font-family: ${MONO} !important; }
				`,
				themeVariables: {
					actorBkg: "#161b22",
					actorBorder: "#30363d",
					actorLineColor: "#7d8590",
					actorTextColor: "#e6edf3",
					background: "transparent",
					clusterBkg: "#0d1117",
					clusterBorder: "#30363d",
					labelBoxBkgColor: "#161b22",
					labelBoxBorderColor: "#30363d",
					labelTextColor: "#e6edf3",
					lineColor: "#7d8590",
					mainBkg: "#161b22",
					nodeBorder: "#30363d",
					noteBkgColor: "#21262d",
					noteBorderColor: "#30363d",
					noteTextColor: "#e6edf3",
					primaryBorderColor: "#30363d",
					primaryColor: "#1f6feb",
					primaryTextColor: "#e6edf3",
					secondaryBorderColor: "#30363d",
					secondaryColor: "#238636",
					secondaryTextColor: "#e6edf3",
					secondBkg: "#21262d",
					signalColor: "#e6edf3",
					signalTextColor: "#e6edf3",
					tertiaryBkg: "#21262d",
					tertiaryBorderColor: "#30363d",
					tertiaryColor: "#21262d",
					tertiaryTextColor: "#e6edf3",
					textColor: "#e6edf3",
				},
			});
			return mermaid;
		});
	}
	return initPromise;
}

async function renderDiagrams() {
	const nodes = Array.from(
		document.querySelectorAll<HTMLElement>(
			"pre.mermaid:not([data-processed]), div.mermaid:not([data-processed])",
		),
	);
	if (nodes.length === 0) return;

	let mermaid: Awaited<ReturnType<typeof loadMermaid>>;
	try {
		mermaid = await loadMermaid();
	} catch (err) {
		console.error("[mermaid] failed to load", err);
		return;
	}

	try {
		await mermaid.run({ nodes });
	} catch (err) {
		console.error("[mermaid] render failed", err);
		for (const node of nodes) {
			if (node.hasAttribute("data-processed")) continue;
			node.classList.add("mermaid-error");
			node.textContent = `Diagram failed to render:\n${node.textContent}`;
			node.setAttribute("data-processed", "true");
		}
	}
}

document.addEventListener("DOMContentLoaded", () => void renderDiagrams());
document.addEventListener("astro:page-load", () => void renderDiagrams());
// Module scripts are deferred, so the DOM is usually ready already.
void renderDiagrams();
