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
				startOnLoad: false,
				theme: "dark",
				fontFamily: SANS,
				themeVariables: {
					background: "transparent",
					mainBkg: "#161b22",
					secondBkg: "#21262d",
					tertiaryBkg: "#21262d",
					primaryColor: "#1f6feb",
					primaryBorderColor: "#30363d",
					primaryTextColor: "#e6edf3",
					secondaryColor: "#238636",
					secondaryBorderColor: "#30363d",
					secondaryTextColor: "#e6edf3",
					tertiaryColor: "#21262d",
					tertiaryBorderColor: "#30363d",
					tertiaryTextColor: "#e6edf3",
					lineColor: "#7d8590",
					textColor: "#e6edf3",
					nodeBorder: "#30363d",
					clusterBkg: "#0d1117",
					clusterBorder: "#30363d",
					actorBkg: "#161b22",
					actorBorder: "#30363d",
					actorTextColor: "#e6edf3",
					actorLineColor: "#7d8590",
					signalColor: "#e6edf3",
					signalTextColor: "#e6edf3",
					labelBoxBkgColor: "#161b22",
					labelBoxBorderColor: "#30363d",
					labelTextColor: "#e6edf3",
					noteBkgColor: "#21262d",
					noteBorderColor: "#30363d",
					noteTextColor: "#e6edf3",
				},
				flowchart: { useMaxWidth: true, htmlLabels: true },
				sequence: {
					useMaxWidth: true,
					actorFontFamily: SANS,
					noteFontFamily: SANS,
					messageFontFamily: SANS,
				},
				themeCSS: `
					.mermaid text { font-family: ${SANS} !important; }
					.mermaid code, .mermaid pre { font-family: ${MONO} !important; }
				`,
				securityLevel: "strict",
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
