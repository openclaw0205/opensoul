use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::command;

// Max snapshots per persona
const MAX_SNAPSHOTS: usize = 20;

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

/// Validate ID: only alphanumeric, hyphens, underscores
fn validate_id(id: &str) -> Result<(), String> {
    if id.is_empty() {
        return Err("ID cannot be empty".to_string());
    }
    if !id
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    {
        return Err(
            "ID can only contain letters, numbers, hyphens, and underscores".to_string(),
        );
    }
    Ok(())
}

/// Validate filename: only specific known files allowed
fn validate_persona_filename(name: &str) -> Result<(), String> {
    let allowed = [
        "SOUL.md",
        "IDENTITY.md",
        "USER.md",
        "AGENTS.md",
        "MEMORY.md",
    ];
    if allowed.contains(&name) {
        Ok(())
    } else {
        Err(format!("Filename '{}' is not allowed", name))
    }
}

/// Expand ~ in paths
fn expand_path(path: &str) -> PathBuf {
    if path.starts_with("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(&path[2..]);
        }
    }
    PathBuf::from(path)
}

/// Compact timestamp for snapshot IDs
fn timestamp_compact() -> String {
    std::process::Command::new("date")
        .args(["+%Y%m%dT%H%M%S"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_else(|| "unknown".to_string())
        .trim()
        .to_string()
}

/// Human-readable timestamp
fn timestamp_human() -> String {
    std::process::Command::new("date")
        .args(["+%Y-%m-%dT%H:%M:%S"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_default()
        .trim()
        .to_string()
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
    pub source: String,
    pub is_active: bool,
    pub has_memory: bool,
    pub has_skills: bool,
    pub skill_count: usize,
    pub memory_count: usize,
    pub snapshot_count: usize,
    pub base_version: String,
    pub current_version: String,
    pub last_switched_at: String,
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

#[derive(Serialize, Deserialize, Clone)]
pub struct SnapshotInfo {
    pub id: String,
    pub persona_id: String,
    pub created_at: String,
    pub reason: String,
    pub has_memory: bool,
    pub has_skills: bool,
}

// ============================================================
// Directory helpers
// ============================================================

fn persona_current_dir(persona_id: &str) -> PathBuf {
    personas_dir().join(persona_id).join("current")
}

fn persona_base_dir(persona_id: &str) -> PathBuf {
    personas_dir().join(persona_id).join("base")
}

fn persona_snapshots_dir(persona_id: &str) -> PathBuf {
    personas_dir().join(persona_id).join("snapshots")
}

fn read_persona_meta_json(persona_id: &str) -> serde_json::Value {
    let path = personas_dir().join(persona_id).join("meta.json");
    if path.exists() {
        let raw = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&raw).unwrap_or_default()
    } else {
        serde_json::json!({})
    }
}

fn write_persona_meta_json(persona_id: &str, meta: &serde_json::Value) -> Result<(), String> {
    let path = personas_dir().join(persona_id).join("meta.json");
    fs::write(
        &path,
        serde_json::to_string_pretty(meta).unwrap_or_default(),
    )
    .map_err(|e| e.to_string())
}

/// Create a snapshot of persona's current state
fn create_snapshot_impl(persona_id: &str, reason: &str) -> Result<String, String> {
    let current = persona_current_dir(persona_id);
    if !current.exists() {
        return Err(format!("Persona '{}' has no current state", persona_id));
    }

    let snap_dir = persona_snapshots_dir(persona_id);
    fs::create_dir_all(&snap_dir).map_err(|e| e.to_string())?;

    let snap_id = timestamp_compact();
    let snap_path = snap_dir.join(&snap_id);
    copy_dir_recursive(&current, &snap_path)?;

    // Write snapshot meta
    let snap_meta = serde_json::json!({
        "id": snap_id,
        "persona_id": persona_id,
        "created_at": timestamp_human(),
        "reason": reason,
    });
    fs::write(
        snap_path.join(".snapshot-meta.json"),
        serde_json::to_string_pretty(&snap_meta).unwrap(),
    )
    .map_err(|e| e.to_string())?;

    // Update persona meta
    let mut meta = read_persona_meta_json(persona_id);
    let count = meta["snapshot_count"].as_u64().unwrap_or(0) + 1;
    meta["snapshot_count"] = serde_json::json!(count);
    meta["last_backup_at"] = serde_json::json!(timestamp_human());
    let ver = meta["current_version"].as_u64().unwrap_or(0) + 1;
    meta["current_version"] = serde_json::json!(ver);
    write_persona_meta_json(persona_id, &meta)?;

    // Enforce max snapshots
    enforce_snapshot_limit(persona_id)?;

    Ok(snap_id)
}

fn enforce_snapshot_limit(persona_id: &str) -> Result<(), String> {
    let snap_dir = persona_snapshots_dir(persona_id);
    if !snap_dir.exists() {
        return Ok(());
    }
    let mut entries: Vec<_> = fs::read_dir(&snap_dir)
        .map_err(|e| e.to_string())?
        .flatten()
        .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
        .collect();
    if entries.len() <= MAX_SNAPSHOTS {
        return Ok(());
    }
    entries.sort_by_key(|e| e.file_name());
    let to_remove = entries.len() - MAX_SNAPSHOTS;
    for entry in entries.iter().take(to_remove) {
        let _ = fs::remove_dir_all(entry.path());
    }
    Ok(())
}

/// Migrate legacy flat persona to current/ structure
fn migrate_legacy_persona(persona_id: &str) -> Result<(), String> {
    let root = personas_dir().join(persona_id);
    let current = persona_current_dir(persona_id);
    if current.exists() {
        return Ok(());
    }

    fs::create_dir_all(&current).map_err(|e| e.to_string())?;
    fs::create_dir_all(persona_snapshots_dir(persona_id)).map_err(|e| e.to_string())?;

    let files = ["SOUL.md", "IDENTITY.md", "USER.md", "AGENTS.md", "MEMORY.md"];
    for file in &files {
        let src = root.join(file);
        if src.exists() {
            fs::copy(&src, current.join(file)).map_err(|e| e.to_string())?;
            let _ = fs::remove_file(&src);
        }
    }
    // Move memory/ and skills/ dirs
    for dir_name in &["memory", "skills"] {
        let src = root.join(dir_name);
        if src.exists() && src.is_dir() {
            copy_dir_recursive(&src, &current.join(dir_name))?;
            let _ = fs::remove_dir_all(&src);
        }
    }
    Ok(())
}

/// Copy files from workspace to a directory
fn save_workspace_to_dir(ws: &PathBuf, target: &PathBuf) -> Result<(), String> {
    fs::create_dir_all(target).map_err(|e| e.to_string())?;

    let files = ["SOUL.md", "IDENTITY.md", "USER.md", "AGENTS.md", "MEMORY.md"];
    for file in &files {
        let src = ws.join(file);
        if src.exists() {
            fs::copy(&src, target.join(file)).map_err(|e| e.to_string())?;
        }
    }

    for dir_name in &["memory", "skills"] {
        let src = ws.join(dir_name);
        let dst = target.join(dir_name);
        if src.exists() {
            if dst.exists() {
                fs::remove_dir_all(&dst).map_err(|e| e.to_string())?;
            }
            copy_dir_recursive(&src, &dst)?;
        }
    }
    Ok(())
}

/// Load files from a directory to workspace
fn load_dir_to_workspace(source: &PathBuf, ws: &PathBuf) -> Result<(), String> {
    let files = ["SOUL.md", "IDENTITY.md", "USER.md", "AGENTS.md", "MEMORY.md"];
    for file in &files {
        let src = source.join(file);
        if src.exists() {
            fs::copy(&src, ws.join(file)).map_err(|e| e.to_string())?;
        } else {
            fs::write(ws.join(file), "").map_err(|e| e.to_string())?;
        }
    }

    for dir_name in &["memory", "skills"] {
        let src = source.join(dir_name);
        let dst = ws.join(dir_name);
        if src.exists() {
            if dst.exists() {
                fs::remove_dir_all(&dst).map_err(|e| e.to_string())?;
            }
            copy_dir_recursive(&src, &dst)?;
        }
    }
    Ok(())
}

/// Recursively copy a directory
fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())?.flatten() {
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
// Persona Management Commands
// ============================================================

#[command]
fn list_personas(agent: &str) -> Result<Vec<PersonaMeta>, String> {
    let base = personas_dir();
    if !base.exists() {
        fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    }

    let ws = workspace_dir(agent);
    let active_marker = ws.join(".active-persona");
    let active_id = if active_marker.exists() {
        fs::read_to_string(&active_marker)
            .unwrap_or_default()
            .trim()
            .to_string()
    } else {
        String::new()
    };

    let mut personas = vec![];
    for entry in fs::read_dir(&base).map_err(|e| e.to_string())?.flatten() {
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let id = entry.file_name().to_string_lossy().to_string();

        // Use current/ subdir for stats, fall back to root for legacy
        let current = persona_current_dir(&id);
        let stat_dir = if current.exists() {
            current
        } else {
            entry.path()
        };

        let meta = read_persona_meta_json(&id);
        let name = meta["name"].as_str().unwrap_or(&id).to_string();
        let description = meta["description"].as_str().unwrap_or("").to_string();
        let emoji = meta["emoji"].as_str().unwrap_or("🤖").to_string();
        let author = meta["author"].as_str().unwrap_or("").to_string();
        let source = meta["source"].as_str().unwrap_or("local").to_string();
        let base_version = meta["base_version"].as_str().unwrap_or("").to_string();
        let current_version = meta["current_version"]
            .as_u64()
            .map(|v| format!("v{}", v))
            .unwrap_or_default();
        let last_switched_at = meta["last_switched_at"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let memory_dir = stat_dir.join("memory");
        let memory_count = if memory_dir.exists() {
            fs::read_dir(&memory_dir)
                .map(|r| r.count())
                .unwrap_or(0)
        } else {
            0
        };
        let skills_dir = stat_dir.join("skills");
        let skill_count = if skills_dir.exists() {
            fs::read_dir(&skills_dir)
                .map(|r| r.count())
                .unwrap_or(0)
        } else {
            0
        };
        let snap_dir = persona_snapshots_dir(&id);
        let snapshot_count = if snap_dir.exists() {
            fs::read_dir(&snap_dir)
                .map(|r| {
                    r.filter(|e| {
                        e.as_ref()
                            .map(|e| e.path().is_dir())
                            .unwrap_or(false)
                    })
                    .count()
                })
                .unwrap_or(0)
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
            source,
            has_memory: memory_count > 0 || stat_dir.join("MEMORY.md").exists(),
            has_skills: skill_count > 0,
            skill_count,
            memory_count,
            snapshot_count,
            base_version,
            current_version,
            last_switched_at,
        });
    }

    personas.sort_by(|a, b| b.is_active.cmp(&a.is_active).then(a.name.cmp(&b.name)));
    Ok(personas)
}

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
    validate_id(&id)?;

    let root = personas_dir().join(&id);
    if root.exists() {
        return Err(format!("Persona '{}' already exists", id));
    }

    let current = persona_current_dir(&id);
    fs::create_dir_all(&current).map_err(|e| e.to_string())?;
    fs::create_dir_all(current.join("memory")).map_err(|e| e.to_string())?;
    fs::create_dir_all(current.join("skills")).map_err(|e| e.to_string())?;
    fs::create_dir_all(persona_snapshots_dir(&id)).map_err(|e| e.to_string())?;

    let meta = serde_json::json!({
        "name": name,
        "description": description,
        "emoji": emoji,
        "author": "local",
        "source": "local",
        "base_version": "",
        "current_version": 1,
        "snapshot_count": 0,
        "created_at": timestamp_human(),
        "last_switched_at": "",
        "last_backup_at": "",
    });
    write_persona_meta_json(&id, &meta)?;

    if !soul_content.is_empty() {
        fs::write(current.join("SOUL.md"), &soul_content).map_err(|e| e.to_string())?;
    }
    if !identity_content.is_empty() {
        fs::write(current.join("IDENTITY.md"), &identity_content)
            .map_err(|e| e.to_string())?;
    }
    if !agents_content.is_empty() {
        fs::write(current.join("AGENTS.md"), &agents_content).map_err(|e| e.to_string())?;
    }
    fs::write(current.join("MEMORY.md"), "").map_err(|e| e.to_string())?;
    fs::write(current.join("USER.md"), "").map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
fn switch_persona(agent: String, persona_id: String) -> Result<(), String> {
    validate_id(&persona_id)?;

    let ws = workspace_dir(&agent);
    let target_current = persona_current_dir(&persona_id);

    if !target_current.exists() {
        let legacy = personas_dir().join(&persona_id);
        if !legacy.exists() {
            return Err(format!("Persona '{}' not found", persona_id));
        }
        migrate_legacy_persona(&persona_id)?;
    }

    // Save & snapshot current active
    let active_marker = ws.join(".active-persona");
    if active_marker.exists() {
        let current_id = fs::read_to_string(&active_marker)
            .unwrap_or_default()
            .trim()
            .to_string();
        if !current_id.is_empty() && current_id != persona_id {
            let current_dir = persona_current_dir(&current_id);
            if current_dir.exists() {
                save_workspace_to_dir(&ws, &current_dir)?;
                create_snapshot_impl(&current_id, "switch")?;
                let mut meta = read_persona_meta_json(&current_id);
                meta["last_switched_at"] = serde_json::json!(timestamp_human());
                write_persona_meta_json(&current_id, &meta)?;
            }
        }
    }

    // Load target
    load_dir_to_workspace(&target_current, &ws)?;
    fs::write(&active_marker, &persona_id).map_err(|e| e.to_string())?;

    let mut meta = read_persona_meta_json(&persona_id);
    meta["last_switched_at"] = serde_json::json!(timestamp_human());
    write_persona_meta_json(&persona_id, &meta)?;

    Ok(())
}

#[command]
fn delete_persona(agent: &str, persona_id: String) -> Result<(), String> {
    validate_id(&persona_id)?;
    let dir = personas_dir().join(&persona_id);
    if !dir.exists() {
        return Err(format!("Persona '{}' not found", persona_id));
    }
    let ws = workspace_dir(agent);
    let active_marker = ws.join(".active-persona");
    if active_marker.exists() {
        let active_id = fs::read_to_string(&active_marker)
            .unwrap_or_default()
            .trim()
            .to_string();
        if active_id == persona_id {
            return Err(
                "Cannot delete the active persona. Switch to another one first.".to_string(),
            );
        }
    }
    fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
fn save_current_as_persona(
    agent: String,
    persona_id: String,
    name: String,
    description: String,
    emoji: String,
) -> Result<(), String> {
    validate_id(&persona_id)?;

    let ws = workspace_dir(&agent);
    let root = personas_dir().join(&persona_id);
    let current = persona_current_dir(&persona_id);

    if root.exists() && current.exists() {
        let _ = create_snapshot_impl(&persona_id, "manual");
        fs::remove_dir_all(&current).map_err(|e| e.to_string())?;
    }

    fs::create_dir_all(&current).map_err(|e| e.to_string())?;
    fs::create_dir_all(persona_snapshots_dir(&persona_id)).map_err(|e| e.to_string())?;
    save_workspace_to_dir(&ws, &current)?;

    let meta = serde_json::json!({
        "name": name,
        "description": description,
        "emoji": emoji,
        "author": "local",
        "source": "local",
        "base_version": "",
        "current_version": 1,
        "snapshot_count": 0,
        "created_at": timestamp_human(),
        "last_switched_at": timestamp_human(),
        "last_backup_at": "",
    });
    write_persona_meta_json(&persona_id, &meta)?;

    let active_marker = ws.join(".active-persona");
    fs::write(&active_marker, &persona_id).map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
fn create_snapshot(persona_id: String) -> Result<String, String> {
    validate_id(&persona_id)?;
    create_snapshot_impl(&persona_id, "manual")
}

#[command]
fn list_snapshots(persona_id: String) -> Result<Vec<SnapshotInfo>, String> {
    validate_id(&persona_id)?;
    let snap_dir = persona_snapshots_dir(&persona_id);
    if !snap_dir.exists() {
        return Ok(vec![]);
    }
    let mut snapshots = vec![];
    for entry in fs::read_dir(&snap_dir).map_err(|e| e.to_string())?.flatten() {
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let snap_id = entry.file_name().to_string_lossy().to_string();
        let snap_path = entry.path();
        let meta_path = snap_path.join(".snapshot-meta.json");
        let (created_at, reason) = if meta_path.exists() {
            let raw = fs::read_to_string(&meta_path).unwrap_or_default();
            let v: serde_json::Value = serde_json::from_str(&raw).unwrap_or_default();
            (
                v["created_at"].as_str().unwrap_or("").to_string(),
                v["reason"].as_str().unwrap_or("").to_string(),
            )
        } else {
            (snap_id.clone(), "unknown".to_string())
        };
        snapshots.push(SnapshotInfo {
            id: snap_id,
            persona_id: persona_id.clone(),
            created_at,
            reason,
            has_memory: snap_path.join("memory").exists()
                || snap_path.join("MEMORY.md").exists(),
            has_skills: snap_path.join("skills").exists(),
        });
    }
    snapshots.sort_by(|a, b| b.id.cmp(&a.id));
    Ok(snapshots)
}

#[command]
fn restore_snapshot(persona_id: String, snapshot_id: String) -> Result<(), String> {
    validate_id(&persona_id)?;
    let snap_path = persona_snapshots_dir(&persona_id).join(&snapshot_id);
    if !snap_path.exists() {
        return Err(format!("Snapshot '{}' not found", snapshot_id));
    }
    let current = persona_current_dir(&persona_id);
    if current.exists() {
        create_snapshot_impl(&persona_id, "pre-restore")?;
        fs::remove_dir_all(&current).map_err(|e| e.to_string())?;
    }
    copy_dir_recursive(&snap_path, &current)?;
    let meta_in_current = current.join(".snapshot-meta.json");
    if meta_in_current.exists() {
        let _ = fs::remove_file(&meta_in_current);
    }
    Ok(())
}

#[command]
async fn fetch_community_personas() -> Result<Vec<CommunityPersona>, String> {
    let url = "https://raw.githubusercontent.com/openclaw0205/openclaw-personas/main/index.json";
    let client = reqwest::Client::new();
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Failed to fetch: {}", resp.status()));
    }
    let personas: Vec<CommunityPersona> = resp.json().await.map_err(|e| e.to_string())?;
    Ok(personas)
}

#[command]
async fn download_community_persona(persona_id: String, force: bool) -> Result<String, String> {
    validate_id(&persona_id)?;
    let base_url = format!(
        "https://raw.githubusercontent.com/openclaw0205/openclaw-personas/main/personas/{}",
        persona_id
    );
    let root = personas_dir().join(&persona_id);
    let current = persona_current_dir(&persona_id);
    let base_dir = persona_base_dir(&persona_id);
    let mut backup_id = String::new();

    if root.exists() && current.exists() {
        if !force {
            return Err("EXISTS_LOCALLY".to_string());
        }
        backup_id = create_snapshot_impl(&persona_id, "pre-download")?;
        fs::remove_dir_all(&current).map_err(|e| e.to_string())?;
    }

    fs::create_dir_all(&current).map_err(|e| e.to_string())?;
    fs::create_dir_all(&base_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(current.join("memory")).map_err(|e| e.to_string())?;
    fs::create_dir_all(current.join("skills")).map_err(|e| e.to_string())?;
    fs::create_dir_all(persona_snapshots_dir(&persona_id)).map_err(|e| e.to_string())?;

    let client = reqwest::Client::new();
    let files = ["meta.json", "SOUL.md", "IDENTITY.md", "AGENTS.md"];
    for file in &files {
        let url = format!("{}/{}", base_url, file);
        match client.get(&url).send().await {
            Ok(resp) if resp.status().is_success() => {
                let content = resp.text().await.map_err(|e| e.to_string())?;
                fs::write(current.join(file), &content).map_err(|e| e.to_string())?;
                fs::write(base_dir.join(file), &content).map_err(|e| e.to_string())?;
            }
            _ => {
                if *file == "meta.json" {
                    let m = serde_json::json!({"name": persona_id, "emoji": "🤖", "author": "community"});
                    let c = serde_json::to_string_pretty(&m).unwrap();
                    fs::write(current.join(file), &c).map_err(|e| e.to_string())?;
                    fs::write(base_dir.join(file), &c).map_err(|e| e.to_string())?;
                }
            }
        }
    }
    fs::write(current.join("MEMORY.md"), "").map_err(|e| e.to_string())?;
    fs::write(current.join("USER.md"), "").map_err(|e| e.to_string())?;

    // Build root meta
    let dl_meta_path = current.join("meta.json");
    let mut meta: serde_json::Value = if dl_meta_path.exists() {
        let raw = fs::read_to_string(&dl_meta_path).unwrap_or_default();
        serde_json::from_str(&raw).unwrap_or_default()
    } else {
        serde_json::json!({})
    };
    meta["source"] = serde_json::json!("community");
    meta["base_version"] = serde_json::json!(timestamp_human());
    meta["current_version"] = serde_json::json!(1);
    meta["snapshot_count"] = serde_json::json!(if backup_id.is_empty() { 0 } else { 1 });
    meta["created_at"] = serde_json::json!(timestamp_human());
    meta["last_backup_at"] = if backup_id.is_empty() {
        serde_json::json!("")
    } else {
        serde_json::json!(timestamp_human())
    };
    write_persona_meta_json(&persona_id, &meta)?;

    let msg = if backup_id.is_empty() {
        "downloaded".to_string()
    } else {
        format!("backed_up:{}", backup_id)
    };
    Ok(msg)
}

#[command]
fn check_persona_exists(persona_id: String) -> Result<bool, String> {
    validate_id(&persona_id)?;
    Ok(personas_dir().join(&persona_id).exists())
}

// ============================================================
// Original Commands (with security fixes)
// ============================================================

#[command]
fn list_agents() -> Result<Vec<AgentInfo>, String> {
    // Always include "main"
    let mut agents = vec![AgentInfo {
        id: "main".to_string(),
        has_workspace: workspace_dir("main").exists(),
    }];
    let agents_dir = openclaw_dir().join("agents");
    if agents_dir.exists() {
        for entry in fs::read_dir(&agents_dir).map_err(|e| e.to_string())?.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                let id = entry.file_name().to_string_lossy().to_string();
                let has_workspace = workspace_dir(&id).exists();
                agents.push(AgentInfo { id, has_workspace });
            }
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
    validate_persona_filename(&filename)?;
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
    for entry in fs::read_dir(&skills_dir).map_err(|e| e.to_string())?.flatten() {
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
    validate_id(&skill_name)?;
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
    for entry in fs::read_dir(&memory_dir).map_err(|e| e.to_string())?.flatten() {
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
    let expanded = expand_path(&output_path);
    let output_str = expanded.to_string_lossy().to_string();
    let output = std::process::Command::new("tar")
        .args([
            "-czf",
            &output_str,
            "-C",
            ws.parent().unwrap().to_str().unwrap(),
            ws.file_name().unwrap().to_str().unwrap(),
        ])
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(output_str)
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[command]
fn restore_persona_backup(agent: String, backup_path: String) -> Result<(), String> {
    let ws = workspace_dir(&agent);
    let parent = ws.parent().ok_or("Invalid path")?;
    let expanded = expand_path(&backup_path);
    let expanded_str = expanded.to_string_lossy().to_string();

    // Validate archive: list contents and check for path traversal
    let list_output = std::process::Command::new("tar")
        .args(["-tzf", &expanded_str])
        .output()
        .map_err(|e| e.to_string())?;
    if !list_output.status.success() {
        return Err("Invalid archive file".to_string());
    }
    let listing = String::from_utf8_lossy(&list_output.stdout);
    for line in listing.lines() {
        if line.starts_with('/') || line.contains("..") {
            return Err(format!("Unsafe path in archive: {}", line));
        }
    }

    let output = std::process::Command::new("tar")
        .args(["-xzf", &expanded_str, "-C", parent.to_str().unwrap()])
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

#[command]
fn save_config(content: String) -> Result<(), String> {
    let _: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Invalid JSON: {}", e))?;
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
            restore_persona_backup,
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
            check_persona_exists,
            // Snapshots
            create_snapshot,
            list_snapshots,
            restore_snapshot,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}