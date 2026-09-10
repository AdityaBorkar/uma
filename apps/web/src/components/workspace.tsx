import { createContext, useContext } from "react";

interface WorkspaceProject {
	id: string;
	name: string;
	slug: string;
}

export type WorkspaceValue =
	| {
			isMulti: false;
			project: WorkspaceProject;
			projectId: string;
			projectSlug: string;
	  }
	| {
			isMulti: true;
			project: null;
			projectId: null;
			projectSlug: "~";
	  };

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function useWorkspace(): WorkspaceValue {
	const ctx = useContext(WorkspaceContext);
	if (!ctx) {
		throw new Error("useWorkspace must be used inside $projectSlug route");
	}
	return ctx;
}

/** Null outside `$projectSlug` (e.g. settings shell) — AppShell uses this. */
export function useOptionalWorkspace(): WorkspaceValue | null {
	return useContext(WorkspaceContext);
}

export function WorkspaceProvider({
	children,
	value,
}: {
	children: React.ReactNode;
	value: WorkspaceValue;
}) {
	return (
		<WorkspaceContext.Provider value={value}>
			{children}
		</WorkspaceContext.Provider>
	);
}
