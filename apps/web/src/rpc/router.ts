import * as connections from "./procedures/connections.ts";
import * as documents from "./procedures/documents.ts";
import * as projects from "./procedures/projects.ts";
import * as signals from "./procedures/signals.ts";
import * as tasks from "./procedures/tasks.ts";

export default {
	connections,
	documents: {
		...documents,
		comments: {
			create: documents.createComment,
		},
	},
	projects,
	signals,
	tasks,
};
