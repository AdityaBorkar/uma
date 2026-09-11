import { defineRelations } from "drizzle-orm";

import * as schema from "./index.ts";

/**
 * App relations (Drizzle Relations v2).
 *
 * Auth tables (`user`, `session`, `account`) get their relations from the
 * generated `authRelations` part in `auth.gen.ts` (better-auth CLI,
 * `defineRelationsPart`). This file covers domain tables only so the two
 * objects spread cleanly in `lib/db.ts`:
 * `relations: { ...relations, ...authRelations }`.
 */
export const relations = defineRelations(schema, (r) => ({
	agents: {
		owner: r.one.user({
			from: r.agents.userId,
			to: r.user.id,
		}),
	},
	connections: {
		owner: r.one.user({
			from: r.connections.userId,
			to: r.user.id,
		}),
	},
	documentComments: {
		author: r.one.user({
			from: r.documentComments.authorId,
			to: r.user.id,
		}),
		document: r.one.documents({
			from: r.documentComments.documentId,
			to: r.documents.id,
		}),
	},
	documentCounters: {
		user: r.one.user({
			from: r.documentCounters.userId,
			to: r.user.id,
		}),
	},
	documentEvents: {
		actor: r.one.user({
			from: r.documentEvents.actorId,
			to: r.user.id,
		}),
		document: r.one.documents({
			from: r.documentEvents.documentId,
			to: r.documents.id,
		}),
	},
	documents: {
		author: r.one.user({
			from: r.documents.createdBy,
			to: r.user.id,
		}),
		comments: r.many.documentComments({
			from: r.documents.id,
			to: r.documentComments.documentId,
		}),
		events: r.many.documentEvents({
			from: r.documents.id,
			to: r.documentEvents.documentId,
		}),
		project: r.one.projects({
			from: r.documents.projectId,
			to: r.projects.id,
		}),
	},
	machineHeartbeats: {
		machine: r.one.machines({
			from: r.machineHeartbeats.machineId,
			to: r.machines.id,
		}),
		owner: r.one.user({
			from: r.machineHeartbeats.userId,
			to: r.user.id,
		}),
	},
	machineSandboxes: {
		machine: r.one.machines({
			from: r.machineSandboxes.machineId,
			to: r.machines.id,
		}),
		project: r.one.projects({
			from: r.machineSandboxes.projectId,
			to: r.projects.id,
		}),
		task: r.one.tasks({
			from: r.machineSandboxes.taskId,
			to: r.tasks.id,
		}),
	},
	machineSessions: {
		machine: r.one.machines({
			from: r.machineSessions.machineId,
			to: r.machines.id,
		}),
		owner: r.one.user({
			from: r.machineSessions.userId,
			to: r.user.id,
		}),
	},
	machines: {
		heartbeats: r.many.machineHeartbeats({
			from: r.machines.id,
			to: r.machineHeartbeats.machineId,
		}),
		logs: r.many.taskLogs({
			from: r.machines.id,
			to: r.taskLogs.machineId,
		}),
		owner: r.one.user({
			from: r.machines.userId,
			to: r.user.id,
		}),
		runs: r.many.taskRuns({
			from: r.machines.id,
			to: r.taskRuns.machineId,
		}),
		sandboxes: r.many.machineSandboxes({
			from: r.machines.id,
			to: r.machineSandboxes.machineId,
		}),
		sessions: r.many.machineSessions({
			from: r.machines.id,
			to: r.machineSessions.machineId,
		}),
	},
	projects: {
		creator: r.one.user({
			from: r.projects.createdBy,
			to: r.user.id,
		}),
		documents: r.many.documents({
			from: r.projects.id,
			to: r.documents.projectId,
		}),
		sandboxes: r.many.machineSandboxes({
			from: r.projects.id,
			to: r.machineSandboxes.projectId,
		}),
		signals: r.many.signals({
			from: r.projects.id,
			to: r.signals.projectId,
		}),
		tasks: r.many.tasks({
			from: r.projects.id,
			to: r.tasks.projectId,
		}),
	},
	signals: {
		owner: r.one.user({
			from: r.signals.userId,
			to: r.user.id,
		}),
		project: r.one.projects({
			from: r.signals.projectId,
			to: r.projects.id,
		}),
		tasks: r.many.tasks({
			from: r.signals.id,
			to: r.tasks.signalId,
		}),
	},
	taskLogs: {
		machine: r.one.machines({
			from: r.taskLogs.machineId,
			to: r.machines.id,
		}),
		task: r.one.tasks({
			from: r.taskLogs.taskId,
			to: r.tasks.id,
		}),
	},
	taskRuns: {
		machine: r.one.machines({
			from: r.taskRuns.machineId,
			to: r.machines.id,
		}),
		owner: r.one.user({
			from: r.taskRuns.userId,
			to: r.user.id,
		}),
		task: r.one.tasks({
			from: r.taskRuns.taskId,
			to: r.tasks.id,
		}),
	},
	tasks: {
		logs: r.many.taskLogs({
			from: r.tasks.id,
			to: r.taskLogs.taskId,
		}),
		owner: r.one.user({
			from: r.tasks.userId,
			to: r.user.id,
		}),
		project: r.one.projects({
			from: r.tasks.projectId,
			to: r.projects.id,
		}),
		runs: r.many.taskRuns({
			from: r.tasks.id,
			to: r.taskRuns.taskId,
		}),
		sandboxes: r.many.machineSandboxes({
			from: r.tasks.id,
			to: r.machineSandboxes.taskId,
		}),
		signal: r.one.signals({
			from: r.tasks.signalId,
			to: r.signals.id,
		}),
	},
	workspaceSettings: {
		owner: r.one.user({
			from: r.workspaceSettings.userId,
			to: r.user.id,
		}),
	},
}));
