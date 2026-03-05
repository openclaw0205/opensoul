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
        <button className="btn btn-secondary" disabled>
          {t("backup.restoreBtn")}
        </button>
      </div>
    </div>
  );
}
