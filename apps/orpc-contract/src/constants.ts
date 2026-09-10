/** Frozen v1 constants (protocol freeze before Phase 1; major change => UPGRADE_REQUIRED). */

export const PROTOCOL_VERSION = "v1";
export const UBUNTU_IMAGE = "docker.io/library/ubuntu:24.04";
export const TASK_CPUS = 1;
export const TASK_MEMORY_MB = 1024;
export const TASK_MAX_CPUS = 2;
export const TASK_MAX_MEMORY_MB = 2048;
export const HEARTBEAT_INTERVAL_S = 30;
export const HEARTBEAT_RETENTION_DAYS = 30;
/** Max log chunk per ws frame (bytes, UTF-8). */
export const LOG_FRAME_CAP_BYTES = 256 * 1024;
/** Pressure rule: sustained breach window. */
export const PRESSURE_THRESHOLD_PCT = 90;
export const PRESSURE_SUSTAINED_S = 10 * 60;
export const PRESSURE_ATTRIBUTION_PCT = 60;
export const PRESSURE_COOLDOWN_S = 10 * 60;
/** Server ws path (owned by uma repo; mirrored here as contract). */
export const MACHINES_WS_PATH = "/api/machines/ws";
/** Reserved machine names (mirror of uma slug.ts). */
export const RESERVED_MACHINE_NAMES = [
	"api",
	"settings",
	"~",
	"admin",
	"login",
	"signup",
	"new",
	"edit",
	"machines",
] as const;
