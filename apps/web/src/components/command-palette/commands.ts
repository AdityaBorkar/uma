import {
	BookOpen,
	BotMessageSquare,
	ChartColumn,
	Computer,
	FileCode,
	FileSliders,
	FileSymlink,
	FlaskConical,
	FolderKanban,
	GitBranch,
	HardDrive,
	type IconComponent,
	Layers,
	LayoutDashboard,
	Plus,
	Radar,
	Rocket,
	Server,
	Sparkle,
	SquareKanban,
	SquarePen,
	User,
	Zap,
} from "#/components/icons.tsx";

/**
 * Single source of truth for every command shown in the Command K palette.
 *
 * To add a command, append one entry in `buildCommands` (static) or extend
 * the dynamic project entries below. The palette (`CommandPalette.tsx`)
 * renders, filters, and runs exactly this list — nothing else.
 */

/** Group ids in display order. */
export const COMMAND_GROUP_ORDER = [
	"create",
	"navigate",
	"projects",
	"settings",
] as const;

export type CommandGroupId = (typeof COMMAND_GROUP_ORDER)[number];

export const COMMAND_GROUP_LABELS: Record<CommandGroupId, string> = {
	create: "Create",
	navigate: "Go to",
	projects: "Projects",
	settings: "Settings",
};

export interface CommandContext {
	/** Navigate to an href (TanStack `navigate({ href })`). */
	navigate: (href: string) => void;
	requestCreateDocument: () => void;
	requestCreateProject: () => void;
	requestCreateTask: () => void;
	/** Current scope slug (`"~"` for All projects). Used to build scoped hrefs. */
	scope: string;
	/** Switch scope preserving the current tab (AppShell handler). */
	switchScope: (slug: string) => void;
}

export interface CommandAction {
	description?: string | undefined;
	group: CommandGroupId;
	icon: IconComponent;
	id: string;
	/** Lowercase match text: synonyms beyond the title. */
	keywords: string;
	run: (ctx: CommandContext) => void;
	title: string;
}

export interface ProjectRef {
	name: string;
	slug: string;
}

/**
 * Matches the palette shortcut: `Cmd+K` / `Ctrl+K` and `Ctrl+/`
 * (`Cmd+/` on macOS). `Ctrl+/` may report as `"?"` with Shift held.
 */
export function isCommandPaletteShortcut(event: KeyboardEvent): boolean {
	if (event.repeat || event.altKey || (!event.metaKey && !event.ctrlKey)) {
		return false;
	}
	return (
		event.key.toLowerCase() === "k" || event.key === "/" || event.key === "?"
	);
}

/**
 * Build the full command list. Static entries resolve the scope at run time
 * via `ctx`; per-project switch entries are built from the project list with
 * the current scope excluded.
 */
