import * as agents from "./procedures/agents.ts";
import * as connections from "./procedures/connections.ts";
import * as device from "./procedures/device.ts";
import * as documents from "./procedures/documents.ts";
import * as machines from "./procedures/machines.ts";
import * as projects from "./procedures/projects.ts";
import * as runs from "./procedures/runs.ts";
import * as signals from "./procedures/signals.ts";
import * as tasks from "./procedures/tasks.ts";

export default {
	agents,
	connections,
	device,
	documents: {
		...documents,
		comments: {
			create: documents.createComment,
		},
	},
	machines: {
		// apiContract `machines.*` (machine Bearer auth; frozen schemas).
		checkState: machines.checkState,
		claim: machines.claim,
		// Browser registry (cookie auth; web-only) — also on the contract.
		get: machines.get,
		heartbeatHistory: machines.heartbeatHistoryProc,
		heartbeatList: machines.heartbeatListProc,
		latestVersion: machines.latestVersion,
		list: machines.list,
		resetState: machines.resetStateProc,
		revoke: machines.revoke,
		sandboxList: machines.sandboxListProc,
	},
	projects,
	runs,
	signals,
	tasks: {
		create: tasks.create,
		get: tasks.get,
		list: tasks.list,
		logs: {
			list: tasks.logsList,
		},
		stats: tasks.stats,
		updateStatus: tasks.updateStatus,
	},
};
