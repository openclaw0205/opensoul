use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::command;

/// Get the .openclaw base directory
fn openclaw_dir() -> PathBuf {
    dirs::home_dir()
        .expect("Cannot find home directory")
        .join(".openclaw")
}

/// Get workspace directory for a given agent
fn workspace_dir(agent: &str) -> PathBuf {
    // Default agent uses the shared workspace
    if agent == "main" {
        openclaw_dir().join("workspace")
    } else {
        openclaw_dir().join("agents").join(agent).join("workspace")
    }
}

// ============================================================
// Data structures
// ============================================================

#[derive(Serialize, Deserialize, Clone)]
pub struct PersonaFile {
    pub name: String,
    pub path: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Persona {
    pub agent_id: String,
    pub files: Vec<PersonaFile>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    pub path: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MemoryEntry {
    pub filename: String,
    pub date: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AgentInfo {
    pub id: String,
    pub has_workspace: bool,
}

// ============================================================
// Commands
// ============================================================

/// List all agents
#[command]
fn list_agents() -> Result<Vec<AgentInfo>, String> {
    let agents_dir = openclaw_dir().join("agents");
    if !agents_dir.exists() {
        return Ok(vec![]);
    }
    let mut agents = vec![];
    let entries = fs::read_dir(&agents_dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            let id = entry.file_name().to_string_lossy().to_string();
            let has_workspace = workspace_dir(&id).exists();
            agents.push(AgentInfo { id, has_workspace });
        }
    }
    Ok(agents)
}

/// Read a persona (SOUL.md, IDENTITY.md, USER.md, AGENTS.md)
#[command]
fn read_persona(agent: String) -> Result<Persona, String> {
    let ws = workspace_dir(&agent);
    let persona_files = ["SOUL.md", "IDENTITY.md", "USER.md", "AGENTS.md"];
    let mut files = vec![];

    for name in &persona_files {
        let path = ws.join(name);
        let content = if path.exists() {
            fs::read_to_string(&path).unwrap_or_default()
        } else {
            String::new()
        };
        files.push(PersonaFile {
            name: name.to_string(),
            path: path.to_string_lossy().to_string(),
            content,
        });
    }

    Ok(Persona {
        agent_id: agent,
        files,
    })
}

/// Save a persona file
#[command]
fn save_persona_file(agent: String, filename: String, content: String) -> Result<(), String> {
    let ws = workspace_dir(&agent);
    let path = ws.join(&filename);
    fs::write(&path, &content).map_err(|e| e.to_string())?;
    Ok(())
}

/// List installed skills
#[command]
fn list_skills(agent: String) -> Result<Vec<SkillInfo>, String> {
    let ws = workspace_dir(&agent);
    let skills_dir = ws.join("skills");
    if !skills_dir.exists() {
        return Ok(vec![]);
    }

    let mut skills = vec![];
    let entries = fs::read_dir(&skills_dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            let name = entry.file_name().to_string_lossy().to_string();
            let skill_md = entry.path().join("SKILL.md");
            let description = if skill_md.exists() {
                let content = fs::read_to_string(&skill_md).unwrap_or_default();
                // Extract description from frontmatter
                content
                    .lines()
                    .find(|l| l.starts_with("description:"))
                    .map(|l| l.trim_start_matches("description:").trim().to_string())
                    .unwrap_or_else(|| name.clone())
            } else {
                name.clone()
            };
            skills.push(SkillInfo {
                name,
                description,
                path: entry.path().to_string_lossy().to_string(),
            });
        }
    }
    Ok(skills)
}

/// Delete a skill
#[command]
fn delete_skill(agent: String, skill_name: String) -> Result<(), String> {
    let ws = workspace_dir(&agent);
    let skill_path = ws.join("skills").join(&skill_name);
    if skill_path.exists() {
        fs::remove_dir_all(&skill_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// List memory files
#[command]
fn list_memories(agent: String) -> Result<Vec<MemoryEntry>, String> {
    let ws = workspace_dir(&agent);
    let memory_dir = ws.join("memory");
    if !memory_dir.exists() {
        return Ok(vec![]);
    }

    let mut memories = vec![];
    let entries = fs::read_dir(&memory_dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let filename = entry.file_name().to_string_lossy().to_string();
        if filename.ends_with(".md") {
            let content = fs::read_to_string(entry.path()).unwrap_or_default();
            let date = filename.trim_end_matches(".md").to_string();
            memories.push(MemoryEntry {
                filename,
                date,
                content,
            });
        }
    }
    memories.sort_by(|a, b| b.date.cmp(&a.date));
    Ok(memories)
}

/// Read MEMORY.md (long-term memory)
#[command]
fn read_long_term_memory(agent: String) -> Result<String, String> {
    let ws = workspace_dir(&agent);
    let path = ws.join("MEMORY.md");
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| e.to_string())
    } else {
        Ok(String::new())
    }
}

/// Backup persona to a zip file
#[command]
fn backup_persona(agent: String, output_path: String) -> Result<String, String> {
    let ws = workspace_dir(&agent);
    if !ws.exists() {
        return Err("Workspace not found".to_string());
    }

    // Use tar + gzip for backup
    let output = std::process::Command::new("tar")
        .args([
            "-czf",
            &output_path,
            "-C",
            ws.parent().unwrap().to_str().unwrap(),
            ws.file_name().unwrap().to_str().unwrap(),
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(output_path)
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Restore persona from a backup
#[command]
fn restore_persona(agent: String, backup_path: String) -> Result<(), String> {
    let ws = workspace_dir(&agent);
    let parent = ws.parent().ok_or("Invalid path")?;

    let output = std::process::Command::new("tar")
        .args(["-xzf", &backup_path, "-C", parent.to_str().unwrap()])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Read openclaw config
#[command]
fn read_config() -> Result<String, String> {
    let config_path = openclaw_dir().join("openclaw.json");
    if config_path.exists() {
        fs::read_to_string(&config_path).map_err(|e| e.to_string())
    } else {
        Ok("{}".to_string())
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_agents,
            read_persona,
            save_persona_file,
            list_skills,
            delete_skill,
            list_memories,
            read_long_term_memory,
            backup_persona,
            restore_persona,
            read_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
