import { createFileRoute, Outlet } from "@tanstack/react-router";

import {
	BotMessageSquare,
	Browser,
	ChartColumn,
	Computer,
	FileCode,
	FileSliders,
	FileSymlink,
	FlaskConical,
	FolderKanban,
	GitBranch,
	Globe,
	HardDrive,
	Server,
	Sparkle,
	User,
} from "#/components/icons.tsx";
import { AppShell } from "#/components/layout/AppShell.tsx";

export const Route = createFileRoute("/(app)/settings")({
	component: SettingsLayout,
});

const settingsNavItems = [
	{ icon: User, label: "Account", to: "/settings/account" },
	{ icon: ChartColumn, label: "Analytics", to: "/settings/analytics" },
	{ icon: FlaskConical, label: "Evals", to: "/settings/evals" },
	{ id: "evals-projects", type: "divider" },
	{ icon: FolderKanban, label: "Projects", to: "/settings/projects" },
	{ icon: Server, label: "Machines", to: "/settings/machines" },
	{ id: "machines-agents", type: "divider" },
	{ icon: BotMessageSquare, label: "Agents", to: "/settings/agents" },
	{ icon: FileCode, label: "Skills", to: "/settings/skills" },
	{ icon: HardDrive, label: "MCP Server", to: "/settings/mcp" },
	{ icon: FileSymlink, label: "Commands", to: "/settings/commands" },
	{ icon: FileSliders, label: "Subagents", to: "/settings/subagents" },
	{ icon: Sparkle, label: "Model Providers", to: "/settings/model-providers" },
	{ id: "providers-integrations", type: "divider" },
	{
		icon: GitBranch,
		label: "Version-Source",
		to: "/settings/version-source",
	},
	{ icon: Globe, label: "Web Search", to: "/settings/web-search" },
	{ icon: Browser, label: "Browsers", to: "/settings/browsers" },
	{
		icon: Computer,
		label: "Computer Control",
		to: "/settings/computer-control",
	},
] as const;

function SettingsLayout() {
	return (
		<AppShell isSettings={true} items={settingsNavItems}>
			<Outlet />
		</AppShell>
	);
}