export function buildCommands(args: {
	currentScope: string;
	projects: ProjectRef[];
}): CommandAction[] {
	const { currentScope, projects } = args;

	const staticCommands: CommandAction[] = [
		{
			description: "Create a project",
			group: "create",
			icon: Plus,
			id: "new-project",
			keywords: "create new project add",
			run: (ctx) => ctx.requestCreateProject(),
			title: "New project",
		},
		{
			description: "Queue a task for an agent",
			group: "create",
			icon: SquareKanban,
			id: "new-task",
			keywords: "create queue task agent run",
			run: (ctx) => ctx.requestCreateTask(),
			title: "New task",
		},
		{
			description: "Write a wiki page, spec, or bug report",
			group: "create",
			icon: SquarePen,
			id: "new-document",
			keywords: "create write document wiki spec bug report",
			run: (ctx) => ctx.requestCreateDocument(),
			title: "New document",
		},
		{
			group: "navigate",
			icon: LayoutDashboard,
			id: "go-dashboard",
			keywords: "dashboard home overview",
			run: (ctx) => ctx.navigate(`/${ctx.scope}/dashboard`),
			title: "Go to Dashboard",
		},
		{
			group: "navigate",
			icon: SquareKanban,
			id: "go-tasks",
			keywords: "tasks queue running work",
			run: (ctx) => ctx.navigate(`/${ctx.scope}/tasks`),
			title: "Go to Tasks",
		},
		{
			group: "navigate",
			icon: BookOpen,
			id: "go-documents",
			keywords: "documents wiki spec bug",
			run: (ctx) => ctx.navigate(`/${ctx.scope}/documents`),
			title: "Go to Documents",
		},
		{
			group: "navigate",
			icon: Zap,
			id: "go-automations",
			keywords: "automations triggers",
			run: (ctx) => ctx.navigate(`/${ctx.scope}/automations`),
			title: "Go to Automations",
		},
		{
			group: "navigate",
			icon: Rocket,
			id: "go-releases",
			keywords: "releases versions ship",
			run: (ctx) => ctx.navigate(`/${ctx.scope}/releases`),
			title: "Go to Releases",
		},
		{
			group: "navigate",
			icon: Radar,
			id: "go-monitor",
			keywords: "monitor status health",
			run: (ctx) => ctx.navigate(`/${ctx.scope}/monitor`),
			title: "Go to Monitor",
		},
		{
			description: "All projects together",
			group: "navigate",
			icon: Layers,
			id: "go-all-projects",
			keywords: "all projects multi workspace",
			run: (ctx) => ctx.switchScope("~"),
			title: "Go to All projects",
		},
		{
			group: "settings",
			icon: User,
			id: "settings-account",
			keywords: "settings account profile user",
			run: (ctx) => ctx.navigate("/settings/account"),
			title: "Go to Account settings",
		},
		{
			group: "settings",
			icon: FolderKanban,
			id: "settings-projects",
			keywords: "settings projects manage list",
			run: (ctx) => ctx.navigate("/settings/projects"),
			title: "Go to Projects settings",
		},
		{
			group: "settings",
			icon: Server,
			id: "settings-machines",
			keywords: "settings machines devices runners",
			run: (ctx) => ctx.navigate("/settings/machines"),
			title: "Go to Machines settings",
		},
		{
			description: "Approve a device code",
			group: "settings",
			icon: Computer,
			id: "connect-machine",
			keywords: "connect machine device enroll approve",
			run: (ctx) => ctx.navigate("/device"),
			title: "Connect a machine",
		},
		{
			group: "settings",
			icon: BotMessageSquare,
			id: "settings-agents",
			keywords: "settings agents registry cli",
			run: (ctx) => ctx.navigate("/settings/agents"),
			title: "Go to Agents settings",
		},
		{
			group: "settings",
			icon: FileCode,
			id: "settings-skills",
			keywords: "settings skills",
			run: (ctx) => ctx.navigate("/settings/skills"),
			title: "Go to Skills settings",
		},
		{
			group: "settings",
			icon: HardDrive,
			id: "settings-mcp-servers",
			keywords: "settings mcp servers tools",
			run: (ctx) => ctx.navigate("/settings/mcp-servers"),
			title: "Go to MCP Servers settings",
		},
		{
			group: "settings",
			icon: FileSymlink,
			id: "settings-prompt-templates",
			keywords: "settings prompt templates slash commands",
			run: (ctx) => ctx.navigate("/settings/prompt-templates"),
			title: "Go to Prompt Templates settings",
		},
		{
			group: "settings",
			icon: FileSliders,
			id: "settings-subagents",
			keywords: "settings subagents",
			run: (ctx) => ctx.navigate("/settings/subagents"),
			title: "Go to Subagents settings",
		},
		{
			group: "settings",
			icon: Sparkle,
			id: "settings-model-providers",
			keywords: "settings model providers keys openai anthropic google",
			run: (ctx) => ctx.navigate("/settings/model-providers"),
			title: "Go to Model Providers settings",
		},
		{
			group: "settings",
			icon: GitBranch,
			id: "settings-version-source",
			keywords: "settings version source git github vcs",
			run: (ctx) => ctx.navigate("/settings/version-source"),
			title: "Go to Version-Source settings",
		},
		{
			group: "settings",
			icon: ChartColumn,
			id: "settings-analytics",
			keywords: "settings analytics reports",
			run: (ctx) => ctx.navigate("/settings/analytics"),
			title: "Go to Analytics settings",
		},
		{
			group: "settings",
			icon: FlaskConical,
			id: "settings-evals",
			keywords: "settings evals evaluations",
			run: (ctx) => ctx.navigate("/settings/evals"),
			title: "Go to Evals settings",
		},
	];

	const projectCommands: CommandAction[] = projects
		.filter((p) => p.slug !== currentScope)
		.map((p) => ({
			description: p.slug,
			group: "projects" as const,
			icon: Layers,
			id: `switch-to-${p.slug}`,
			keywords: `switch project go ${p.name} ${p.slug}`,
			run: (ctx: CommandContext) => ctx.switchScope(p.slug),
			title: `Switch to ${p.name}`,
		}));

	return [...staticCommands, ...projectCommands];
}

/**
 * Case-insensitive AND matching: every whitespace-separated token must appear
 * in the title, description, keywords, or group label.
 */
export function filterCommands(
	commands: CommandAction[],
	query: string,
): CommandAction[] {
	const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (tokens.length === 0) {
		return commands;
	}
	return commands.filter((action) => {
		const haystack =
			`${action.title} ${action.description ?? ""} ${action.keywords} ${COMMAND_GROUP_LABELS[action.group]}`.toLowerCase();
		return tokens.every((token) => haystack.includes(token));
	});
}
