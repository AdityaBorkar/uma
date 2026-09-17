import * as agents from "./procedures/agents.ts";
import * as connections from "./procedures/connections.ts";
import * as device from "./procedures/device.ts";
import * as documents from "./procedures/documents.ts";
import * as machines from "./procedures/machines.ts";
import * as projects from "./procedures/projects.ts";
import * as promptTemplates from "./procedures/promptTemplates.ts";
import * as runs from "./procedures/runs.ts";
import * as subagents from "./procedures/subagents.ts";
import * as tasks from "./procedures/tasks.ts";

/**
 * oRPC router: every procedure module's export names match its
 * `apiContract` namespace 1:1, so namespaces mount directly — no alias
 * table. Adding a contract procedure means exporting the same name from
 * the procedure module; this file stays untouched.
 */
export default {
	agents,
	connections,
	device,
	documents,
	machines,
	projects,
	promptTemplates,
	runs,
	subagents,
	tasks,
};
