import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, SkillInfo, PersonaMeta, ClawHubSkillInfo } from "../api";

interface Props {
  agent: string;
}

type Tab = "overview" | "installed" | "cloud";

export default function SkillsPage({ agent }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("overview");
  const [installed, setInstalled] = useState<SkillInfo[]>([]);
  const [cloudSkills, setCloudSkills] = useState<ClawHubSkillInfo[]>([]);
  const [activePersona, setActivePersona] = useState<PersonaMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cloudError, setCloudError] = useState("");
  const [workingSkill, setWorkingSkill] = useState<string | null>(null);
  const [clawhubReady, setClawhubReady] = useState(false);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadBase = async () => {
    setLoading(true);
    setError("");
    try {
      const [installedSkills, personas, ready] = await Promise.all([
        api.listSkills(agent),
        api.listPersonas(agent),
        api.clawhubStatus(),
      ]);
      setInstalled(installedSkills);
      setActivePersona(personas.find((p) => p.is_active) ?? null);
      setClawhubReady(ready);
      if (ready) {
        try {
          setCloudSkills(await api.clawhubExplore());
          setCloudError("");
        } catch (e: any) {
          setCloudSkills([]);
          setCloudError(e?.toString() || "Failed to load ClawHub skills");
        }
      } else {
        setCloudSkills([]);
        setCloudError(t("skills.clawhubMissing"));
      }
    } catch (e: any) {
      setError(e?.toString() || "Failed to load skills");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadBase();
  }, [agent]);

  const installedSet = useMemo(() => new Set(installed.map((s) => s.name)), [installed]);
  const cloudSet = useMemo(() => new Set(cloudSkills.map((s) => s.id)), [cloudSkills]);

  const skillRequirements = useMemo(() => {
    const required = activePersona?.skill_pack.required ?? [];
    const recommended = activePersona?.skill_pack.recommended ?? [];
    const optional = activePersona?.skill_pack.optional ?? [];
    return { required, recommended, optional };
  }, [activePersona]);

  const handleDelete = async (name: string) => {
    if (!confirm(t("skills.confirmDelete", { name }))) return;
    setWorkingSkill(name);
    try {
      await api.deleteSkill(agent, name);
      showToast(t("skills.deleted", { name }));
      await loadBase();
    } catch (e: any) {
      showToast(e?.toString() || "Failed to delete", "error");
    }
    setWorkingSkill(null);
  };

  const handleInstallFromClawHub = async (skillId: string) => {
    setWorkingSkill(skillId);
    try {
      await api.clawhubInstall(agent, skillId);
      showToast(t("skills.installedFromClawhub", { name: skillId }));
      await loadBase();
    } catch (e: any) {
      showToast(e?.toString() || "Failed to install", "error");
    }
    setWorkingSkill(null);
  };

  const handleUpdateAll = async () => {
    setWorkingSkill("__update_all__");
    try {
      await api.clawhubUpdateAll(agent);
      showToast(t("skills.updatedAll"));
      await loadBase();
    } catch (e: any) {
      showToast(e?.toString() || "Failed to update", "error");
    }
    setWorkingSkill(null);
  };

  const handleSearch = async () => {
    if (!clawhubReady) return;
    setLoading(true);
    setCloudError("");
    try {
      setCloudSkills(query.trim() ? await api.clawhubSearch(query.trim()) : await api.clawhubExplore());
    } catch (e: any) {
      setCloudSkills([]);
      setCloudError(e?.toString() || "Failed to search ClawHub");
    }
    setLoading(false);
  };

  const renderMatchBadge = (name: string) => {
    if (skillRequirements.required.includes(name)) {
      return <span className="badge badge-success">{t("skills.required")}</span>;
    }
    if (skillRequirements.recommended.includes(name)) {
      return <span className="badge badge-warning">{t("skills.recommended")}</span>;
    }
    if (skillRequirements.optional.includes(name)) {
      return <span className="badge badge-muted">{t("skills.optional")}</span>;
    }
    return null;
  };

  const requirementRows = [
    { key: "required", items: skillRequirements.required, badge: "badge-success" },
    { key: "recommended", items: skillRequirements.recommended, badge: "badge-warning" },
    { key: "optional", items: skillRequirements.optional, badge: "badge-muted" },
  ] as const;

  return (
    <div className="page-shell">
      <div className="page-fixed">
        <div className="page-header">
          <h2>{t("skills.title")}</h2>
          <p>{t("skills.descOfficial", { count: installed.length, cloudCount: cloudSkills.length })}</p>
        </div>
        <div className="tabs">
          {(["overview", "installed", "cloud"] as Tab[]).map((item) => (
            <button key={item} className={`tab ${tab === item ? "active" : ""}`} onClick={() => setTab(item)}>
              {t(`skills.tab.${item}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="page-scroll">
        {loading ? (
          <div>{t("common.loading")}</div>
        ) : error ? (
          <div className="card"><p style={{ color: "var(--danger)" }}>{error}</p></div>
        ) : (
          <>
            {tab === "overview" && (
              <div className="skills-overview-grid">
                <div className="card">
                  <div className="card-header"><h3>{t("skills.currentPersona")}</h3></div>
                  {activePersona ? (
                    <>
                      <div className="skills-persona-head">
                        <div>
                          <div className="skills-persona-title">{activePersona.emoji} {activePersona.name}</div>
                          <div className="skills-persona-desc">{activePersona.description || activePersona.id}</div>
                        </div>
                        <span className="badge badge-success">{t("persona.active")}</span>
                      </div>
                      <div className="persona-skill-pack" style={{ marginTop: 16 }}>
                        <div className="persona-section-title">{t("skills.skillPackStatus")}</div>
                        {requirementRows.map((row) => (
                          <div key={row.key} className="skills-requirement-row">
                            <div className="skills-requirement-title"><span className={`badge ${row.badge}`}>{t(`skills.${row.key}`)}</span></div>
                            <div className="persona-tags">
                              {row.items.length === 0 ? <span className="persona-tag persona-tag-empty">—</span> : row.items.map((name) => {
                                const installedHere = installedSet.has(name);
                                const inCloud = cloudSet.has(name);
                                return <span key={`${row.key}-${name}`} className={`persona-tag ${installedHere ? "persona-tag-installed" : ""}`}>{name}{installedHere ? " ✓" : inCloud ? " ☁" : " ⚠"}</span>;
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : <p style={{ color: "var(--text-secondary)" }}>{t("skills.noActivePersona")}</p>}
                </div>
                <div className="card">
                  <div className="card-header"><h3>{t("skills.summary")}</h3></div>
                  <div className="skills-summary-list">
                    <div className="skills-summary-item"><span>{t("skills.installedCount")}</span><strong>{installed.length}</strong></div>
                    <div className="skills-summary-item"><span>{t("skills.cloudCount")}</span><strong>{cloudSkills.length}</strong></div>
                    <div className="skills-summary-item"><span>{t("skills.missingRequired")}</span><strong>{skillRequirements.required.filter((name) => !installedSet.has(name)).length}</strong></div>
                    <div className="skills-summary-item"><span>{t("skills.clawhubStatus")}</span><strong>{clawhubReady ? t("skills.ready") : t("skills.notReady")}</strong></div>
                  </div>
                </div>
              </div>
            )}

            {tab === "installed" && (
              installed.length === 0 ? (
                <div className="card"><p style={{ color: "var(--text-secondary)" }}>{t("skills.empty")}</p></div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                    <button className="btn btn-secondary" onClick={handleUpdateAll} disabled={!clawhubReady || workingSkill !== null}>
                      {workingSkill === "__update_all__" ? t("skills.working") : t("skills.updateAll")}
                    </button>
                  </div>
                  <div className="skills-grid">
                    {installed.map((skill) => (
                      <div key={skill.name} className="skill-card">
                        <div className="skill-card-header-row"><h4>{skill.name}</h4>{renderMatchBadge(skill.name)}</div>
                        <p>{skill.description}</p>
                        <div className="skill-meta">{t("skills.installedHere")}</div>
                        <div className="skill-actions">
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(skill.name)} disabled={workingSkill !== null}>
                            {workingSkill === skill.name ? t("skills.working") : t("skills.uninstall")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )
            )}

            {tab === "cloud" && (
              <>
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-header"><h3>{t("skills.officialCloudTitle")}</h3></div>
                  <p className="cloud-status-text">{clawhubReady ? t("skills.officialCloudReady") : t("skills.clawhubMissing")}</p>
                  {cloudError && <p className="cloud-status-error">{cloudError}</p>}
                  <div className="cloud-search-row">
                    <input className="form-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("skills.searchPlaceholder")} />
                    <button className="btn btn-secondary" onClick={handleSearch} disabled={!clawhubReady || loading}>{t("skills.searchBtn")}</button>
                    <button className="btn btn-secondary" onClick={() => { setQuery(""); loadBase(); }} disabled={loading}>{t("skills.resetSearch")}</button>
                  </div>
                </div>
                {cloudSkills.length === 0 ? (
                  <div className="card"><p style={{ color: "var(--text-secondary)" }}>{t("skills.cloudEmptyOfficial")}</p></div>
                ) : (
                  <div className="skills-grid">
                    {cloudSkills.map((skill) => {
                      const installedHere = installedSet.has(skill.id);
                      return (
                        <div key={skill.id} className="skill-card">
                          <div className="skill-card-header-row"><h4>{skill.name}</h4>{renderMatchBadge(skill.id)}</div>
                          <p>{skill.description}</p>
                          <div className="skill-meta">
                            {skill.version && <span>{t("skills.versionLabel")}: {skill.version}</span>}
                            <span style={{ marginLeft: 8 }}>{t("skills.sourceLabel")}: {skill.source}</span>
                          </div>
                          {skill.tags.length > 0 && <div className="persona-tags">{skill.tags.map((tag) => <span key={`${skill.id}-${tag}`} className="persona-tag">{tag}</span>)}</div>}
                          <div className="skill-actions">
                            <button className="btn btn-primary btn-sm" onClick={() => handleInstallFromClawHub(skill.id)} disabled={!clawhubReady || workingSkill !== null}>
                              {workingSkill === skill.id ? t("skills.working") : installedHere ? t("skills.reinstall") : t("skills.installFromClawhub")}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
