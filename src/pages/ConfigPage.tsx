import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";

// Sections that contain sensitive data - mask values by default
const SENSITIVE_KEYS = new Set(["apiKey", "token", "secret", "password", "apikey"]);

interface Props {
  agent: string;
}

export default function ConfigPage({ agent: _agent }: Props) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<Record<string, any> | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [showSensitive, setShowSensitive] = useState(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    api.readConfig().then((raw) => {
      try {
        setConfig(JSON.parse(raw));
      } catch {
        setConfig({});
      }
    });
  }, []);

  const handleEditSection = (key: string) => {
    if (!config) return;
    setEditingSection(key);
    setEditContent(JSON.stringify(config[key], null, 2));
    setDirty(false);
  };

  const handleSave = async () => {
    if (!config || !editingSection) return;
    try {
      const parsed = JSON.parse(editContent);
      const newConfig = { ...config, [editingSection]: parsed };
      await api.saveConfig(JSON.stringify(newConfig, null, 2));
      setConfig(newConfig);
      setDirty(false);
      showToast(t("config.saved"));
    } catch (e: any) {
      showToast(e?.toString() || "Invalid JSON", "error");
    }
  };

  const handleBack = () => {
    if (dirty && !confirm(t("config.discardConfirm"))) return;
    setEditingSection(null);
    setDirty(false);
  };

  if (!config) return <div>{t("common.loading")}</div>;

  const SECTION_META: Record<string, { icon: string; desc: string }> = {
    meta: { icon: "ℹ️", desc: t("config.section.meta") },
    wizard: { icon: "🧙", desc: t("config.section.wizard") },
    browser: { icon: "🌐", desc: t("config.section.browser") },
    auth: { icon: "🔐", desc: t("config.section.auth") },
    models: { icon: "🤖", desc: t("config.section.models") },
    agents: { icon: "🦞", desc: t("config.section.agents") },
    messages: { icon: "💬", desc: t("config.section.messages") },
    commands: { icon: "⌨️", desc: t("config.section.commands") },
    channels: { icon: "📡", desc: t("config.section.channels") },
    gateway: { icon: "🚪", desc: t("config.section.gateway") },
    skills: { icon: "⚡", desc: t("config.section.skills") },
    plugins: { icon: "🔌", desc: t("config.section.plugins") },
  };

  // Section detail editing view
  if (editingSection) {
    return (
      <div>
        <div className="page-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleBack}>
              ← {t("config.back")}
            </button>
            <h2>
              {SECTION_META[editingSection]?.icon || "📄"} {editingSection}
            </h2>
          </div>
          <p style={{ marginTop: 4 }}>
            {SECTION_META[editingSection]?.desc || ""}
          </p>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>{editingSection}</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {dirty && (
                <span style={{ fontSize: 12, color: "var(--warning)" }}>
                  {t("config.unsaved")}
                </span>
              )}
              <button className="btn btn-primary" onClick={handleSave}>
                {t("config.save")}
              </button>
            </div>
          </div>
          <textarea
            className="editor-textarea"
            style={{ minHeight: 400 }}
            value={editContent}
            onChange={(e) => {
              setEditContent(e.target.value);
              setDirty(true);
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                handleSave();
              }
            }}
          />
        </div>

        {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      </div>
    );
  }

  // Overview: section cards
  return (
    <div>
      <div className="page-header">
        <h2>{t("config.title")}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <p>{t("config.desc")}</p>
          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
            <input
              type="checkbox"
              checked={showSensitive}
              onChange={(e) => setShowSensitive(e.target.checked)}
            />
            {t("config.showSensitive")}
          </label>
        </div>
      </div>

      <div className="config-grid">
        {Object.keys(config).map((key) => {
          const meta = SECTION_META[key] || { icon: "📄", desc: "" };
          const value = config[key];
          const preview = getPreview(value, showSensitive);
          return (
            <div
              key={key}
              className="config-card"
              onClick={() => handleEditSection(key)}
            >
              <div className="config-card-header">
                <span className="config-card-icon">{meta.icon}</span>
                <div>
                  <h4>{key}</h4>
                  <p className="config-card-desc">{meta.desc}</p>
                </div>
              </div>
              <div className="config-card-preview">
                <code>{preview}</code>
              </div>
            </div>
          );
        })}
      </div>

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}

/** Generate a short preview of a config section */
function getPreview(value: any, showSensitive: boolean): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  const masked = showSensitive ? value : maskSensitive(value);
  const json = JSON.stringify(masked, null, 2);
  // Truncate to ~3 lines
  const lines = json.split("\n");
  if (lines.length <= 4) return json;
  return lines.slice(0, 4).join("\n") + "\n  ...";
}

function maskSensitive(obj: any): any {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(maskSensitive);

  const result: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase()) && typeof v === "string" && v.length > 4) {
      result[k] = v.slice(0, 4) + "****";
    } else if (typeof v === "object") {
      result[k] = maskSensitive(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}
