import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";

interface Props {
  agent: string;
}

export default function BackupPage({ agent }: Props) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [restoreStatus, setRestoreStatus] = useState<string>("");
  const [restoreError, setRestoreError] = useState<string>("");

  const handleBackup = async () => {
    try {
      setStatus(t("backup.backing"));
      setError("");
      const timestamp = new Date().toISOString().slice(0, 10);
      const outputPath = `~/Desktop/opensoul-backup-${agent}-${timestamp}.tar.gz`;
      const result = await api.backupPersona(agent, outputPath);
      setStatus(t("backup.backupSuccess", { path: result }));
    } catch (e: any) {
      setError(e.toString());
      setStatus("");
    }
  };

  const handleRestore = async () => {
    const path = prompt(t("backup.restorePrompt"));
    if (!path) return;
    if (!confirm(t("backup.restoreConfirm"))) return;
    try {
      setRestoreStatus(t("backup.restoring"));
      setRestoreError("");
      await api.restorePersonaBackup(agent, path);
      setRestoreStatus(t("backup.restoreSuccess"));
    } catch (e: any) {
      setRestoreError(e.toString());
      setRestoreStatus("");
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>{t("backup.title")}</h2>
        <p>{t("backup.desc")}</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>{t("backup.backupTitle")}</h3>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
          {t("backup.backupDesc")}
        </p>
        <button className="btn btn-primary" onClick={handleBackup}>
          {t("backup.backupNow")}
        </button>
        {status && (
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--success)" }}>{status}</p>
        )}
        {error && (
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--danger)" }}>{error}</p>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>{t("backup.restoreTitle")}</h3>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
          {t("backup.restoreDesc")}
        </p>
        <button className="btn btn-danger" onClick={handleRestore}>
          {t("backup.restoreBtn")}
        </button>
        {restoreStatus && (
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--success)" }}>{restoreStatus}</p>
        )}
        {restoreError && (
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--danger)" }}>{restoreError}</p>
        )}
      </div>
    </div>
  );
}
