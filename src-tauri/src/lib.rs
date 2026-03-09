use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::command;

const MAX_SNAPSHOTS: usize = 20;

fn openclaw_dir() -> PathBuf {
    dirs::home_dir()
        .expect("Cannot find home directory")
        .join(".openclaw")
}

fn workspace_dir(agent: &str) -> PathBuf {
    if agent == "main" {
        openclaw_dir().join("workspace")
    } else {
        openclaw_dir().join("agents").join(agent).join("workspace")
    }
}

fn personas_dir() -> PathBuf {
    openclaw_dir().join("personas")
}

fn builtin_skills_dir() -> PathBuf {
    PathBuf::from("/opt/homebrew/lib/node_modules/openclaw/skills")
}

fn validate_id(id: &str) -> Result<(), String> {
    if id.is_empty() {
        return Err("ID cannot be empty".to_string());
    }
    if !id
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    {
        return Err("ID can only contain letters, numbers, hyphens, and underscores".to_string());
    }
    Ok(())
}

fn skill_sources() -> Vec<(&'static str, PathBuf)> {
    vec![("builtin", builtin_skills_dir())]
}

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
        Err(format!("Filename '{}' not allowed", name))
    }
}

fn expand_path(path: &str) -> PathBuf {
    if let Some(stripped) = path.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(stripped);
        }
    }
    PathBuf::from(path)
}

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
    pub source: String,
}
#[derive(Serialize, Deserialize, Clone)]
pub struct ClawHubSkillInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub source: String,
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

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct PersonaSkillPack {
    pub required: Vec<String>,
    pub recommended: Vec<String>,
    pub optional: Vec<String>,
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
    pub tags: Vec<String>,
    pub skill_pack: PersonaSkillPack,
    pub declared_skill_count: usize,
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

// --- Directory helpers ---

fn persona_current_dir(id: &str) -> PathBuf {
    personas_dir().join(id).join("current")
}
fn persona_base_dir(id: &str) -> PathBuf {
    personas_dir().join(id).join("base")
}
fn persona_snapshots_dir(id: &str) -> PathBuf {
    personas_dir().join(id).join("snapshots")
}

fn normalize_string_list(value: Option<&serde_json::Value>) -> Vec<String> {
    value
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.trim().to_string()))
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

fn read_persona_meta_json(id: &str) -> serde_json::Value {
    let p = personas_dir().join(id).join("meta.json");
    if p.exists() {
        serde_json::from_str(&fs::read_to_string(&p).unwrap_or_default()).unwrap_or_default()
    } else {
        serde_json::json!({})
    }
}

fn write_persona_meta_json(id: &str, meta: &serde_json::Value) -> Result<(), String> {
    let p = personas_dir().join(id).join("meta.json");
    fs::write(p, serde_json::to_string_pretty(meta).unwrap_or_default()).map_err(|e| e.to_string())
}

fn get_active_persona_id(agent: &str) -> Option<String> {
    let marker = workspace_dir(agent).join(".active-persona");
    if marker.exists() {
        let id = fs::read_to_string(&marker)
            .unwrap_or_default()
            .trim()
            .to_string();
        if !id.is_empty() {
            return Some(id);
        }
    }
    None
}

/// Sync workspace → current/ if persona is active (P1 fix)
fn sync_workspace_if_active(agent: &str, persona_id: &str) -> Result<(), String> {
    if let Some(active) = get_active_persona_id(agent) {
        if active == persona_id {
            save_workspace_to_dir(&workspace_dir(agent), &persona_current_dir(persona_id))?;
        }
    }
    Ok(())
}

