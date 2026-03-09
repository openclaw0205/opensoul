import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, SnapshotListItem, PersonaMeta } from "../api";

interface Props {
  agent: string;
}

export default function BackupPage({ agent }: Props) {
  const { t } = useTranslation();
  const [snapshots, setSnapshots] = useState<SnapshotListItem[]>([]);
  const [personas, setPersonas] = useState<PersonaMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [restoreStatus, setRestoreStatus] = useState("");
  const [restoreError, setRestoreError] = useState("");
  const [archiveStatus, setArchiveStatus] = useState("");
  const [archiveError, setArchiveError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [allSnapshots, allPersonas] = await Promise.all([
        api.listAllSnapshots(agent),
        api.listPersonas(agent),
      ]);
      setSnapshots(allSnapshots);
      setPersonas(allPersonas);
      setSelectedId((prev) => prev || allSnapshots[0]?.id || "");
    } catch (e: any) {
      setError(e?.toString() || "Failed to load backups");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [agent]);

  const activePersona = useMemo(
    () => personas.find((item) => item.is_active) ?? null,
    [personas]
  );

  const selected = useMemo(
    () => snapshots.find((item) => item.id === selectedId) ?? null,
    [snapshots, selectedId]
  );

  const handleCreateSnapshot = async () => {
    if (!activePersona) return;
    try {
      setStatus(t("backup.creatingSnapshot"));
      setError("");
      const id = await api.createSnapshot(agent, activePersona.id);
      setStatus(t("backup.snapshotCreated", { id, name: activePersona.name }));
      await load();
      setSelectedId(id);
    } catch (e: any) {
      setError(e?.toString() || "Failed to create snapshot");
      setStatus("");
    }
  };

  const handleRestoreSnapshot = async () => {
    if (!selected) return;
    if (!confirm(t("backup.restoreSnapshotConfirm", { name: selected.persona_name, id: selected.id }))) {
      return;
    }
    try {
      setRestoreStatus(t("backup.restoringSnapshot"));
      setRestoreError("");
      await api.restoreSnapshot(agent, selected.persona_id, selected.id);
      setRestoreStatus(t("backup.snapshotRestored", { name: selected.persona_name, id: selected.id }));
      await load();
    } catch (e: any) {
      setRestoreError(e?.toString() || "Failed to restore snapshot");
      setRestoreStatus("");
    }
  };

  const handleArchiveBackup = async () => {
    try {
      setArchiveStatus(t("backup.backing"));
      setArchiveError("");
      const timestamp = new Date().toISOString().slice(0, 10);
      const outputPath = `~/Desktop/opensoul-backup-${agent}-${timestamp}.tar.gz`;
      const result = await api.backupPersona(agent, outputPath);
      setArchiveStatus(t("backup.backupSuccess", { path: result }));
    } catch (e: any) {
      setArchiveError(e?.toString());
      setArchiveStatus("");
    }
  };

  const handleArchiveRestore = async () => {
    const path = prompt(t("backup.restorePrompt"));
    if (!path) return;
    if (!confirm(t("backup.restoreConfirm"))) return;
    try {
      setArchiveStatus(t("backup.restoring"));
      setArchiveError("");
      await api.restorePersonaBackup(agent, path);
      setArchiveStatus(t("backup.restoreSuccess"));
      await load();
    } catch (e: any) {
      setArchiveError(e?.toString());
      setArchiveStatus("");
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header page-fixed">
        <h2>{t("backup.title")}</h2>
        <p>{t("backup.desc")}</p>
      </div>
      <div className="page-scroll">
        {loading ? (
          <div>{t("common.loading")}</div>
        ) : error ? (
          <div className="card"><p style={{ color: "var(--danger)" }}>{error}</p></div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <h3>{t("backup.snapshotActionsTitle")}</h3>
                <button className="btn btn-primary" onClick={handleCreateSnapshot} disabled={!activePersona}>
                  {t("backup.createSnapshotNow")}
                </button>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                {activePersona
                  ? t("backup.snapshotActionDesc", { name: activePersona.name })
                  : t("backup.noActivePersona")}
              </p>
              {status && <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-primary)" }}>{status}</p>}
              {restoreStatus && <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-primary)" }}>{restoreStatus}</p>}
              {restoreError && <p style={{ marginTop: 12, fontSize: 13, color: "var(--danger)" }}>{restoreError}</p>}
            </div>

            <div className="page-split" style={{ alignItems: "stretch" }}>
              <div className="card page-pane-scroll backup-list-pane" style={{ width: 360, marginBottom: 0 }}>
                <div className="card-header">
                  <h3>{t("backup.snapshotListTitle")}</h3>
                </div>
                {snapshots.length === 0 ? (
                  <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>{t("backup.noSnapshotsGlobal")}</p>
                ) : (
                  <div className="memory-timeline">
                    {snapshots.map((item) => (
                      <div
                        key={`${item.persona_id}-${item.id}`}
                        className={`memory-item ${selectedId === item.id ? "backup-item-active" : ""}`}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <div className="date">{item.persona_name}</div>
                        <div className="preview">{item.created_at}</div>
                        <div className="backup-item-meta-row">
                          <span className="badge badge-muted">{t(`backup.source.${item.persona_source}`, { defaultValue: item.persona_source })}</span>
                          {item.is_active_persona && <span className="badge badge-success">{t("backup.currentPersona")}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card page-pane-scroll" style={{ flex: 1, marginBottom: 0 }}>
                <div className="card-header">
                  <h3>{t("backup.snapshotDetailTitle")}</h3>
                  {selected && (
                    <button className="btn btn-danger" onClick={handleRestoreSnapshot}>
                      {t("backup.restoreSnapshotBtn")}
                    </button>
                  )}
                </div>
                {!selected ? (
                  <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>{t("backup.selectSnapshot")}</p>
                ) : (
                  <div className="backup-detail-grid">
                    <div className="backup-detail-row"><span>{t("backup.personaLabel")}</span><strong>{selected.persona_name}</strong></div>
                    <div className="backup-detail-row"><span>{t("backup.personaIdLabel")}</span><strong>{selected.persona_id}</strong></div>
                    <div className="backup-detail-row"><span>{t("backup.createdAtLabel")}</span><strong>{selected.created_at}</strong></div>
                    <div className="backup-detail-row"><span>{t("backup.reasonLabel")}</span><strong>{t(`persona.reason.${selected.reason}`, { defaultValue: selected.reason })}</strong></div>
                    <div className="backup-detail-row"><span>{t("backup.sourceLabel")}</span><strong>{t(`backup.source.${selected.persona_source}`, { defaultValue: selected.persona_source })}</strong></div>
                    <div className="backup-detail-row"><span>{t("backup.includesLabel")}</span><strong>{[
                      selected.has_memory ? t("backup.includesMemory") : null,
                      selected.has_skills ? t("backup.includesSkills") : null,
                    ].filter(Boolean).join(" · ") || t("backup.includesBaseOnly")}</strong></div>
                  </div>
                )}
              </div>
            </div>

            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <h3>{t("backup.archiveTitle")}</h3>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
                {t("backup.archiveDesc")}
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="btn btn-secondary" onClick={handleArchiveBackup}>{t("backup.backupNow")}</button>
                <button className="btn btn-secondary" onClick={handleArchiveRestore}>{t("backup.restoreBtn")}</button>
              </div>
              {archiveStatus && <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-primary)" }}>{archiveStatus}</p>}
              {archiveError && <p style={{ marginTop: 12, fontSize: 13, color: "var(--danger)" }}>{archiveError}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
