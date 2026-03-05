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

export const api = {
  listAgents: () => invoke<AgentInfo[]>("list_agents"),
  readPersona: (agent: string) => invoke<Persona>("read_persona", { agent }),
  savePersonaFile: (agent: string, filename: string, content: string) =>
    invoke<void>("save_persona_file", { agent, filename, content }),
  listSkills: (agent: string) => invoke<SkillInfo[]>("list_skills", { agent }),
  deleteSkill: (agent: string, skillName: string) =>
    invoke<void>("delete_skill", { agent, skillName }),
  listMemories: (agent: string) =>
    invoke<MemoryEntry[]>("list_memories", { agent }),
  readLongTermMemory: (agent: string) =>
    invoke<string>("read_long_term_memory", { agent }),
  backupPersona: (agent: string, outputPath: string) =>
    invoke<string>("backup_persona", { agent, outputPath }),
  restorePersona: (agent: string, backupPath: string) =>
    invoke<void>("restore_persona", { agent, backupPath }),
  readConfig: () => invoke<string>("read_config"),
};