fn create_snapshot_impl(
    persona_id: &str,
    reason: &str,
    agent: Option<&str>,
) -> Result<String, String> {
    if let Some(ag) = agent {
        sync_workspace_if_active(ag, persona_id)?;
    }
    let current = persona_current_dir(persona_id);
    if !current.exists() {
        return Err(format!("Persona '{}' has no current state", persona_id));
    }
    let snap_dir = persona_snapshots_dir(persona_id);
    fs::create_dir_all(&snap_dir).map_err(|e| e.to_string())?;
    let snap_id = timestamp_compact();
    let snap_path = snap_dir.join(&snap_id);
    copy_dir_recursive(&current, &snap_path)?;
    let snap_meta = serde_json::json!({"id": snap_id, "persona_id": persona_id, "created_at": timestamp_human(), "reason": reason});
    fs::write(
        snap_path.join(".snapshot-meta.json"),
        serde_json::to_string_pretty(&snap_meta).unwrap(),
    )
    .map_err(|e| e.to_string())?;
    let mut meta = read_persona_meta_json(persona_id);
    meta["snapshot_count"] = serde_json::json!(meta["snapshot_count"].as_u64().unwrap_or(0) + 1);
    meta["last_backup_at"] = serde_json::json!(timestamp_human());
    meta["current_version"] = serde_json::json!(meta["current_version"].as_u64().unwrap_or(0) + 1);
    write_persona_meta_json(persona_id, &meta)?;
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
    for entry in entries.iter().take(entries.len() - MAX_SNAPSHOTS) {
        let _ = fs::remove_dir_all(entry.path());
    }
    Ok(())
}

fn migrate_legacy_persona(persona_id: &str) -> Result<(), String> {
    let root = personas_dir().join(persona_id);
    let current = persona_current_dir(persona_id);
    if current.exists() {
        return Ok(());
    }
    fs::create_dir_all(&current).map_err(|e| e.to_string())?;
    fs::create_dir_all(persona_snapshots_dir(persona_id)).map_err(|e| e.to_string())?;
    for file in &[
        "SOUL.md",
        "IDENTITY.md",
        "USER.md",
        "AGENTS.md",
        "MEMORY.md",
    ] {
        let src = root.join(file);
        if src.exists() {
            fs::copy(&src, current.join(file)).map_err(|e| e.to_string())?;
            let _ = fs::remove_file(&src);
        }
    }
    for d in &["memory", "skills"] {
        let src = root.join(d);
        if src.exists() && src.is_dir() {
            copy_dir_recursive(&src, &current.join(d))?;
            let _ = fs::remove_dir_all(&src);
        }
    }
    Ok(())
}

fn save_workspace_to_dir(ws: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(target).map_err(|e| e.to_string())?;
    for file in &[
        "SOUL.md",
        "IDENTITY.md",
        "USER.md",
        "AGENTS.md",
        "MEMORY.md",
    ] {
        let src = ws.join(file);
        if src.exists() {
            fs::copy(&src, target.join(file)).map_err(|e| e.to_string())?;
        }
    }
    for d in &["memory", "skills"] {
        let src = ws.join(d);
        let dst = target.join(d);
        if src.exists() {
            if dst.exists() {
                fs::remove_dir_all(&dst).map_err(|e| e.to_string())?;
            }
            copy_dir_recursive(&src, &dst)?;
        }
    }
    Ok(())
}

fn load_dir_to_workspace(source: &Path, ws: &Path) -> Result<(), String> {
    for file in &[
        "SOUL.md",
        "IDENTITY.md",
        "USER.md",
        "AGENTS.md",
        "MEMORY.md",
    ] {
        let src = source.join(file);
        if src.exists() {
            fs::copy(&src, ws.join(file)).map_err(|e| e.to_string())?;
        } else {
            fs::write(ws.join(file), "").map_err(|e| e.to_string())?;
        }
    }
    for d in &["memory", "skills"] {
        let src = source.join(d);
        let dst = ws.join(d);
        if src.exists() {
            if dst.exists() {
                fs::remove_dir_all(&dst).map_err(|e| e.to_string())?;
            }
            copy_dir_recursive(&src, &dst)?;
        }
    }
    Ok(())
}

fn read_skill_description(skill_md: &Path, fallback: &str) -> String {
    if skill_md.exists() {
        fs::read_to_string(skill_md)
            .unwrap_or_default()
            .lines()
            .find(|l| l.starts_with("description:"))
            .map(|l| l.trim_start_matches("description:").trim().trim_matches('"').to_string())
            .unwrap_or_else(|| fallback.to_string())
    } else {
        fallback.to_string()
    }
}

