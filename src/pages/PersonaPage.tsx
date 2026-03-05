import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api, PersonaMeta, CommunityPersona, SnapshotInfo } from "../api";

interface Props {
  agent: string;
}

type Tab = "my" | "community" | "create";

export default function PersonaPage({ agent }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("my");

  return (
    <div>
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
      {tab === "my" && <MyPersonas agent={agent} />}
      {tab === "community" && <CommunityPersonas agent={agent} />}
      {tab === "create" && <CreatePersona onCreated={() => setTab("my")} />}
    </div>
  );
}

// ============================================================
// Toast helper
// ============================================================
function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const show = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };
  const el = toast ? <div className={`toast toast-${toast.type}`}>{toast.msg}</div> : null;
  return { show, el };
}

// ============================================================
// My Personas
// ============================================================
function MyPersonas({ agent }: { agent: string }) {
  const { t } = useTranslation();
  const [personas, setPersonas] = useState<PersonaMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [selectedForSnapshots, setSelectedForSnapshots] = useState<string | null>(null);
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

  useEffect(() => { load(); }, [agent]);

  const handleSwitch = async (id: string) => {
    if (switching) return;
    setSwitching(id);
    try {
      await api.switchPersona(agent, id);
      toast.show(t("persona.switched", { name: id }));
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
    const id = prompt(t("persona.saveCurrentPrompt"));
    if (!id) return;
    const name = prompt(t("persona.namePrompt"), id) || id;
    try {
      await api.saveCurrentAsPersona(agent, id, name, "", "🤖");
      toast.show(t("persona.savedCurrent", { name }));
      await load();
    } catch (e: any) {
      toast.show(e?.toString() || "Error", "error");
    }
  };

  if (loading) return <div>{t("common.loading")}</div>;

  // Show snapshots panel if a persona is selected
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
        <SnapshotsPanel personaId={selectedForSnapshots} />
        {toast.el}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={handleSaveCurrent}>
          {t("persona.saveCurrent")}
        </button>
      </div>

      {personas.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
            {t("persona.empty")}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            {t("persona.emptyHint")}
          </p>
        </div>
      ) : (
        <div className="persona-grid">
          {personas.map((p) => (
            <div
              key={p.id}
              className={`persona-card ${p.is_active ? "persona-card-active" : ""}`}
            >
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
                {p.is_active && (
                  <span className="badge badge-success">{t("persona.active")}</span>
                )}
              </div>

              <div className="persona-card-stats">
                {p.source === "community" && (
                  <span className="persona-stat">🌐 {t("persona.communitySource")}</span>
                )}
                {p.has_memory && (
                  <span className="persona-stat">📚 {p.memory_count} {t("persona.memories")}</span>
                )}
                {p.has_skills && (
                  <span className="persona-stat">⚡ {p.skill_count} {t("persona.skillsLabel")}</span>
                )}
                {p.snapshot_count > 0 && (
                  <span className="persona-stat">📸 {p.snapshot_count} {t("persona.snapshots")}</span>
                )}
              </div>

              <div className="persona-card-actions">
                {!p.is_active && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleSwitch(p.id)}
                    disabled={switching !== null}
                  >
                    {switching === p.id ? t("persona.switching") : t("persona.switch")}
                  </button>
                )}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedForSnapshots(p.id)}
                >
                  📸 {t("persona.viewSnapshots")}
                </button>
                {!p.is_active && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(p.id)}
                  >
                    {t("persona.delete")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {toast.el}
    </div>
  );
}

// ============================================================
// Snapshots Panel
// ============================================================
function SnapshotsPanel({ personaId }: { personaId: string }) {
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

  useEffect(() => { load(); }, [personaId]);

  const handleCreateSnapshot = async () => {
    try {
      const id = await api.createSnapshot(personaId);
      toast.show(t("persona.snapshotCreated", { id }));
      await load();
    } catch (e: any) {
      toast.show(e?.toString() || "Error", "error");
    }
  };

  const handleRestore = async (snapId: string) => {
    if (!confirm(t("persona.confirmRestore", { id: snapId }))) return;
    try {
      await api.restoreSnapshot(personaId, snapId);
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
                  <div className="date">
                    {REASON_LABELS[s.reason] || "📸"} {s.created_at}
                  </div>
                  <div className="preview">
                    {t(`persona.reason.${s.reason}`, { defaultValue: s.reason })}
                    {s.has_memory && " · 📚"}
                    {s.has_skills && " · ⚡"}
                  </div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleRestore(s.id)}
                >
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

// ============================================================
// Community Personas
// ============================================================
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
      // Check if exists locally
      const exists = await api.checkPersonaExists(id);
      let force = false;
      if (exists) {
        if (!confirm(t("persona.overwriteConfirm", { name: id }))) {
          setDownloading(null);
          return;
        }
        force = true;
      }
      const result = await api.downloadCommunityPersona(id, force);
      if (result.startsWith("backed_up:")) {
        toast.show(t("persona.downloadedWithBackup", { name: id }));
      } else {
        toast.show(t("persona.downloaded", { name: id }));
      }
      setLocalIds((prev) => new Set([...prev, id]));
    } catch (e: any) {
      if (e?.toString().includes("EXISTS_LOCALLY")) {
        // Shouldn't reach here since we check first, but handle gracefully
        if (confirm(t("persona.overwriteConfirm", { name: id }))) {
          try {
            const result = await api.downloadCommunityPersona(id, true);
            toast.show(
              result.startsWith("backed_up:")
                ? t("persona.downloadedWithBackup", { name: id })
                : t("persona.downloaded", { name: id })
            );
          } catch (e2: any) {
            toast.show(e2?.toString() || "Error", "error");
          }
        }
      } else {
        toast.show(e?.toString() || "Error", "error");
      }
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
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleDownload(p.id)}
                  disabled={downloading !== null}
                >
                  {downloading === p.id
                    ? t("persona.downloading")
                    : installed
                      ? t("persona.redownload")
                      : t("persona.download")}
                </button>
                {installed && (
                  <span className="badge badge-success">{t("persona.installed")}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {toast.el}
    </div>
  );
}

// ============================================================
// Create Persona
// ============================================================
function CreatePersona({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🤖");
  const [soulContent, setSoulContent] = useState("");
  const [identityContent, setIdentityContent] = useState("");
  const [agentsContent, setAgentsContent] = useState("");
  const [creating, setCreating] = useState(false);
  const toast = useToast();

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
        id, name, description, emoji,
        soulContent, identityContent, agentsContent,
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
              <input
                className="form-input form-input-emoji"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={4}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>{t("persona.idLabel")}</label>
              <input
                className="form-input"
                placeholder="my-persona"
                value={id}
                onChange={(e) => setId(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>{t("persona.nameLabel")}</label>
              <input
                className="form-input"
                placeholder={t("persona.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <label>{t("persona.descLabel")}</label>
            <input
              className="form-input"
              placeholder={t("persona.descPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>SOUL.md</label>
            <textarea
              className="editor-textarea"
              style={{ minHeight: 120 }}
              placeholder={t("persona.soulPlaceholder")}
              value={soulContent}
              onChange={(e) => setSoulContent(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>IDENTITY.md</label>
            <textarea
              className="editor-textarea"
              style={{ minHeight: 100 }}
              placeholder={t("persona.identityPlaceholder")}
              value={identityContent}
              onChange={(e) => setIdentityContent(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>AGENTS.md</label>
            <textarea
              className="editor-textarea"
              style={{ minHeight: 100 }}
              placeholder={t("persona.agentsPlaceholder")}
              value={agentsContent}
              onChange={(e) => setAgentsContent(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={creating}
            style={{ marginTop: 8 }}
          >
            {creating ? t("persona.creating") : t("persona.createBtn")}
          </button>
        </div>
      </div>
      {toast.el}
    </div>
  );
}
