import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, SkillInfo, PersonaMeta, CloudSkillInfo } from "../api";

interface Props {
  agent: string;
}

type Tab = "overview" | "installed" | "hub";
type HubSubTab = "local" | "cloud";

export default function SkillsPage({ agent }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("overview");
  const [hubTab, setHubTab] = useState<HubSubTab>("local");
  const [installed, setInstalled] = useState<SkillInfo[]>([]);
  const [hubSkills, setHubSkills] = useState<SkillInfo[]>([]);
  const [cloudSkills, setCloudSkills] = useState<CloudSkillInfo[]>([]);
  const [activePersona, setActivePersona] = useState<PersonaMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingSkill, setWorkingSkill] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [installedSkills, hub, cloud, personas] = await Promise.all([
        api.listSkills(agent),
        api.listHubSkills(),
        api.fetchCloudSkills().catch(() => []),
        api.listPersonas(agent),
      ]);
      setInstalled(installedSkills);
      setHubSkills(hub);
      setCloudSkills(cloud);
      setActivePersona(personas.find((p) => p.is_active) ?? null);
    } catch (e: any) {
      setError(e?.toString() || "Failed to load skills");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [agent]);

  const installedSet = useMemo(() => new Set(installed.map((s) => s.name)), [installed]);
  const hubSet = useMemo(() => new Set(hubSkills.map((s) => s.name)), [hubSkills]);
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
      await load();
    } catch (e: any) {
      showToast(e?.toString() || "Failed to delete", "error");
    }
    setWorkingSkill(null);
  };

  const handleInstallFromHub = async (name: string) => {
    setWorkingSkill(name);
    try {
      const source = await api.installSkillFromHub(agent, name);
      showToast(t("skills.installedFromHub", { name, source: t(`skills.source.${source}`) }));
      await load();
    } catch (e: any) {
      showToast(e?.toString() || "Failed to install", "error");
    }
    setWorkingSkill(null);
  };

  const handleDeleteHubSkill = async (name: string) => {
    if (!confirm(t("skills.confirmDeleteHub", { name }))) return;
    setWorkingSkill(name);
    try {
      await api.deleteHubSkill(name);
      showToast(t("skills.deletedHub", { name }));
      await load();
    } catch (e: any) {
      showToast(e?.toString() || "Failed to delete", "error");
    }
    setWorkingSkill(null);
  };

  const handleDownloadToHub = async (skillId: string) => {
    setWorkingSkill(skillId);
    try {
      const name = await api.downloadCloudSkillToHub(skillId);
      showToast(t("skills.downloadedToHub", { name }));
      await load();
    } catch (e: any) {
      showToast(e?.toString() || "Failed to download", "error");
    }
    setWorkingSkill(null);
  };

  const handleDownloadToPersona = async (skillId: string) => {
    setWorkingSkill(skillId);
    try {
      const name = await api.downloadCloudSkillToPersona(agent, skillId);
      showToast(t("skills.downloadedToPersona", { name }));
      await load();
    } catch (e: any) {
      showToast(e?.toString() || "Failed to download", "error");
    }
    setWorkingSkill(null);
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
          <p>
            {t("skills.desc", {
              count: installed.length,
              hubCount: hubSkills.length,
            })}
          </p>
        </div>
        <div className="tabs">
          {(["overview", "installed", "hub"] as Tab[]).map((item) => (
            <button
              key={item}
              className={`tab ${tab === item ? "active" : ""}`}
              onClick={() => setTab(item)}
            >
              {t(`skills.tab.${item}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="page-scroll">
        {loading ? (
          <div>{t("common.loading")}</div>
        ) : error ? (
          <div className="card">
            <p style={{ color: "var(--danger)" }}>{error}</p>
          </div>
        ) : (
          <>
            {tab === "overview" && (
              <div className="skills-overview-grid">
                <div className="card">
                  <div className="card-header">
                    <h3>{t("skills.currentPersona")}</h3>
                  </div>
                  {activePersona ? (
                    <>
                      <div className="skills-persona-head">
                        <div>
                          <div className="skills-persona-title">
                            {activePersona.emoji} {activePersona.name}
                          </div>
                          <div className="skills-persona-desc">{activePersona.description || activePersona.id}</div>
                        </div>
                        <span className="badge badge-success">{t("persona.active")}</span>
                      </div>

                      <div className="persona-skill-pack" style={{ marginTop: 16 }}>
                        <div className="persona-section-title">{t("skills.skillPackStatus")}</div>
                        {requirementRows.map((row) => (
                          <div key={row.key} className="skills-requirement-row">
                            <div className="skills-requirement-title">
                              <span className={`badge ${row.badge}`}>{t(`skills.${row.key}`)}</span>
                            </div>
                            <div className="persona-tags">
                              {row.items.length === 0 ? (
                                <span className="persona-tag persona-tag-empty">—</span>
                              ) : (
                                row.items.map((name) => {
                                  const installedHere = installedSet.has(name);
                                  const inHub = hubSet.has(name);
                                  const inCloud = cloudSet.has(name);
                                  return (
                                    <span key={`${row.key}-${name}`} className={`persona-tag ${installedHere ? "persona-tag-installed" : ""}`}>
                                      {name}
                                      {installedHere ? " ✓" : inHub ? " ⬇" : inCloud ? " ☁" : " ⚠"}
                                    </span>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p style={{ color: "var(--text-secondary)" }}>{t("skills.noActivePersona")}</p>
                  )}
                </div>

                <div className="card">
                  <div className="card-header">
                    <h3>{t("skills.summary")}</h3>
                  </div>
                  <div className="skills-summary-list">
                    <div className="skills-summary-item">
                      <span>{t("skills.installedCount")}</span>
                      <strong>{installed.length}</strong>
                    </div>
                    <div className="skills-summary-item">
                      <span>{t("skills.hubCount")}</span>
                      <strong>{hubSkills.length}</strong>
                    </div>
                    <div className="skills-summary-item">
                      <span>{t("skills.cloudCount")}</span>
                      <strong>{cloudSkills.length}</strong>
                    </div>
                    <div className="skills-summary-item">
                      <span>{t("skills.missingRequired")}</span>
                      <strong>
                        {skillRequirements.required.filter((name) => !installedSet.has(name)).length}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === "installed" && (
              installed.length === 0 ? (
                <div className="card">
                  <p style={{ color: "var(--text-secondary)" }}>
                    {t("skills.empty")} <code>{t("skills.emptyCmd")}</code>
                  </p>
                </div>
              ) : (
                <div className="skills-grid">
                  {installed.map((skill) => (
                    <div key={skill.name} className="skill-card">
                      <div className="skill-card-header-row">
                        <h4>{skill.name}</h4>
                        {renderMatchBadge(skill.name)}
                      </div>
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
              )
            )}

            {tab === "hub" && (
              <>
                <div className="subtabs" style={{ marginBottom: 16 }}>
                  {(["local", "cloud"] as HubSubTab[]).map((item) => (
                    <button
                      key={item}
                      className={`subtab ${hubTab === item ? "active" : ""}`}
                      onClick={() => setHubTab(item)}
                    >
                      {t(`skills.hubTab.${item}`)}
                    </button>
                  ))}
                </div>

                {hubTab === "local" && (
                  hubSkills.length === 0 ? (
                    <div className="card">
                      <p style={{ color: "var(--text-secondary)" }}>{t("skills.hubEmpty")}</p>
                    </div>
                  ) : (
                    <div className="skills-grid">
                      {hubSkills.map((skill) => {
                        const alreadyInstalled = installedSet.has(skill.name);
                        const localHubSkill = skill.source === "hub";
                        return (
                          <div key={`${skill.source}-${skill.name}`} className="skill-card">
                            <div className="skill-card-header-row">
                              <h4>{skill.name}</h4>
                              {renderMatchBadge(skill.name)}
                            </div>
                            <p>{skill.description}</p>
                            <div className="skill-meta">
                              {t("skills.sourceLabel")}: {t(`skills.source.${skill.source || "hub"}`)}
                            </div>
                            <div className="skill-actions">
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleInstallFromHub(skill.name)}
                                disabled={workingSkill !== null}
                              >
                                {workingSkill === skill.name
                                  ? t("skills.working")
                                  : alreadyInstalled
                                    ? t("skills.copyAgain")
                                    : t("skills.copyToPersona")}
                              </button>
                              {localHubSkill && (
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleDeleteHubSkill(skill.name)}
                                  disabled={workingSkill !== null}
                                >
                                  {t("skills.removeFromHub")}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}

                {hubTab === "cloud" && (
                  cloudSkills.length === 0 ? (
                    <div className="card">
                      <p style={{ color: "var(--text-secondary)" }}>{t("skills.cloudEmpty")}</p>
                    </div>
                  ) : (
                    <div className="skills-grid">
                      {cloudSkills.map((skill) => {
                        const cached = hubSet.has(skill.id);
                        const installedHere = installedSet.has(skill.id);
                        return (
                          <div key={skill.id} className="skill-card">
                            <div className="skill-card-header-row">
                              <h4>{skill.name}</h4>
                              {renderMatchBadge(skill.id)}
                            </div>
                            <p>{skill.description}</p>
                            <div className="skill-meta">
                              {skill.version && <span>{t("skills.versionLabel")}: {skill.version}</span>}
                              <span style={{ marginLeft: 8 }}>{t("skills.sourceLabel")}: {skill.source || "opensoul"}</span>
                            </div>
                            {skill.tags.length > 0 && (
                              <div className="persona-tags">
                                {skill.tags.map((tag) => (
                                  <span key={`${skill.id}-${tag}`} className="persona-tag">{tag}</span>
                                ))}
                              </div>
                            )}
                            <div className="skill-actions">
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleDownloadToHub(skill.id)}
                                disabled={workingSkill !== null}
                              >
                                {workingSkill === skill.id
                                  ? t("skills.working")
                                  : cached
                                    ? t("skills.redownloadToHub")
                                    : t("skills.downloadToHub")}
                              </button>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleDownloadToPersona(skill.id)}
                                disabled={workingSkill !== null}
                              >
                                {workingSkill === skill.id
                                  ? t("skills.working")
                                  : installedHere
                                    ? t("skills.redownloadToPersona")
                                    : t("skills.downloadToPersona")}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
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