fn collect_skills_from_dir(dir: &Path, source: &str) -> Vec<SkillInfo> {
    if !dir.exists() {
        return vec![];
    }
    let mut skills = vec![];
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                let name = entry.file_name().to_string_lossy().to_string();
                let skill_md = entry.path().join("SKILL.md");
                skills.push(SkillInfo {
                    description: read_skill_description(&skill_md, &name),
                    name,
                    path: entry.path().to_string_lossy().to_string(),
                    source: source.to_string(),
                });
            }
        }
    }
    skills
}

fn clawhub_bin() -> String {
    "clawhub".to_string()
}

fn clawhub_available() -> bool {
    std::process::Command::new(clawhub_bin())
        .arg("--help")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn run_clawhub(args: &[&str], workdir: Option<&Path>) -> Result<String, String> {
    let mut cmd = std::process::Command::new(clawhub_bin());
    cmd.args(args);
    if let Some(dir) = workdir {
        cmd.current_dir(dir);
    }
    let out = cmd.output().map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).to_string())
    }
}

fn parse_clawhub_search_output(output: &str) -> Vec<ClawHubSkillInfo> {
    output
        .lines()
        .filter(|line| !line.trim().is_empty() && !line.trim_start().starts_with('-'))
        .filter_map(|line| {
            let line = line.trim();
            let mut cols = line.split_whitespace();
            let id = cols.next()?.to_string();
            let name = cols.next().unwrap_or(&id).to_string();
            Some(ClawHubSkillInfo {
                id,
                name,
                description: line.to_string(),
                tags: vec![],
                version: String::new(),
                source: "clawhub".to_string(),
            })
        })
        .collect()
}

fn parse_clawhub_explore_json(output: &str) -> Result<Vec<ClawHubSkillInfo>, String> {
    let v: serde_json::Value = serde_json::from_str(output).map_err(|e| e.to_string())?;
    let items = v["items"].as_array().cloned().unwrap_or_default();
    Ok(items
        .into_iter()
        .map(|item| {
            let tags = item["tags"]
                .as_object()
                .map(|m| m.keys().cloned().collect())
                .unwrap_or_else(Vec::new);
            ClawHubSkillInfo {
                id: item["slug"].as_str().unwrap_or("").to_string(),
                name: item["displayName"].as_str().unwrap_or("").to_string(),
                description: item["summary"].as_str().unwrap_or("").to_string(),
                tags,
                version: item["latestVersion"]["version"].as_str().unwrap_or("").to_string(),
                source: "clawhub".to_string(),
            }
        })
        .collect())
}

fn install_skill_from_sources(agent: &str, skill_name: &str) -> Result<String, String> {
    validate_id(skill_name)?;
    let dst = workspace_dir(agent).join("skills").join(skill_name);
    fs::create_dir_all(dst.parent().ok_or("Invalid skill target")?).map_err(|e| e.to_string())?;

    for (source, dir) in skill_sources() {
        let candidate = dir.join(skill_name);
        if candidate.exists() && candidate.is_dir() {
            if dst.exists() {
                fs::remove_dir_all(&dst).map_err(|e| e.to_string())?;
            }
            copy_dir_recursive(&candidate, &dst)?;
            return Ok(source.to_string());
        }
    }

    run_clawhub(
        &["install", skill_name, "--force", "--no-input", "--workdir", workspace_dir(agent).to_string_lossy().as_ref()],
        None,
    )?;
    Ok("clawhub".to_string())
}

