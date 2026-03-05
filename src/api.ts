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
  }) => invoke<void>("create_persona", params),
  switchPersona: (agent: string, personaId: string) =>
    invoke<void>("switch_persona", { agent, personaId }),
  deletePersona: (agent: string, personaId: string) =>
    invoke<void>("delete_persona", { agent, personaId }),
  saveCurrentAsPersona: (
    agent: string,
    personaId: string,
    name: string,
    description: string,
    emoji: string
  ) => invoke<void>("save_current_as_persona", { agent, personaId, name, description, emoji }),
  fetchCommunityPersonas: () => invoke<CommunityPersona[]>("fetch_community_personas"),
  downloadCommunityPersona: (personaId: string, force: boolean = false) =>
    invoke<string>("download_community_persona", { personaId, force }),
  checkPersonaExists: (personaId: string) =>
    invoke<boolean>("check_persona_exists", { personaId }),

  // Snapshots
  createSnapshot: (personaId: string) => invoke<string>("create_snapshot", { personaId }),
  listSnapshots: (personaId: string) => invoke<SnapshotInfo[]>("list_snapshots", { personaId }),
  restoreSnapshot: (personaId: string, snapshotId: string) =>
    invoke<void>("restore_snapshot", { personaId, snapshotId }),
};
