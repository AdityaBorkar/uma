// Canonical schemas live in `@uma/orpc-contract` — this file re-exports them
// under the pre-contract names so existing `#/schemas/schema.ts` imports keep
// working. New code should import from `@uma/orpc-contract` directly
// (canonical `*InputSchema` names + inferred types).

import type {
	PromptTemplateCreateInput as PromptTemplateCreateInputType,
	PromptTemplateListInput as PromptTemplateListInputType,
	PromptTemplateUpdateInput as PromptTemplateUpdateInputType,
	SubagentCreateInput as SubagentCreateInputType,
	SubagentListInput as SubagentListInputType,
	SubagentUpdateInput as SubagentUpdateInputType,
} from "@uma/orpc-contract";
import {
	AgentCreateInputSchema,
	AgentListInputSchema,
	AgentUpdateInputSchema,
	ConnectionDisconnectInputSchema,
	ConnectionGetAuthUrlInputSchema,
	ConnectionGetInputSchema,
	DeviceApproveInputSchema,
	DocumentCreateInputSchema,
	DocumentListInputSchema,
	DocumentNumberInputSchema,
	DocumentUpdateInputSchema,
	MachineHeartbeatListInputSchema,
	ProjectCreateInputSchema,
	ProjectGetBySlugInputSchema,
	ProjectListInputSchema,
	ProjectUpdateInputSchema,
	PromptTemplateCreateInputSchema,
	PromptTemplateListInputSchema,
	PromptTemplateUpdateInputSchema,
	SubagentCreateInputSchema,
	SubagentListInputSchema,
	SubagentUpdateInputSchema,
	TaskCreateInputSchema,
	TaskListInputSchema,
	TaskLogsListInputSchema,
	TaskRunListInputSchema,
	TaskUpdateStatusInputSchema,
} from "@uma/orpc-contract";

export type {
	AgentStatus,
	DocumentKind,
	DocumentMetaField,
	DocumentState,
	ProjectStatus,
	RunStatus,
	SubagentPermission,
	SubagentPermissions,
	TaskStatus,
} from "@uma/orpc-contract";
export {
	AGENT_STATUS_VALUES,
	AgentNameSchema,
	AgentStatusEnum,
	ConnectionProviderEnum,
	DOCUMENT_KIND_VALUES,
	DOCUMENT_KINDS,
	DOCUMENT_STATE_VALUES,
	DocumentKindEnum,
	DocumentStateEnum,
	documentMetaFields,
	documentMetaSchema,
	GITHUB_REPO_FULL_NAME_RE,
	KNOWN_AGENT_NAMES,
	kindLabel,
	PROJECT_SLUG_MAX,
	PROJECT_SLUG_MIN,
	PROJECT_SLUG_RE,
	PROJECT_STATUS_VALUES,
	ProjectSchema,
	ProjectStatusEnum,
	PromptTemplateNameSchema,
	RUN_STATUS_VALUES,
	RunStatusEnum,
	SUBAGENT_PERMISSION_KEYS,
	SUBAGENT_PERMISSION_VALUES,
	SubagentColorSchema,
	SubagentNameSchema,
	SubagentPermissionEnum,
	SubagentPermissionsSchema,
	TASK_STATUS_VALUES,
	TaskStatusEnum,
} from "@uma/orpc-contract";

// Canonical `*InputSchema` names, also reachable via this path for migration.
export {
	AgentCreateInputSchema,
	AgentListInputSchema,
	AgentUpdateInputSchema,
	ConnectionDisconnectInputSchema,
	ConnectionGetAuthUrlInputSchema,
	ConnectionGetInputSchema,
	DeviceApproveInputSchema,
	DocumentCreateInputSchema,
	DocumentListInputSchema,
	DocumentNumberInputSchema,
	DocumentUpdateInputSchema,
	MachineHeartbeatListInputSchema,
	ProjectCreateInputSchema,
	ProjectGetBySlugInputSchema,
	ProjectListInputSchema,
	ProjectUpdateInputSchema,
	PromptTemplateCreateInputSchema,
	PromptTemplateListInputSchema,
	PromptTemplateUpdateInputSchema,
	SubagentCreateInputSchema,
	SubagentListInputSchema,
	SubagentUpdateInputSchema,
	TaskCreateInputSchema,
	TaskListInputSchema,
	TaskLogsListInputSchema,
	TaskRunListInputSchema,
	TaskUpdateStatusInputSchema,
};

// Backwards-compatible aliases for the pre-contract names (bare `*Input`
// consts).
export const ProjectCreateInput = ProjectCreateInputSchema;
export const ProjectUpdateInput = ProjectUpdateInputSchema;
export const ProjectGetBySlugInput = ProjectGetBySlugInputSchema;
export const ProjectListInput = ProjectListInputSchema;
export const ConnectionGetAuthUrlInput = ConnectionGetAuthUrlInputSchema;
export const ConnectionGetInput = ConnectionGetInputSchema;
export const ConnectionDisconnectInput = ConnectionDisconnectInputSchema;
export const TaskCreateInput = TaskCreateInputSchema;
export const TaskUpdateStatusInput = TaskUpdateStatusInputSchema;
export const TaskListInput = TaskListInputSchema;
export const DocumentCreateInput = DocumentCreateInputSchema;
export const DocumentUpdateInput = DocumentUpdateInputSchema;
export const DocumentListInput = DocumentListInputSchema;
export const DocumentNumberInput = DocumentNumberInputSchema;
export const AgentCreateInput = AgentCreateInputSchema;
export const AgentUpdateInput = AgentUpdateInputSchema;
export const AgentListInput = AgentListInputSchema;
export const SubagentCreateInput = SubagentCreateInputSchema;
export type SubagentCreateInput = SubagentCreateInputType;
export const SubagentUpdateInput = SubagentUpdateInputSchema;
export type SubagentUpdateInput = SubagentUpdateInputType;
export const SubagentListInput = SubagentListInputSchema;
export type SubagentListInput = SubagentListInputType;
export const PromptTemplateCreateInput = PromptTemplateCreateInputSchema;
export type PromptTemplateCreateInput = PromptTemplateCreateInputType;
export const PromptTemplateUpdateInput = PromptTemplateUpdateInputSchema;
export type PromptTemplateUpdateInput = PromptTemplateUpdateInputType;
export const PromptTemplateListInput = PromptTemplateListInputSchema;
export type PromptTemplateListInput = PromptTemplateListInputType;
export const TaskRunListInput = TaskRunListInputSchema;
export const TaskLogsListInput = TaskLogsListInputSchema;
export const MachineHeartbeatListInput = MachineHeartbeatListInputSchema;
export const DeviceApproveInput = DeviceApproveInputSchema;