fn auto_install_persona_skills(agent: &str, persona_id: &str) -> Result<Vec<String>, String> {
    let meta = read_persona_meta_json(persona_id);
    let required = normalize_string_list(meta.get("skills").and_then(|v| v.get("required")));
    let recommended = normalize_string_list(meta.get("skills").and_then(|v| v.get("recommended")));
    let skills_dir = workspace_dir(agent).join("skills");
    fs::create_dir_all(&skills_dir).map_err(|e| e.to_string())?;

    let mut installed = Vec::new();
    for skill_name in required.into_iter().chain(recommended.into_iter()) {
        let dst = skills_dir.join(&skill_name);
        if dst.exists() {
            continue;
        }
        if install_skill_from_sources(agent, &skill_name).is_ok() {
            installed.push(skill_name);
        }
    }
    Ok(installed)
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())?.flatten() {
        let sp = entry.path();
        let dp = dst.join(entry.file_name());
        if sp.is_dir() {
            copy_dir_recursive(&sp, &dp)?;
        } else {
            fs::copy(&sp, &dp).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

// ============================================================
// Commands
// ============================================================

#[command]
fn list_personas(agent: &str) -> Result<Vec<PersonaMeta>, String> {
    let base = personas_dir();
    if !base.exists() {
        fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    }
    let active_id = get_active_persona_id(agent).unwrap_or_default();
    let mut personas = vec![];
    for entry in fs::read_dir(&base).map_err(|e| e.to_string())?.flatten() {
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let id = entry.file_name().to_string_lossy().to_string();
        let current = persona_current_dir(&id);
        let stat_dir = if current.exists() {
            current
        } else {
            entry.path()
        };
        let meta = read_persona_meta_json(&id);
        let memory_dir = stat_dir.join("memory");
        let memory_count = if memory_dir.exists() {
            fs::read_dir(&memory_dir).map(|r| r.count()).unwrap_or(0)
        } else {
            0
        };
        let skills_dir = stat_dir.join("skills");
        let skill_count = if skills_dir.exists() {
            fs::read_dir(&skills_dir).map(|r| r.count()).unwrap_or(0)
        } else {
            0
        };
        let snap_dir = persona_snapshots_dir(&id);
        let snapshot_count = if snap_dir.exists() {
            fs::read_dir(&snap_dir)
                .map(|r| {
                    r.filter(|e| e.as_ref().map(|e| e.path().is_dir()).unwrap_or(false))
                        .count()
                })
                .unwrap_or(0)
        } else {
            0
        };
        let tags = normalize_string_list(meta.get("tags"));
        let required = normalize_string_list(meta.get("skills").and_then(|v| v.get("required")));
        let recommended =
            normalize_string_list(meta.get("skills").and_then(|v| v.get("recommended")));
        let optional = normalize_string_list(meta.get("skills").and_then(|v| v.get("optional")));
        let declared_skill_count = required.len() + recommended.len() + optional.len();

        personas.push(PersonaMeta {
            is_active: id == active_id,
            id: id.clone(),
            name: meta["name"].as_str().unwrap_or(&id).to_string(),
            description: meta["description"].as_str().unwrap_or("").to_string(),
            emoji: meta["emoji"].as_str().unwrap_or("🤖").to_string(),
            author: meta["author"].as_str().unwrap_or("").to_string(),
            source: meta["source"].as_str().unwrap_or("local").to_string(),
            base_version: meta["base_version"].as_str().unwrap_or("").to_string(),
            current_version: meta["current_version"]
                .as_u64()
                .map(|v| format!("v{}", v))
                .unwrap_or_default(),
            last_switched_at: meta["last_switched_at"].as_str().unwrap_or("").to_string(),
            has_memory: memory_count > 0 || stat_dir.join("MEMORY.md").exists(),
            has_skills: skill_count > 0,
            skill_count,
            memory_count,
            snapshot_count,
            tags,
            skill_pack: PersonaSkillPack {
                required,
                recommended,
                optional,
            },
            declared_skill_count,
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
    tags: Vec<String>,
    skill_pack: PersonaSkillPack,
) -> Result<(), String> {
    validate_id(&id)?;
    if personas_dir().join(&id).exists() {
        return Err(format!("Persona '{}' already exists", id));
    }
    let current = persona_current_dir(&id);
    fs::create_dir_all(&current).map_err(|e| e.to_string())?;
    fs::create_dir_all(current.join("memory")).map_err(|e| e.to_string())?;
    fs::create_dir_all(current.join("skills")).map_err(|e| e.to_string())?;
    fs::create_dir_all(persona_snapshots_dir(&id)).map_err(|e| e.to_string())?;
    write_persona_meta_json(
        &id,
        &serde_json::json!({
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
            "tags": tags,
            "skills": {
                "required": skill_pack.required,
                "recommended": skill_pack.recommended,
                "optional": skill_pack.optional
            }
        }),
    )?;
    if !soul_content.is_empty() {
        fs::write(current.join("SOUL.md"), &soul_content).map_err(|e| e.to_string())?;
    }
    if !identity_content.is_empty() {
        fs::write(current.join("IDENTITY.md"), &identity_content).map_err(|e| e.to_string())?;
    }
    if !agents_content.is_empty() {
        fs::write(current.join("AGENTS.md"), &agents_content).map_err(|e| e.to_string())?;
    }
    fs::write(current.join("MEMORY.md"), "").map_err(|e| e.to_string())?;
    fs::write(current.join("USER.md"), "").map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
fn switch_persona(agent: String, persona_id: String) -> Result<Vec<String>, String> {
    validate_id(&persona_id)?;
    let ws = workspace_dir(&agent);
    if !persona_current_dir(&persona_id).exists() {
        if !personas_dir().join(&persona_id).exists() {
            return Err(format!("Persona '{}' not found", persona_id));
        }
        migrate_legacy_persona(&persona_id)?;
    }
    if let Some(current_id) = get_active_persona_id(&agent) {
        if current_id != persona_id {
            let cd = persona_current_dir(&current_id);
            if cd.exists() {
                save_workspace_to_dir(&ws, &cd)?;
                create_snapshot_impl(&current_id, "switch", None)?;
                let mut m = read_persona_meta_json(&current_id);
                m["last_switched_at"] = serde_json::json!(timestamp_human());
                write_persona_meta_json(&current_id, &m)?;
            }
        }
    }
    load_dir_to_workspace(&persona_current_dir(&persona_id), &ws)?;
    fs::write(ws.join(".active-persona"), &persona_id).map_err(|e| e.to_string())?;
    let installed_skills = auto_install_persona_skills(&agent, &persona_id)?;
    let mut m = read_persona_meta_json(&persona_id);
    m["last_switched_at"] = serde_json::json!(timestamp_human());
    write_persona_meta_json(&persona_id, &m)?;
    Ok(installed_skills)
}

#[command]
fn delete_persona(agent: &str, persona_id: String) -> Result<(), String> {
    validate_id(&persona_id)?;
    let dir = personas_dir().join(&persona_id);
    if !dir.exists() {
        return Err(format!("Persona '{}' not found", persona_id));
    }
    if let Some(active) = get_active_persona_id(agent) {
        if active == persona_id {
            return Err("Cannot delete active persona. Switch first.".to_string());
        }
    }
    fs::remove_dir_all(dir).map_err(|e| e.to_string())
}

/// P2 fix: preserve version history on overwrite
#[command]
fn save_current_as_persona(
    agent: String,
    persona_id: String,
    name: String,
    description: String,
    emoji: String,
    tags: Vec<String>,
    skill_pack: PersonaSkillPack,
) -> Result<(), String> {
    validate_id(&persona_id)?;
    let ws = workspace_dir(&agent);
    let root = personas_dir().join(&persona_id);
    let current = persona_current_dir(&persona_id);
    let existed = root.exists();
    if existed && current.exists() {
        create_snapshot_impl(&persona_id, "manual", Some(&agent))?;
        fs::remove_dir_all(&current).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&current).map_err(|e| e.to_string())?;
    fs::create_dir_all(persona_snapshots_dir(&persona_id)).map_err(|e| e.to_string())?;
    save_workspace_to_dir(&ws, &current)?;
    if existed {
        let mut m = read_persona_meta_json(&persona_id);
        m["name"] = serde_json::json!(name);
        m["description"] = serde_json::json!(description);
        m["emoji"] = serde_json::json!(emoji);
        m["tags"] = serde_json::json!(tags);
        m["skills"] = serde_json::json!({
            "required": skill_pack.required,
            "recommended": skill_pack.recommended,
            "optional": skill_pack.optional
        });
        m["last_switched_at"] = serde_json::json!(timestamp_human());
        write_persona_meta_json(&persona_id, &m)?;
    } else {
        write_persona_meta_json(
            &persona_id,
            &serde_json::json!({
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
                "tags": tags,
                "skills": {
                    "required": skill_pack.required,
                    "recommended": skill_pack.recommended,
                    "optional": skill_pack.optional
                }
            }),
        )?;
    }
    fs::write(ws.join(".active-persona"), &persona_id).map_err(|e| e.to_string())?;
    Ok(())
}

/// P1 fix: sync workspace before snapshotting
#[command]
fn create_snapshot(agent: String, persona_id: String) -> Result<String, String> {
    validate_id(&persona_id)?;
    create_snapshot_impl(&persona_id, "manual", Some(&agent))
}

#[command]
fn list_snapshots(persona_id: String) -> Result<Vec<SnapshotInfo>, String> {
    validate_id(&persona_id)?;
    let snap_dir = persona_snapshots_dir(&persona_id);
    if !snap_dir.exists() {
        return Ok(vec![]);
    }
    let mut snapshots = vec![];
    for entry in fs::read_dir(&snap_dir)
        .map_err(|e| e.to_string())?
        .flatten()
    {
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let snap_id = entry.file_name().to_string_lossy().to_string();
        let sp = entry.path();
        let mp = sp.join(".snapshot-meta.json");
        let (created_at, reason) = if mp.exists() {
            let v: serde_json::Value =
                serde_json::from_str(&fs::read_to_string(&mp).unwrap_or_default())
                    .unwrap_or_default();
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
            has_memory: sp.join("memory").exists() || sp.join("MEMORY.md").exists(),
            has_skills: sp.join("skills").exists(),
        });
    }
    snapshots.sort_by(|a, b| b.id.cmp(&a.id));
    Ok(snapshots)
}

/// P1 fix: sync restored snapshot to workspace if active
#[command]
fn restore_snapshot(agent: String, persona_id: String, snapshot_id: String) -> Result<(), String> {
    validate_id(&persona_id)?;
    let snap_path = persona_snapshots_dir(&persona_id).join(&snapshot_id);
    if !snap_path.exists() {
        return Err(format!("Snapshot '{}' not found", snapshot_id));
    }
    let current = persona_current_dir(&persona_id);
    if current.exists() {
        create_snapshot_impl(&persona_id, "pre-restore", Some(&agent))?;
        fs::remove_dir_all(&current).map_err(|e| e.to_string())?;
    }
    copy_dir_recursive(&snap_path, &current)?;
    let m = current.join(".snapshot-meta.json");
    if m.exists() {
        let _ = fs::remove_file(&m);
    }
    // If active, sync to workspace
    if let Some(active) = get_active_persona_id(&agent) {
        if active == persona_id {
            load_dir_to_workspace(&current, &workspace_dir(&agent))?;
        }
    }
    Ok(())
}

#[command]
async fn fetch_community_personas() -> Result<Vec<CommunityPersona>, String> {
    let url = "https://raw.githubusercontent.com/openclaw0205/openclaw-personas/main/index.json";
    let resp = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Failed to fetch: {}", resp.status()));
    }
    resp.json().await.map_err(|e| e.to_string())
}

#[command]
async fn download_community_persona(
    agent: String,
    persona_id: String,
    force: bool,
) -> Result<String, String> {
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
        // P1 fix: sync workspace→current before snapshot if this persona is active
        backup_id = create_snapshot_impl(&persona_id, "pre-download", Some(&agent))?;
        fs::remove_dir_all(&current).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&current).map_err(|e| e.to_string())?;
    fs::create_dir_all(&base_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(current.join("memory")).map_err(|e| e.to_string())?;
    fs::create_dir_all(current.join("skills")).map_err(|e| e.to_string())?;
    fs::create_dir_all(persona_snapshots_dir(&persona_id)).map_err(|e| e.to_string())?;
    let client = reqwest::Client::new();
    for file in &["meta.json", "SOUL.md", "IDENTITY.md", "AGENTS.md"] {
        let url = format!("{}/{}", base_url, file);
        match client.get(&url).send().await {
            Ok(resp) if resp.status().is_success() => {
                let content = resp.text().await.map_err(|e| e.to_string())?;
                fs::write(current.join(file), &content).map_err(|e| e.to_string())?;
                fs::write(base_dir.join(file), &content).map_err(|e| e.to_string())?;
            }
            _ => {
                if *file == "meta.json" {
                    let c = serde_json::to_string_pretty(&serde_json::json!({"name": persona_id, "emoji": "🤖", "author": "community"})).unwrap();
                    fs::write(current.join(file), &c).map_err(|e| e.to_string())?;
                    fs::write(base_dir.join(file), &c).map_err(|e| e.to_string())?;
                }
            }
        }
    }
    fs::write(current.join("MEMORY.md"), "").map_err(|e| e.to_string())?;
    fs::write(current.join("USER.md"), "").map_err(|e| e.to_string())?;
    // Merge downloaded meta with existing persona meta (preserve history)
    let dl_meta: serde_json::Value = fs::read_to_string(current.join("meta.json"))
        .ok()
        .and_then(|r| serde_json::from_str(&r).ok())
        .unwrap_or_default();
    let mut meta = if backup_id.is_empty() {
        // Fresh download: use downloaded meta as base
        dl_meta
    } else {
        // Overwrite: preserve existing history, merge downloaded fields
        let mut existing = read_persona_meta_json(&persona_id);
        // Update display fields from community
        for key in &["name", "description", "emoji", "author"] {
            if let Some(v) = dl_meta.get(*key) {
                existing[*key] = v.clone();
            }
        }
        existing
    };
    meta["source"] = serde_json::json!("community");
    meta["base_version"] = serde_json::json!(timestamp_human());
    if backup_id.is_empty() {
        meta["current_version"] = serde_json::json!(1);
        meta["snapshot_count"] = serde_json::json!(0);
        meta["created_at"] = serde_json::json!(timestamp_human());
    }
    // For overwrites: current_version and snapshot_count already incremented by create_snapshot_impl
    write_persona_meta_json(&persona_id, &meta)?;
    // P1 fix: if this persona is active, load new content into workspace
    if let Some(active) = get_active_persona_id(&agent) {
        if active == persona_id {
            load_dir_to_workspace(&current, &workspace_dir(&agent))?;
        }
    }
    Ok(if backup_id.is_empty() {
        "downloaded".to_string()
    } else {
        format!("backed_up:{}", backup_id)
    })
}

#[command]
fn check_persona_exists(persona_id: String) -> Result<bool, String> {
    validate_id(&persona_id)?;
    Ok(personas_dir().join(&persona_id).exists())
}

// --- Original commands with security fixes ---

#[command]
fn list_agents() -> Result<Vec<AgentInfo>, String> {
    let mut agents = vec![AgentInfo {
        id: "main".to_string(),
        has_workspace: workspace_dir("main").exists(),
    }];
    let agents_dir = openclaw_dir().join("agents");
    if agents_dir.exists() {
        for entry in fs::read_dir(&agents_dir)
            .map_err(|e| e.to_string())?
            .flatten()
        {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                let id = entry.file_name().to_string_lossy().to_string();
                if id == "main" {
                    continue; // already added above
                }
                agents.push(AgentInfo {
                    id: id.clone(),
                    has_workspace: workspace_dir(&id).exists(),
                });
            }
        }
    }
    Ok(agents)
}

#[command]
fn read_persona(agent: String) -> Result<Persona, String> {
    let ws = workspace_dir(&agent);
    let mut files = vec![];
    for name in &["SOUL.md", "IDENTITY.md", "USER.md", "AGENTS.md"] {
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
    fs::write(ws.join(&filename), &content).map_err(|e| e.to_string())
}

#[command]
fn list_skills(agent: String) -> Result<Vec<SkillInfo>, String> {
    let skills_dir = workspace_dir(&agent).join("skills");
    let mut skills = collect_skills_from_dir(&skills_dir, "installed");
    skills.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(skills)
}

#[command]
fn clawhub_status() -> Result<bool, String> {
    Ok(clawhub_available())
}

#[command]
fn clawhub_explore() -> Result<Vec<ClawHubSkillInfo>, String> {
    let output = run_clawhub(&["explore", "--json", "--no-input"], None)?;
    parse_clawhub_explore_json(&output)
}

#[command]
fn clawhub_search(query: String) -> Result<Vec<ClawHubSkillInfo>, String> {
    let output = run_clawhub(&["search", &query, "--limit", "20", "--no-input"], None)?;
    Ok(parse_clawhub_search_output(&output))
}

#[command]
fn clawhub_install(agent: String, skill_id: String) -> Result<(), String> {
    validate_id(&skill_id)?;
    let workdir = workspace_dir(&agent);
    run_clawhub(&["install", &skill_id, "--force", "--no-input"], Some(&workdir))?;
    Ok(())
}

#[command]
fn clawhub_update_all(agent: String) -> Result<(), String> {
    let workdir = workspace_dir(&agent);
    run_clawhub(&["update", "--all", "--force", "--no-input"], Some(&workdir))?;
    Ok(())
}

#[command]
fn delete_skill(agent: String, skill_name: String) -> Result<(), String> {
    validate_id(&skill_name)?;
    let p = workspace_dir(&agent).join("skills").join(&skill_name);
    if p.exists() {
        fs::remove_dir_all(&p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
fn list_memories(agent: String) -> Result<Vec<MemoryEntry>, String> {
    let memory_dir = workspace_dir(&agent).join("memory");
    if !memory_dir.exists() {
        return Ok(vec![]);
    }
    let mut memories = vec![];
    for entry in fs::read_dir(&memory_dir)
        .map_err(|e| e.to_string())?
        .flatten()
    {
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
    let p = workspace_dir(&agent).join("MEMORY.md");
    if p.exists() {
        fs::read_to_string(&p).map_err(|e| e.to_string())
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
    let out = expanded.to_string_lossy().to_string();
    let r = std::process::Command::new("tar")
        .args([
            "-czf",
            &out,
            "-C",
            ws.parent().unwrap().to_str().unwrap(),
            ws.file_name().unwrap().to_str().unwrap(),
        ])
        .output()
        .map_err(|e| e.to_string())?;
    if r.status.success() {
        Ok(out)
    } else {
        Err(String::from_utf8_lossy(&r.stderr).to_string())
    }
}

#[command]
fn restore_persona_backup(agent: String, backup_path: String) -> Result<(), String> {
    let ws = workspace_dir(&agent);
    let parent = ws.parent().ok_or("Invalid path")?;
    let expanded = expand_path(&backup_path);
    let ep = expanded.to_string_lossy().to_string();
    let list = std::process::Command::new("tar")
        .args(["-tzf", &ep])
        .output()
        .map_err(|e| e.to_string())?;
    if !list.status.success() {
        return Err("Invalid archive".to_string());
    }
    let ws_name = ws
        .file_name()
        .ok_or("Invalid workspace path")?
        .to_string_lossy()
        .to_string();
    for line in String::from_utf8_lossy(&list.stdout).lines() {
        let trimmed = line.trim_end_matches('/');
        if trimmed.is_empty() {
            continue;
        }
        if line.starts_with('/') || line.contains("..") {
            return Err(format!("Unsafe path in archive: {}", line));
        }
        // All entries must be under the workspace directory name
        if !trimmed.starts_with(&ws_name) {
            return Err(format!(
                "Path '{}' is outside workspace '{}'",
                line, ws_name
            ));
        }
    }
    let r = std::process::Command::new("tar")
        .args(["-xzf", &ep, "-C", parent.to_str().unwrap()])
        .output()
        .map_err(|e| e.to_string())?;
    if r.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&r.stderr).to_string())
    }
}

#[command]
fn read_config() -> Result<String, String> {
    let p = openclaw_dir().join("openclaw.json");
    if p.exists() {
        fs::read_to_string(&p).map_err(|e| e.to_string())
    } else {
        Ok("{}".to_string())
    }
}

#[command]
fn save_config(content: String) -> Result<(), String> {
    let _: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Invalid JSON: {}", e))?;
    fs::write(openclaw_dir().join("openclaw.json"), &content).map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_agents,
            read_persona,
            save_persona_file,
            list_skills,
            clawhub_status,
            clawhub_explore,
            clawhub_search,
            clawhub_install,
            clawhub_update_all,
            delete_skill,
            list_memories,
            read_long_term_memory,
            backup_persona,
            restore_persona_backup,
            read_config,
            save_config,
            list_personas,
            create_persona,
            switch_persona,
            delete_persona,
            save_current_as_persona,
            fetch_community_personas,
            download_community_persona,
            check_persona_exists,
            create_snapshot,
            list_snapshots,
            restore_snapshot,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
