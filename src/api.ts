import { invoke } from "@tauri-apps/api/core";

export interface PersonaFile {
  name: string;
  path: string;
  content: string;
}

export interface Persona {
  agent_id: string;
  files: PersonaFile[];
}

export interface SkillInfo {
  name: string;
  description: string;
  path: string;
  source?: string;
}

export interface CloudSkillInfo {
  id: string;
  name: string;
  description: string;
  tags: string[];
  version: string;
  source: string;
  homepage?: string;
  download_url?: string;
}

export interface MemoryEntry {
  filename: string;
  date: string;
  content: string;
}

export interface AgentInfo {
  id: string;
  has_workspace: boolean;
}

export interface PersonaSkillPack {
  required: string[];
  recommended: string[];
  optional: string[];
}

export interface PersonaMeta {
  id: string;
  name: string;
  description: string;
  emoji: string;
  author: string;
  source: string;
  is_active: boolean;
  has_memory: boolean;
  has_skills: boolean;
  skill_count: number;
  memory_count: number;
  snapshot_count: number;
  base_version: string;
  current_version: string;
  last_switched_at: string;
  tags: string[];
  skill_pack: PersonaSkillPack;
  declared_skill_count: number;
}

export interface CommunityPersona {
  id: string;
  name: string;
  description: string;
  emoji: string;
  author: string;
  repo_url: string;
  tags: string[];
}

export interface SnapshotInfo {
  id: string;
  persona_id: string;
  created_at: string;
  reason: string;
  has_memory: boolean;
  has_skills: boolean;
}

export const api = {
  // Agent management
  listAgents: () => invoke<AgentInfo[]>("list_agents"),

  // Persona file operations (backup/editor)
  readPersona: (agent: string) => invoke<Persona>("read_persona", { agent }),
  savePersonaFile: (agent: string, filename: string, content: string) =>
    invoke<void>("save_persona_file", { agent, filename, content }),

  // Skills
  listSkills: (agent: string) => invoke<SkillInfo[]>("list_skills", { agent }),
  listHubSkills: () => invoke<SkillInfo[]>("list_hub_skills"),
  fetchCloudSkills: () => invoke<CloudSkillInfo[]>("fetch_cloud_skills"),
  downloadCloudSkillToHub: (skillId: string) =>
    invoke<string>("download_cloud_skill_to_hub", { skillId }),
  downloadCloudSkillToPersona: (agent: string, skillId: string) =>
    invoke<string>("download_cloud_skill_to_persona", { agent, skillId }),
  installSkillFromHub: (agent: string, skillName: string) =>
    invoke<string>("install_skill_from_hub", { agent, skillName }),
  saveInstalledSkillToHub: (agent: string, skillName: string) =>
    invoke<void>("save_installed_skill_to_hub", { agent, skillName }),
  deleteHubSkill: (skillName: string) => invoke<void>("delete_hub_skill", { skillName }),
  deleteSkill: (agent: string, skillName: string) =>
    invoke<void>("delete_skill", { agent, skillName }),

  // Memory
  listMemories: (agent: string) => invoke<MemoryEntry[]>("list_memories", { agent }),
  readLongTermMemory: (agent: string) => invoke<string>("read_long_term_memory", { agent }),

  // Backup
  backupPersona: (agent: string, outputPath: string) =>
    invoke<string>("backup_persona", { agent, outputPath }),
  restorePersonaBackup: (agent: string, backupPath: string) =>
    invoke<void>("restore_persona_backup", { agent, backupPath }),

  // Config
  readConfig: () => invoke<string>("read_config"),
  saveConfig: (content: string) => invoke<void>("save_config", { content }),

  // Persona management
  listPersonas: (agent: string) => invoke<PersonaMeta[]>("list_personas", { agent }),
  createPersona: (params: {
    id: string;
    name: string;
    description: string;
    emoji: string;
    soulContent: string;
    identityContent: string;
    agentsContent: string;
    tags: string[];
    skillPack: PersonaSkillPack;
  }) => invoke<void>("create_persona", params),
  switchPersona: (agent: string, personaId: string) =>
    invoke<string[]>("switch_persona", { agent, personaId }),
  deletePersona: (agent: string, personaId: string) =>
    invoke<void>("delete_persona", { agent, personaId }),
  saveCurrentAsPersona: (
    agent: string,
    personaId: string,
    name: string,
    description: string,
    emoji: string,
    tags: string[] = [],
    skillPack: PersonaSkillPack = { required: [], recommended: [], optional: [] }
  ) => invoke<void>("save_current_as_persona", {
    agent,
    personaId,
    name,
    description,
    emoji,
    tags,
    skillPack,
  }),
  fetchCommunityPersonas: () => invoke<CommunityPersona[]>("fetch_community_personas"),
  downloadCommunityPersona: (agent: string, personaId: string, force: boolean = false) =>
    invoke<string>("download_community_persona", { agent, personaId, force }),
  checkPersonaExists: (personaId: string) =>
    invoke<boolean>("check_persona_exists", { personaId }),

  // Snapshots
  createSnapshot: (agent: string, personaId: string) =>
    invoke<string>("create_snapshot", { agent, personaId }),
  listSnapshots: (personaId: string) => invoke<SnapshotInfo[]>("list_snapshots", { personaId }),
  restoreSnapshot: (agent: string, personaId: string, snapshotId: string) =>
    invoke<void>("restore_snapshot", { agent, personaId, snapshotId }),
};
