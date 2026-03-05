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
    if agent == "main" {
        openclaw_dir().join("workspace")
    } else {
        openclaw_dir().join("agents").join(agent).join("workspace")
    }
}

/// Get personas base directory
fn personas_dir() -> PathBuf {
    openclaw_dir().join("personas")
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

#[derive(Serialize, Deserialize, Clone)]
pub struct PersonaMeta {
    pub id: String,
    pub name: String,
    pub description: String,
    pub emoji: String,
    pub author: String,
    pub is_active: bool,
    pub has_memory: bool,
    pub has_skills: bool,
    pub skill_count: usize,
    pub memory_count: usize,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CommunityPersona {
    pub id: String,
    pub name: String,
    pub description: String,
    pub emoji: String,
    pub author: String,
    pub repo_url: String,
    pub tags: Vec<String>,
}

// ============================================================
// Persona Management Commands
// ============================================================

/// List all local personas
#[command]
fn list_personas(agent: &str) -> Result<Vec<PersonaMeta>, String> {
    let base = personas_dir();
    if !base.exists() {
        fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    }

    let ws = workspace_dir(agent);
    // Detect active persona by reading .active-persona marker
    let active_marker = ws.join(".active-persona");
    let active_id = if active_marker.exists() {
        fs::read_to_string(&active_marker).unwrap_or_default().trim().to_string()
    } else {
        String::new()
    };

    let mut personas = vec![];
    let entries = fs::read_dir(&base).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let id = entry.file_name().to_string_lossy().to_string();
        let dir = entry.path();

        // Read meta.json if exists, otherwise derive from files
        let meta_path = dir.join("meta.json");
        let (name, description, emoji, author) = if meta_path.exists() {
            let raw = fs::read_to_string(&meta_path).unwrap_or_default();
            let v: serde_json::Value = serde_json::from_str(&raw).unwrap_or_default();
            (
                v["name"].as_str().unwrap_or(&id).to_string(),
                v["description"].as_str().unwrap_or("").to_string(),
                v["emoji"].as_str().unwrap_or("🤖").to_string(),
                v["author"].as_str().unwrap_or("").to_string(),
            )
        } else {
            (id.clone(), String::new(), "🤖".to_string(), String::new())
        };

        let memory_dir = dir.join("memory");
        let memory_count = if memory_dir.exists() {
            fs::read_dir(&memory_dir).map(|r| r.count()).unwrap_or(0)
        } else {
            0
        };

        let skills_dir = dir.join("skills");
        let skill_count = if skills_dir.exists() {
            fs::read_dir(&skills_dir).map(|r| r.count()).unwrap_or(0)
        } else {
            0
        };

        personas.push(PersonaMeta {
            is_active: id == active_id,
            id,
            name,
            description,
            emoji,
            author,
            has_memory: memory_count > 0 || dir.join("MEMORY.md").exists(),
            has_skills: skill_count > 0,
            skill_count,
            memory_count,
        });
    }

    // Sort: active first, then alphabetical
    personas.sort_by(|a, b| {
        b.is_active.cmp(&a.is_active).then(a.name.cmp(&b.name))
    });

    Ok(personas)
}

/// Create a new persona
#[command]
fn create_persona(
    id: String,
    name: String,
    description: String,
    emoji: String,
    soul_content: String,
    identity_content: String,
    agents_content: String,
) -> Result<(), String> {
    let dir = personas_dir().join(&id);
    if dir.exists() {
        return Err(format!("Persona '{}' already exists", id));
    }
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(dir.join("memory")).map_err(|e| e.to_string())?;
    fs::create_dir_all(dir.join("skills")).map_err(|e| e.to_string())?;

    // Write meta.json
    let meta = serde_json::json!({
        "name": name,
        "description": description,
        "emoji": emoji,
        "author": "local",
        "created": chrono_now(),
    });
    fs::write(dir.join("meta.json"), serde_json::to_string_pretty(&meta).unwrap())
        .map_err(|e| e.to_string())?;

    // Write persona files
    if !soul_content.is_empty() {
        fs::write(dir.join("SOUL.md"), &soul_content).map_err(|e| e.to_string())?;
    }
    if !identity_content.is_empty() {
        fs::write(dir.join("IDENTITY.md"), &identity_content).map_err(|e| e.to_string())?;
    }
    if !agents_content.is_empty() {
        fs::write(dir.join("AGENTS.md"), &agents_content).map_err(|e| e.to_string())?;
    }
    fs::write(dir.join("MEMORY.md"), "").map_err(|e| e.to_string())?;
    fs::write(dir.join("USER.md"), "").map_err(|e| e.to_string())?;

    Ok(())
}

/// Switch active persona: save current workspace → persona dir, then load selected persona → workspace
#[command]
fn switch_persona(agent: String, persona_id: String) -> Result<(), String> {
    let ws = workspace_dir(&agent);
    let target_dir = personas_dir().join(&persona_id);

    if !target_dir.exists() {
        return Err(format!("Persona '{}' not found", persona_id));
    }

    // 1. Save current workspace to its persona dir (if there's an active one)
    let active_marker = ws.join(".active-persona");
    if active_marker.exists() {
        let current_id = fs::read_to_string(&active_marker).unwrap_or_default().trim().to_string();
        if !current_id.is_empty() && current_id != persona_id {
            let current_dir = personas_dir().join(&current_id);
            if current_dir.exists() {
                save_workspace_to_persona(&ws, &current_dir)?;
            }
        }
    }

    // 2. Load target persona into workspace
    load_persona_to_workspace(&target_dir, &ws)?;

    // 3. Update active marker
    fs::write(&active_marker, &persona_id).map_err(|e| e.to_string())?;

    Ok(())
}

/// Delete a persona
#[command]
fn delete_persona(agent: &str, persona_id: String) -> Result<(), String> {
    let dir = personas_dir().join(&persona_id);
    if !dir.exists() {
        return Err(format!("Persona '{}' not found", persona_id));
    }

    // Don't allow deleting active persona
    let ws = workspace_dir(agent);
    let active_marker = ws.join(".active-persona");
    if active_marker.exists() {
        let active_id = fs::read_to_string(&active_marker).unwrap_or_default().trim().to_string();
        if active_id == persona_id {
            return Err("Cannot delete the active persona. Switch to another one first.".to_string());
        }
    }

    fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(())
}

/// Save current workspace as a new persona (snapshot)
#[command]
fn save_current_as_persona(
    agent: String,
    persona_id: String,
    name: String,
    description: String,
    emoji: String,
) -> Result<(), String> {
    let ws = workspace_dir(&agent);
    let dir = personas_dir().join(&persona_id);

    if dir.exists() {
        // Overwrite existing
        fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    save_workspace_to_persona(&ws, &dir)?;

    // Write/overwrite meta.json
    let meta = serde_json::json!({
        "name": name,
        "description": description,
        "emoji": emoji,
        "author": "local",
        "created": chrono_now(),
    });
    fs::write(dir.join("meta.json"), serde_json::to_string_pretty(&meta).unwrap())
        .map_err(|e| e.to_string())?;

    // Update active marker
    let active_marker = ws.join(".active-persona");
    fs::write(&active_marker, &persona_id).map_err(|e| e.to_string())?;

    Ok(())
}

/// Fetch community personas index from GitHub
#[command]
async fn fetch_community_personas() -> Result<Vec<CommunityPersona>, String> {
    let url = "https://raw.githubusercontent.com/openclaw0205/openclaw-personas/main/index.json";

    let client = reqwest::Client::new();
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Failed to fetch community index: {}", resp.status()));
    }

    let personas: Vec<CommunityPersona> = resp.json().await.map_err(|e| e.to_string())?;
    Ok(personas)
}

/// Download a community persona
#[command]
async fn download_community_persona(persona_id: String) -> Result<(), String> {
    let base_url = format!(
        "https://raw.githubusercontent.com/openclaw0205/openclaw-personas/main/personas/{}",
        persona_id
    );

    let dir = personas_dir().join(&persona_id);
    if dir.exists() {
        return Err(format!("Persona '{}' already exists locally", persona_id));
    }
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(dir.join("memory")).map_err(|e| e.to_string())?;
    fs::create_dir_all(dir.join("skills")).map_err(|e| e.to_string())?;

    let client = reqwest::Client::new();
    let files = ["meta.json", "SOUL.md", "IDENTITY.md", "AGENTS.md"];
    for file in &files {
        let url = format!("{}/{}", base_url, file);
        match client.get(&url).send().await {
            Ok(resp) if resp.status().is_success() => {
                let content = resp.text().await.map_err(|e| e.to_string())?;
                fs::write(dir.join(file), &content).map_err(|e| e.to_string())?;
            }
            _ => {
                // Optional files, skip if not found
                if *file == "meta.json" {
                    let meta = serde_json::json!({
                        "name": persona_id,
                        "description": "",
                        "emoji": "🤖",
                        "author": "community",
                    });
                    fs::write(dir.join("meta.json"), serde_json::to_string_pretty(&meta).unwrap())
                        .map_err(|e| e.to_string())?;
                }
            }
        }
    }

    // Create empty memory/user files
    fs::write(dir.join("MEMORY.md"), "").map_err(|e| e.to_string())?;
    fs::write(dir.join("USER.md"), "").map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================
// Helper functions
// ============================================================

fn chrono_now() -> String {
    // Simple timestamp without chrono dependency
    let output = std::process::Command::new("date")
        .args(["+%Y-%m-%dT%H:%M:%S"])
        .output()
        .ok();
    output
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_default()
        .trim()
        .to_string()
}

/// Copy persona files from workspace to persona directory
fn save_workspace_to_persona(ws: &PathBuf, persona_dir: &PathBuf) -> Result<(), String> {
    let files = ["SOUL.md", "IDENTITY.md", "USER.md", "AGENTS.md", "MEMORY.md"];
    for file in &files {
        let src = ws.join(file);
        if src.exists() {
            fs::copy(&src, persona_dir.join(file)).map_err(|e| e.to_string())?;
        }
    }

    // Sync memory directory
    let mem_src = ws.join("memory");
    let mem_dst = persona_dir.join("memory");
    if mem_src.exists() {
        if mem_dst.exists() {
            fs::remove_dir_all(&mem_dst).map_err(|e| e.to_string())?;
        }
        copy_dir_recursive(&mem_src, &mem_dst)?;
    }

    // Sync skills directory
    let skills_src = ws.join("skills");
    let skills_dst = persona_dir.join("skills");
    if skills_src.exists() {
        if skills_dst.exists() {
            fs::remove_dir_all(&skills_dst).map_err(|e| e.to_string())?;
        }
        copy_dir_recursive(&skills_src, &skills_dst)?;
    }

    Ok(())
}

/// Load persona files from persona directory to workspace
fn load_persona_to_workspace(persona_dir: &PathBuf, ws: &PathBuf) -> Result<(), String> {
    let files = ["SOUL.md", "IDENTITY.md", "USER.md", "AGENTS.md", "MEMORY.md"];
    for file in &files {
        let src = persona_dir.join(file);
        if src.exists() {
            fs::copy(&src, ws.join(file)).map_err(|e| e.to_string())?;
        } else {
            // Write empty file if persona doesn't have it
            fs::write(ws.join(file), "").map_err(|e| e.to_string())?;
        }
    }

    // Sync memory
    let mem_src = persona_dir.join("memory");
    let mem_dst = ws.join("memory");
    if mem_src.exists() {
        if mem_dst.exists() {
            fs::remove_dir_all(&mem_dst).map_err(|e| e.to_string())?;
        }
        copy_dir_recursive(&mem_src, &mem_dst)?;
    }

    // Sync skills
    let skills_src = persona_dir.join("skills");
    let skills_dst = ws.join("skills");
    if skills_src.exists() {
        if skills_dst.exists() {
            fs::remove_dir_all(&skills_dst).map_err(|e| e.to_string())?;
        }
        copy_dir_recursive(&skills_src, &skills_dst)?;
    }

    Ok(())
}

/// Recursively copy a directory
fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    let entries = fs::read_dir(src).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

// ============================================================
// Original Commands
// ============================================================

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

#[command]
fn save_persona_file(agent: String, filename: String, content: String) -> Result<(), String> {
    let ws = workspace_dir(&agent);
    let path = ws.join(&filename);
    fs::write(&path, &content).map_err(|e| e.to_string())?;
    Ok(())
}

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

#[command]
fn delete_skill(agent: String, skill_name: String) -> Result<(), String> {
    let ws = workspace_dir(&agent);
    let skill_path = ws.join("skills").join(&skill_name);
    if skill_path.exists() {
        fs::remove_dir_all(&skill_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

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

#[command]
fn backup_persona(agent: String, output_path: String) -> Result<String, String> {
    let ws = workspace_dir(&agent);
    if !ws.exists() {
        return Err("Workspace not found".to_string());
    }
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

#[command]
fn read_config() -> Result<String, String> {
    let config_path = openclaw_dir().join("openclaw.json");
    if config_path.exists() {
        fs::read_to_string(&config_path).map_err(|e| e.to_string())
    } else {
        Ok("{}".to_string())
    }
}

/// Save openclaw config
#[command]
fn save_config(content: String) -> Result<(), String> {
    let _: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    let config_path = openclaw_dir().join("openclaw.json");
    fs::write(&config_path, &content).map_err(|e| e.to_string())?;
    Ok(())
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
            save_config,
            // Persona management
            list_personas,
            create_persona,
            switch_persona,
            delete_persona,
            save_current_as_persona,
            fetch_community_personas,
            download_community_persona,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
