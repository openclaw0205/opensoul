import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";

interface Props {
  agent: string;
}

type ConfigTab = "models" | "channels";

const SENSITIVE_KEYS = new Set(["apikey", "api_key", "token", "secret", "password", "bottoken"]);

export default function ConfigPage({ agent: _agent }: Props) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<Record<string, any> | null>(null);
  const [tab, setTab] = useState<ConfigTab>("models");
  const [showSensitive, setShowSensitive] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [modelsData, setModelsData] = useState<Record<string, any>>({});
  const [channelsData, setChannelsData] = useState<Record<string, any>>({});

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    api.readConfig().then((raw) => {
      try {
        const parsed = JSON.parse(raw);
        setConfig(parsed);
        setModelsData(structuredClone(parsed.models ?? {}));
        setChannelsData(structuredClone(parsed.channels ?? {}));
      } catch {
        setConfig({});
        setModelsData({});
        setChannelsData({});
      }
    });
  }, []);

  const currentData = useMemo(() => (tab === "models" ? modelsData : channelsData), [tab, modelsData, channelsData]);

  const handleSave = async () => {
    if (!config) return;
    try {
      const next = {
        ...config,
        models: modelsData,
        channels: channelsData,
      };
      await api.saveConfig(JSON.stringify(next, null, 2));
      setConfig(next);
      setDirty(false);
      showToast(t("config.saved"));
    } catch (e: any) {
      showToast(e?.toString() || "Error", "error");
    }
  };

  if (!config) return <div>{t("common.loading")}</div>;

  return (
    <div className="page-shell">
      <div className="page-fixed">
        <div className="page-header">
          <h2>{t("config.titleSimple")}</h2>
          <p>{t("config.descSimple")}</p>
        </div>
        <div className="tabs">
          {(["models", "channels"] as ConfigTab[]).map((item) => (
            <button
              key={item}
              className={`tab ${tab === item ? "active" : ""}`}
              onClick={() => setTab(item)}
            >
              {t(`config.simpleTab.${item}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="page-scroll">
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h3>{t(tab === "models" ? "config.modelsTitle" : "config.channelsTitle")}</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label className="config-sensitive-toggle">
                <input
                  type="checkbox"
                  checked={showSensitive}
                  onChange={(e) => setShowSensitive(e.target.checked)}
                />
                {t("config.showSensitive")}
              </label>
              {dirty && <span style={{ fontSize: 12, color: "var(--warning)" }}>{t("config.unsaved")}</span>}
              <button className="btn btn-primary" onClick={handleSave}>{t("config.save")}</button>
            </div>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            {t(tab === "models" ? "config.modelsDesc" : "config.channelsDesc")}
          </p>
        </div>

        <div className="card">
          <SimpleConfigFields
            data={currentData}
            showSensitive={showSensitive}
            onChange={(newData) => {
              if (tab === "models") setModelsData(newData);
              else setChannelsData(newData);
              setDirty(true);
            }}
          />
        </div>
      </div>

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}

function SimpleConfigFields({
  data,
  showSensitive,
  onChange,
}: {
  data: Record<string, any>;
  showSensitive: boolean;
  onChange: (newData: Record<string, any>) => void;
}) {
  const entries = Object.entries(data ?? {});

  if (entries.length === 0) {
    return <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No settings found.</p>;
  }

  return (
    <div className="config-object">
      {entries.map(([key, value]) => {
        const isNested = typeof value === "object" && value !== null;
        return (
          <div key={key} className={isNested ? "config-field-nested" : "config-field"}>
            <label className="config-label">{key}</label>
            {isNested ? (
              <NestedObjectEditor
                value={value}
                showSensitive={showSensitive}
                onChange={(nextVal) => onChange({ ...data, [key]: nextVal })}
              />
            ) : (
              <ValueInput
                fieldKey={key}
                value={value}
                showSensitive={showSensitive}
                onChange={(nextVal) => onChange({ ...data, [key]: nextVal })}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function NestedObjectEditor({
  value,
  showSensitive,
  onChange,
}: {
  value: Record<string, any>;
  showSensitive: boolean;
  onChange: (nextVal: Record<string, any>) => void;
}) {
  return (
    <div className="config-nested-content">
      <div className="config-object">
        {Object.entries(value).map(([childKey, childValue]) => {
          const nested = typeof childValue === "object" && childValue !== null;
          return (
            <div key={childKey} className={nested ? "config-field-nested" : "config-field"}>
              <label className="config-label">{childKey}</label>
              {nested ? (
                <NestedObjectEditor
                  value={childValue}
                  showSensitive={showSensitive}
                  onChange={(nextChild) => onChange({ ...value, [childKey]: nextChild })}
                />
              ) : (
                <ValueInput
                  fieldKey={childKey}
                  value={childValue}
                  showSensitive={showSensitive}
                  onChange={(nextChild) => onChange({ ...value, [childKey]: nextChild })}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ValueInput({
  fieldKey,
  value,
  showSensitive,
  onChange,
}: {
  fieldKey: string;
  value: any;
  showSensitive: boolean;
  onChange: (nextVal: any) => void;
}) {
  const isSensitive = SENSITIVE_KEYS.has(fieldKey.toLowerCase());

  if (typeof value === "boolean") {
    return (
      <div className="config-toggle-wrapper">
        <button
          className={`config-toggle ${value ? "config-toggle-on" : ""}`}
          onClick={() => onChange(!value)}
        >
          {value ? "true" : "false"}
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

  if (Array.isArray(value)) {
    return (
      <textarea
        className="editor-textarea"
        style={{ minHeight: 84 }}
        value={JSON.stringify(value, null, 2)}
        onChange={(e) => {
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            onChange(e.target.value);
          }
        }}
      />
    );
  }

  const strVal = String(value ?? "");
  const masked = isSensitive && !showSensitive && strVal.length > 0;

  return (
    <input
      className="form-input"
      type={masked ? "password" : "text"}
      value={strVal}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
