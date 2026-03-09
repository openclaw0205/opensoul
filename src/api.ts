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

export interface ClawHubSkillInfo {
  id: string;
  name: string;
  description: string;
  tags: string[];
  version: string;
  source: string;
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

export interface SnapshotListItem extends SnapshotInfo {
  persona_name: string;
  persona_source: string;
  is_active_persona: boolean;
}

export const api = {
  listAgents: () => invoke<AgentInfo[]>("list_agents"),

  readPersona: (agent: string) => invoke<Persona>("read_persona", { agent }),
  savePersonaFile: (agent: string, filename: string, content: string) =>
    invoke<void>("save_persona_file", { agent, filename, content }),

  listSkills: (agent: string) => invoke<SkillInfo[]>("list_skills", { agent }),
  clawhubStatus: () => invoke<boolean>("clawhub_status"),
  clawhubExplore: () => invoke<ClawHubSkillInfo[]>("clawhub_explore"),
  clawhubSearch: (query: string) => invoke<ClawHubSkillInfo[]>("clawhub_search", { query }),
  clawhubInstall: (agent: string, skillId: string) =>
    invoke<void>("clawhub_install", { agent, skillId }),
  clawhubUpdateAll: (agent: string) => invoke<void>("clawhub_update_all", { agent }),
  deleteSkill: (agent: string, skillName: string) =>
    invoke<void>("delete_skill", { agent, skillName }),

  listMemories: (agent: string) => invoke<MemoryEntry[]>("list_memories", { agent }),
  readLongTermMemory: (agent: string) => invoke<string>("read_long_term_memory", { agent }),

  backupPersona: (agent: string, outputPath: string) =>
    invoke<string>("backup_persona", { agent, outputPath }),
  restorePersonaBackup: (agent: string, backupPath: string) =>
    invoke<void>("restore_persona_backup", { agent, backupPath }),

  readConfig: () => invoke<string>("read_config"),
  saveConfig: (content: string) => invoke<void>("save_config", { content }),

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

  createSnapshot: (agent: string, personaId: string) =>
    invoke<string>("create_snapshot", { agent, personaId }),
  listAllSnapshots: (agent: string) => invoke<SnapshotListItem[]>("list_all_snapshots", { agent }),
  listSnapshots: (personaId: string) => invoke<SnapshotInfo[]>("list_snapshots", { personaId }),
  restoreSnapshot: (agent: string, personaId: string, snapshotId: string) =>
    invoke<void>("restore_snapshot", { agent, personaId, snapshotId }),
};
