import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api, PersonaMeta, CommunityPersona, SnapshotInfo, PersonaSkillPack } from "../api";

interface Props {
  agent: string;
}

type Tab = "my" | "community" | "create";
type SkillPackKey = keyof PersonaSkillPack;

const EMPTY_SKILL_PACK: PersonaSkillPack = {
  required: [],
  recommended: [],
  optional: [],
};

export default function PersonaPage({ agent }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("my");

  return (
    <div className="page-shell">
      <div className="page-fixed">
        <div className="page-header">
          <h2>{t("persona.title")}</h2>
          <p>{t("persona.desc")}</p>
        </div>
        <div className="tabs">
          {(["my", "community", "create"] as Tab[]).map((id) => (
            <button
              key={id}
              className={`tab ${tab === id ? "active" : ""}`}
              onClick={() => setTab(id)}
            >
              {t(`persona.tab.${id}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="page-scroll">
        {tab === "my" && <MyPersonas agent={agent} />}
        {tab === "community" && <CommunityPersonas agent={agent} />}
        {tab === "create" && <CreatePersona onCreated={() => setTab("my")} />}
      </div>
    </div>
  );
}

function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const show = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };
  const el = toast ? <div className={`toast toast-${toast.type}`}>{toast.msg}</div> : null;
  return { show, el };
}

function parseCommaList(input: string) {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatSkillPackCount(skillPack: PersonaSkillPack) {
  return skillPack.required.length + skillPack.recommended.length + skillPack.optional.length;
}

function MyPersonas({ agent }: { agent: string }) {
  const { t } = useTranslation();
  const [personas, setPersonas] = useState<PersonaMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [selectedForSnapshots, setSelectedForSnapshots] = useState<string | null>(null);
  const [savingCurrent, setSavingCurrent] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveForm, setSaveForm] = useState({
    id: "",
    name: "",
    description: "",
    tags: "",
    required: "",
    recommended: "",
    optional: "",
  });
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      setPersonas(await api.listPersonas(agent));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [agent]);

  const handleSwitch = async (id: string) => {
    if (switching) return;
    setSwitching(id);
    try {
      const installedSkills = await api.switchPersona(agent, id);
      if (installedSkills.length > 0) {
        toast.show(t("persona.switchedWithSkills", {
          name: id,
          count: installedSkills.length,
          skills: installedSkills.join(", "),
        }));
      } else {
        toast.show(t("persona.switched", { name: id }));
      }
      await load();
    } catch (e: any) {
      toast.show(e?.toString() || "Error", "error");
    }
    setSwitching(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("persona.confirmDelete", { name: id }))) return;
    try {
      await api.deletePersona(agent, id);
      toast.show(t("persona.deleted", { name: id }));
      if (selectedForSnapshots === id) setSelectedForSnapshots(null);
      await load();
    } catch (e: any) {
      toast.show(e?.toString() || "Error", "error");
    }
  };

  const handleSaveCurrent = async () => {
    const id = saveForm.id.trim();
    const name = saveForm.name.trim() || id;
    if (!id) {
      toast.show(t("persona.createValidation"), "error");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      toast.show(t("persona.createIdInvalid"), "error");
      return;
    }
    setSavingCurrent(true);
    try {
      await api.saveCurrentAsPersona(agent, id, name, saveForm.description.trim(), "🤖", parseCommaList(saveForm.tags), {
        required: parseCommaList(saveForm.required),
        recommended: parseCommaList(saveForm.recommended),
        optional: parseCommaList(saveForm.optional),
      });
      toast.show(t("persona.savedCurrent", { name }));
      setShowSaveForm(false);
      setSaveForm({ id: "", name: "", description: "", tags: "", required: "", recommended: "", optional: "" });
      await load();
    } catch (e: any) {
      toast.show(e?.toString() || "Error", "error");
    }
    setSavingCurrent(false);
  };

  if (loading) return <div>{t("common.loading")}</div>;

  if (selectedForSnapshots) {
    return (
      <div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setSelectedForSnapshots(null)}
          style={{ marginBottom: 16 }}
        >
          ← {t("persona.backToList")}
        </button>
        <SnapshotsPanel agent={agent} personaId={selectedForSnapshots} />
        {toast.el}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button
          className="btn btn-primary"
          onClick={() => setShowSaveForm((prev) => !prev)}
        >
          {showSaveForm ? t("persona.cancelSaveCurrent") : t("persona.saveCurrent")}
        </button>
      </div>

      {showSaveForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h3>{t("persona.saveCurrentTitle")}</h3>
          </div>
          <div className="create-form">
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>{t("persona.idLabel")}</label>
                <input className="form-input" value={saveForm.id} onChange={(e) => setSaveForm((prev) => ({ ...prev, id: e.target.value }))} placeholder="my-persona" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>{t("persona.nameLabel")}</label>
                <input className="form-input" value={saveForm.name} onChange={(e) => setSaveForm((prev) => ({ ...prev, name: e.target.value }))} placeholder={t("persona.namePlaceholder")} />
              </div>
            </div>
            <div className="form-group">
              <label>{t("persona.descLabel")}</label>
              <input className="form-input" value={saveForm.description} onChange={(e) => setSaveForm((prev) => ({ ...prev, description: e.target.value }))} placeholder={t("persona.descPlaceholder")} />
            </div>
            <div className="form-group">
              <label>{t("persona.tagsLabel")}</label>
              <input className="form-input" value={saveForm.tags} onChange={(e) => setSaveForm((prev) => ({ ...prev, tags: e.target.value }))} placeholder={t("persona.tagsPlaceholder")} />
            </div>
            <div className="persona-skill-pack-editor">
              <div className="persona-section-title">{t("persona.skillPackTitle")}</div>
              <div className="form-group">
                <label>{t("persona.required")}</label>
                <input className="form-input" value={saveForm.required} onChange={(e) => setSaveForm((prev) => ({ ...prev, required: e.target.value }))} placeholder={t("persona.skillsPlaceholder")} />
              </div>
              <div className="form-group">
                <label>{t("persona.recommended")}</label>
                <input className="form-input" value={saveForm.recommended} onChange={(e) => setSaveForm((prev) => ({ ...prev, recommended: e.target.value }))} placeholder={t("persona.skillsPlaceholder")} />
              </div>
              <div className="form-group">
                <label>{t("persona.optional")}</label>
                <input className="form-input" value={saveForm.optional} onChange={(e) => setSaveForm((prev) => ({ ...prev, optional: e.target.value }))} placeholder={t("persona.skillsPlaceholder")} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setShowSaveForm(false)} disabled={savingCurrent}>
                {t("persona.cancelSaveCurrent")}
              </button>
              <button className="btn btn-primary" onClick={handleSaveCurrent} disabled={savingCurrent}>
                {savingCurrent ? t("persona.savingCurrent") : t("persona.confirmSaveCurrent")}
              </button>
            </div>
          </div>
        </div>
      )}

      {personas.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>{t("persona.empty")}</p>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{t("persona.emptyHint")}</p>
        </div>
      ) : (
        <div className="persona-grid persona-grid-wide">
          {personas.map((p) => {
            const declaredCount = formatSkillPackCount(p.skill_pack);
            return (
              <div key={p.id} className={`persona-card ${p.is_active ? "persona-card-active" : ""}`}>
                <div className="persona-card-header">
                  <span className="persona-emoji">{p.emoji}</span>
                  <div className="persona-card-info">
                    <h4>
                      {p.name}
                      {p.current_version && (
                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>
                          {p.current_version}
                        </span>
                      )}
                    </h4>
                    {p.description && <p className="persona-card-desc">{p.description}</p>}
                  </div>
                  {p.is_active && <span className="badge badge-success">{t("persona.active")}</span>}
                </div>

                <div className="persona-card-stats">
                  <span className="persona-stat">🆔 {p.id}</span>
                  {p.source === "community" && <span className="persona-stat">🌐 {t("persona.communitySource")}</span>}
                  {p.has_memory && <span className="persona-stat">📚 {p.memory_count} {t("persona.memories")}</span>}
                  {p.has_skills && <span className="persona-stat">⚡ {p.skill_count} {t("persona.skillsLabel")}</span>}
                  {p.snapshot_count > 0 && <span className="persona-stat">📸 {p.snapshot_count} {t("persona.snapshots")}</span>}
                </div>

                {p.tags.length > 0 && (
                  <div className="persona-tags">
                    {p.tags.map((tag) => (
                      <span key={tag} className="persona-tag">#{tag}</span>
                    ))}
                  </div>
                )}

                <div className="persona-skill-pack">
                  <div className="persona-section-title">{t("persona.skillPackTitle")}</div>
                  <div className="persona-pack-summary">
                    <span className="persona-stat">{t("persona.requiredCount", { count: p.skill_pack.required.length })}</span>
                    <span className="persona-stat">{t("persona.recommendedCount", { count: p.skill_pack.recommended.length })}</span>
                    <span className="persona-stat">{t("persona.optionalCount", { count: p.skill_pack.optional.length })}</span>
                    <span className={`badge ${declaredCount > 0 ? "badge-warning" : "badge-muted"}`}>
                      {declaredCount > 0
                        ? t("persona.declaredSkills", { count: declaredCount })
                        : t("persona.noDeclaredSkills")}
                    </span>
                  </div>
                  <SkillPackChips label={t("persona.required")}
                    items={p.skill_pack.required} />
                  <SkillPackChips label={t("persona.recommended")}
                    items={p.skill_pack.recommended} />
                  <SkillPackChips label={t("persona.optional")}
                    items={p.skill_pack.optional} />
                </div>

                <div className="persona-card-actions">
                  {!p.is_active && (
                    <button className="btn btn-primary btn-sm" onClick={() => handleSwitch(p.id)} disabled={switching !== null}>
                      {switching === p.id ? t("persona.switching") : t("persona.switch")}
                    </button>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={() => setSelectedForSnapshots(p.id)}>
                    📸 {t("persona.viewSnapshots")}
                  </button>
                  {!p.is_active && (
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>
                      {t("persona.delete")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {toast.el}
    </div>
  );
}

function SkillPackChips({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="persona-skill-row">
      <span className="persona-skill-label">{label}</span>
      <div className="persona-tags">
        {items.length === 0 ? (
          <span className="persona-tag persona-tag-empty">—</span>
        ) : (
          items.map((item) => (
            <span key={`${label}-${item}`} className="persona-tag">
              {item}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function SnapshotsPanel({ agent, personaId }: { agent: string; personaId: string }) {
  const { t } = useTranslation();
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      setSnapshots(await api.listSnapshots(personaId));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [personaId]);

  const handleCreateSnapshot = async () => {
    try {
      const id = await api.createSnapshot(agent, personaId);
      toast.show(t("persona.snapshotCreated", { id }));
      await load();
    } catch (e: any) {
      toast.show(e?.toString() || "Error", "error");
    }
  };

  const handleRestore = async (snapId: string) => {
    if (!confirm(t("persona.confirmRestore", { id: snapId }))) return;
    try {
      await api.restoreSnapshot(agent, personaId, snapId);
      toast.show(t("persona.snapshotRestored", { id: snapId }));
      await load();
    } catch (e: any) {
      toast.show(e?.toString() || "Error", "error");
    }
  };

  const REASON_LABELS: Record<string, string> = {
    switch: "🔄",
    "pre-download": "⬇️",
    "pre-restore": "↩️",
    manual: "📌",
  };

  if (loading) return <div>{t("common.loading")}</div>;

  return (
    <div>
      <div className="card-header" style={{ marginBottom: 16 }}>
        <h3>📸 {t("persona.snapshotsTitle", { name: personaId })}</h3>
        <button className="btn btn-primary btn-sm" onClick={handleCreateSnapshot}>
          {t("persona.createSnapshotBtn")}
        </button>
      </div>

      {snapshots.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ color: "var(--text-muted)" }}>{t("persona.noSnapshots")}</p>
        </div>
      ) : (
        <div className="memory-timeline">
          {snapshots.map((s) => (
            <div key={s.id} className="memory-item">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div className="date">{REASON_LABELS[s.reason] || "📸"} {s.created_at}</div>
                  <div className="preview">
                    {t(`persona.reason.${s.reason}`, { defaultValue: s.reason })}
                    {s.has_memory && " · 📚"}
                    {s.has_skills && " · ⚡"}
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => handleRestore(s.id)}>
                  ↩️ {t("persona.restore")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {toast.el}
    </div>
  );
}

function CommunityPersonas({ agent }: { agent: string }) {
  const { t } = useTranslation();
  const [personas, setPersonas] = useState<CommunityPersona[]>([]);
  const [localIds, setLocalIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const toast = useToast();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [community, local] = await Promise.all([
          api.fetchCommunityPersonas(),
          api.listPersonas(agent),
        ]);
        setPersonas(community);
        setLocalIds(new Set(local.map((p) => p.id)));
      } catch (e: any) {
        setError(e?.toString() || "Failed to load");
      }
      setLoading(false);
    })();
  }, [agent]);

  const handleDownload = async (id: string) => {
    setDownloading(id);
    try {
      const exists = await api.checkPersonaExists(id);
      let force = false;
      if (exists) {
        if (!confirm(t("persona.overwriteConfirm", { name: id }))) {
          setDownloading(null);
          return;
        }
        force = true;
      }
      const result = await api.downloadCommunityPersona(agent, id, force);
      toast.show(
        result.startsWith("backed_up:")
          ? t("persona.downloadedWithBackup", { name: id })
          : t("persona.downloaded", { name: id })
      );
      setLocalIds((prev) => new Set([...prev, id]));
    } catch (e: any) {
      toast.show(e?.toString() || "Error", "error");
    }
    setDownloading(null);
  };

  if (loading) return <div>{t("common.loading")}</div>;
  if (error) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 40 }}>
        <p style={{ color: "var(--danger)", marginBottom: 8 }}>{t("persona.communityError")}</p>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{error}</p>
      </div>
    );
  }
  if (personas.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 40 }}>
        <p style={{ color: "var(--text-secondary)" }}>{t("persona.communityEmpty")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="persona-grid">
        {personas.map((p) => {
          const installed = localIds.has(p.id);
          return (
            <div key={p.id} className="persona-card">
              <div className="persona-card-header">
                <span className="persona-emoji">{p.emoji}</span>
                <div className="persona-card-info">
                  <h4>{p.name}</h4>
                  <p className="persona-card-desc">{p.description}</p>
                </div>
              </div>
              <div className="persona-card-stats">
                {p.author && <span className="persona-stat">👤 {p.author}</span>}
                {p.tags.length > 0 && (
                  <div className="persona-tags">
                    {p.tags.map((tag) => (
                      <span key={tag} className="persona-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="persona-card-actions">
                <button className="btn btn-primary btn-sm" onClick={() => handleDownload(p.id)} disabled={downloading !== null}>
                  {downloading === p.id ? t("persona.downloading") : installed ? t("persona.redownload") : t("persona.download")}
                </button>
                {installed && <span className="badge badge-success">{t("persona.installed")}</span>}
              </div>
            </div>
          );
        })}
      </div>
      {toast.el}
    </div>
  );
}

function CreatePersona({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🤖");
  const [tagsInput, setTagsInput] = useState("");
  const [skillPack, setSkillPack] = useState<PersonaSkillPack>(EMPTY_SKILL_PACK);
  const [soulContent, setSoulContent] = useState("");
  const [identityContent, setIdentityContent] = useState("");
  const [agentsContent, setAgentsContent] = useState("");
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const updateSkillPack = (key: SkillPackKey, value: string) => {
    setSkillPack((prev) => ({
      ...prev,
      [key]: parseCommaList(value),
    }));
  };

  const handleCreate = async () => {
    if (!id.trim() || !name.trim()) {
      toast.show(t("persona.createValidation"), "error");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      toast.show(t("persona.createIdInvalid"), "error");
      return;
    }
    setCreating(true);
    try {
      await api.createPersona({
        id,
        name,
        description,
        emoji,
        soulContent,
        identityContent,
        agentsContent,
        tags: parseCommaList(tagsInput),
        skillPack,
      });
      toast.show(t("persona.created", { name }));
      onCreated();
    } catch (e: any) {
      toast.show(e?.toString() || "Error", "error");
    }
    setCreating(false);
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3>{t("persona.createTitle")}</h3>
        </div>
        <div className="create-form">
          <div className="form-row">
            <div className="form-group" style={{ flex: "0 0 80px" }}>
              <label>{t("persona.emojiLabel")}</label>
              <input className="form-input form-input-emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>{t("persona.idLabel")}</label>
              <input className="form-input" placeholder="my-persona" value={id} onChange={(e) => setId(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>{t("persona.nameLabel")}</label>
              <input className="form-input" placeholder={t("persona.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>{t("persona.descLabel")}</label>
            <input className="form-input" placeholder={t("persona.descPlaceholder")} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="form-group">
            <label>{t("persona.tagsLabel")}</label>
            <input className="form-input" placeholder={t("persona.tagsPlaceholder")} value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
          </div>
          <div className="persona-skill-pack-editor">
            <div className="persona-section-title">{t("persona.skillPackTitle")}</div>
            <div className="form-group">
              <label>{t("persona.required")}</label>
              <input className="form-input" placeholder={t("persona.skillsPlaceholder")} onChange={(e) => updateSkillPack("required", e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t("persona.recommended")}</label>
              <input className="form-input" placeholder={t("persona.skillsPlaceholder")} onChange={(e) => updateSkillPack("recommended", e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t("persona.optional")}</label>
              <input className="form-input" placeholder={t("persona.skillsPlaceholder")} onChange={(e) => updateSkillPack("optional", e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>SOUL.md</label>
            <textarea className="editor-textarea" style={{ minHeight: 120 }} placeholder={t("persona.soulPlaceholder")} value={soulContent} onChange={(e) => setSoulContent(e.target.value)} />
          </div>
          <div className="form-group">
            <label>IDENTITY.md</label>
            <textarea className="editor-textarea" style={{ minHeight: 100 }} placeholder={t("persona.identityPlaceholder")} value={identityContent} onChange={(e) => setIdentityContent(e.target.value)} />
          </div>
          <div className="form-group">
            <label>AGENTS.md</label>
            <textarea className="editor-textarea" style={{ minHeight: 100 }} placeholder={t("persona.agentsPlaceholder")} value={agentsContent} onChange={(e) => setAgentsContent(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={handleCreate} disabled={creating} style={{ marginTop: 8 }}>
            {creating ? t("persona.creating") : t("persona.createBtn")}
          </button>
        </div>
      </div>
      {toast.el}
    </div>
  );
}
