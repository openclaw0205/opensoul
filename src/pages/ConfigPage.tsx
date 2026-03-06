import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";

interface Props {
  agent: string;
}

const SENSITIVE_KEYS = new Set(["apikey", "token", "secret", "password", "bottoken"]);

interface SectionDef {
  key: string;
  icon: string;
}

const SECTIONS: SectionDef[] = [
  { key: "meta", icon: "ℹ️" },
  { key: "wizard", icon: "🧙" },
  { key: "browser", icon: "🌐" },
  { key: "auth", icon: "🔐" },
  { key: "models", icon: "🤖" },
  { key: "agents", icon: "🦞" },
  { key: "messages", icon: "💬" },
  { key: "commands", icon: "⌨️" },
  { key: "channels", icon: "📡" },
  { key: "gateway", icon: "🚪" },
  { key: "skills", icon: "⚡" },
  { key: "plugins", icon: "🔌" },
];

export default function ConfigPage({ agent: _agent }: Props) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<Record<string, any> | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [dirty, setDirty] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    api.readConfig().then((raw) => {
      try {
        const parsed = JSON.parse(raw);
        setConfig(parsed);
        // Auto-select first available section
        const firstKey = SECTIONS.find((s) => parsed[s.key] !== undefined)?.key;
        if (firstKey) {
          setSelectedSection(firstKey);
          setEditData(structuredClone(parsed[firstKey]));
        }
      } catch {
        setConfig({});
      }
    });
  }, []);

  const selectSection = (key: string) => {
    if (dirty && !confirm(t("config.discardConfirm"))) return;
    setSelectedSection(key);
    setEditData(config ? structuredClone(config[key] ?? {}) : {});
    setDirty(false);
  };

  const handleSave = useCallback(async () => {
    if (!config || !selectedSection) return;
    try {
      const newConfig = { ...config, [selectedSection]: editData };
      await api.saveConfig(JSON.stringify(newConfig, null, 2));
      setConfig(newConfig);
      setDirty(false);
      showToast(t("config.saved"));
    } catch (e: any) {
      showToast(e?.toString() || "Error", "error");
    }
  }, [config, selectedSection, editData, t]);

  if (!config) return <div>{t("common.loading")}</div>;

  const availableSections = SECTIONS.filter((s) => config[s.key] !== undefined);

  return (
    <div className="page-shell">
      <div className="page-header page-fixed">
        <h2>{t("config.title")}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <p>{t("config.desc")}</p>
          <label className="config-sensitive-toggle">
            <input
              type="checkbox"
              checked={showSensitive}
              onChange={(e) => setShowSensitive(e.target.checked)}
            />
            {t("config.showSensitive")}
          </label>
        </div>
      </div>
      <div className="page-split">
        {/* Left: section list */}
        <div style={{ width: 220, flexShrink: 0 }} className="page-pane-scroll">
          <div className="memory-timeline">
            {availableSections.map((s) => (
              <div
                key={s.key}
                className="memory-item"
                onClick={() => selectSection(s.key)}
                style={{
                  borderColor: selectedSection === s.key ? "var(--accent)" : undefined,
                }}
              >
                <div className="date">
                  {s.icon} {s.key}
                </div>
                <div className="preview">{t(`config.section.${s.key}`)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: form */}
        <div style={{ flex: 1 }} className="page-pane-scroll">
          {selectedSection && editData !== null ? (
            <div className="card">
              <div className="card-header">
                <h3>
                  {SECTIONS.find((s) => s.key === selectedSection)?.icon}{" "}
                  {selectedSection}
                </h3>
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

              <div className="config-form">
                <FormFields
                  data={editData}
                  path={[]}
                  onChange={(newData) => {
                    setEditData(newData);
                    setDirty(true);
                  }}
                  showSensitive={showSensitive}
                />
              </div>
            </div>
          ) : (
            <div className="card">
              <p style={{ color: "var(--text-muted)" }}>
                {t("config.selectSection")}
              </p>
            </div>
          )}
        </div>
      </div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}

// ============================================================
// Recursive Form Fields
// ============================================================

interface FormFieldsProps {
  data: any;
  path: string[];
  onChange: (newData: any) => void;
  showSensitive: boolean;
}

function FormFields({ data, path, onChange, showSensitive }: FormFieldsProps) {
  if (data === null || data === undefined) {
    return <span className="config-null">null</span>;
  }

  if (Array.isArray(data)) {
    return (
      <div className="config-array">
        {data.map((item, i) => (
          <div key={i} className="config-array-item">
            <div className="config-array-header">
              <span className="config-array-index">[{i}]</span>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  const newArr = [...data];
                  newArr.splice(i, 1);
                  onChange(newArr);
                }}
              >
                ✕
              </button>
            </div>
            <FormFields
              data={item}
              path={[...path, String(i)]}
              onChange={(newItem) => {
                const newArr = [...data];
                newArr[i] = newItem;
                onChange(newArr);
              }}
              showSensitive={showSensitive}
            />
          </div>
        ))}
      </div>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data);
    return (
      <div className="config-object">
        {entries.map(([key, value]) => {
          const fullPath = [...path, key];
          const isSensitive = SENSITIVE_KEYS.has(key.toLowerCase());
          const isNested = typeof value === "object" && value !== null;

          return (
            <div key={key} className={isNested ? "config-field-nested" : "config-field"}>
              <label className="config-label">{key}</label>
              {isNested ? (
                <div className="config-nested-content">
                  <FormFields
                    data={value}
                    path={fullPath}
                    onChange={(newVal) => {
                      onChange({ ...data, [key]: newVal });
                    }}
                    showSensitive={showSensitive}
                  />
                </div>
              ) : (
                <FieldInput
                  value={value}
                  isSensitive={isSensitive}
                  showSensitive={showSensitive}
                  onChange={(newVal) => {
                    onChange({ ...data, [key]: newVal });
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Primitive at top level (unlikely but safe)
  return (
    <FieldInput
      value={data}
      isSensitive={false}
      showSensitive={showSensitive}
      onChange={onChange}
    />
  );
}

// ============================================================
// Single Field Input
// ============================================================

interface FieldInputProps {
  value: any;
  isSensitive: boolean;
  showSensitive: boolean;
  onChange: (newVal: any) => void;
}

function FieldInput({ value, isSensitive, showSensitive, onChange }: FieldInputProps) {
  if (typeof value === "boolean") {
    return (
      <div className="config-toggle-wrapper">
        <button
          className={`config-toggle ${value ? "config-toggle-on" : ""}`}
          onClick={() => onChange(!value)}
        >
          {value ? "✓ true" : "✗ false"}
        </button>
      </div>
    );
  }

  if (typeof value === "number") {
    return (
      <input
        className="form-input"
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    );
  }

  // String
  const strVal = String(value ?? "");
  const masked = isSensitive && !showSensitive && strVal.length > 6;

  return (
    <input
      className="form-input"
      type={masked ? "password" : "text"}
      value={strVal}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
