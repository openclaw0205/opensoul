import { useState } from "react";
import { api } from "../api";

interface Props {
  agent: string;
}

export default function BackupPage({ agent }: Props) {
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleBackup = async () => {
    try {
      setStatus("Backing up...");
      setError("");
      const timestamp = new Date().toISOString().slice(0, 10);
      const outputPath = `${process.env.HOME || "~"}/Desktop/opensoul-backup-${agent}-${timestamp}.tar.gz`;
      const result = await api.backupPersona(agent, outputPath);
      setStatus(`✅ Backup saved to: ${result}`);
    } catch (e: any) {
      setError(e.toString());
      setStatus("");
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>💾 Backup & Restore</h2>
        <p>Backup and restore your AI persona</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Backup</h3>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
          Create a snapshot of the current persona (SOUL.md, IDENTITY.md, memory, skills, etc.)
        </p>
        <button className="btn btn-primary" onClick={handleBackup}>
          📦 Backup Now
        </button>
        {status && (
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--success)" }}>
            {status}
          </p>
        )}
        {error && (
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--danger)" }}>
            {error}
          </p>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Restore</h3>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
          Restore persona from a previous backup file. This will overwrite current files.
        </p>
        <button className="btn btn-secondary" disabled>
          🔄 Restore (coming soon)
        </button>
      </div>
    </div>
  );
}
