import * as connections from "./procedures/connections.ts";
import * as device from "./procedures/device.ts";
import * as documents from "./procedures/documents.ts";
import * as machines from "./procedures/machines.ts";
import * as projects from "./procedures/projects.ts";
import * as signals from "./procedures/signals.ts";
import * as tasks from "./procedures/tasks.ts";

export default {
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
		// Browser registry (cookie auth; web-only, not on the wire contract).
		get: machines.get,
		heartbeatHistory: machines.heartbeatHistoryProc,
		latestVersion: machines.latestVersion,
		list: machines.list,
		resetState: machines.resetStateProc,
		revoke: machines.revoke,
		sandboxList: machines.sandboxListProc,
	},
	projects,
	signals,
	tasks,
};
