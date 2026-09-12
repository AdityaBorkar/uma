import type { SkillRef } from "./desired.ts";

/**
 * Declared skill record. Re-exported here so future installer code and the
 * `SkillsKey` converge on one shape. Storage only: `source` is the verbatim
 * skills.sh spec (`owner/skill` or pack URL), `version` is an optional pin
 * (tag/SHA) interpreted later by the installer.
 */
export type { SkillRef };

/** Skill observed on disk. Version is populated when the installer can detect it. */
export interface InstalledSkill {
	name: string;
	version?: string | undefined;
}

/**
 * Installer port for skills.sh-backed skills. Interface only — no
 * implementation yet. Installation, pinning, and upgrades are handled later;
 * `SkillsKey` currently only stores the declared list.
 */
export interface SkillsInstaller {
	install(skill: SkillRef): Promise<void>;
	list(): Promise<InstalledSkill[]>;
	remove(name: string): Promise<void>;
	update(name: string): Promise<void>;
}
