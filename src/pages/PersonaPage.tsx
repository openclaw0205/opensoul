import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api, Persona } from "../api";

interface Props {
  agent: string;
}

export default function PersonaPage({ agent }: Props) {
  const { t } = useTranslation();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [editContent, setEditContent] = useState("");
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api.readPersona(agent).then((p) => {
      setPersona(p);
      if (p.files.length > 0) {
        setEditContent(p.files[0].content);
        setActiveTab(0);
      }
    });
  }, [agent]);

  const switchTab = (idx: number) => {
    if (persona) {
      setActiveTab(idx);
      setEditContent(persona.files[idx].content);
      setDirty(false);
    }
  };

  const save = async () => {
    if (!persona) return;
    const file = persona.files[activeTab];
    await api.savePersonaFile(agent, file.name, editContent);
    const updated = { ...persona };
    updated.files[activeTab] = { ...file, content: editContent };
    setPersona(updated);
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!persona) return <div>{t("common.loading")}</div>;

  return (
    <div>
      <div className="page-header">
        <h2>{t("persona.title")}</h2>
        <p>{t("persona.desc")}</p>
      </div>

      <div className="tabs">
        {persona.files.map((f, i) => (
          <button
            key={f.name}
            className={`tab ${i === activeTab ? "active" : ""}`}
            onClick={() => switchTab(i)}
          >
            {f.name.replace(".md", "")}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>{persona.files[activeTab].name}</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {dirty && (
              <span style={{ fontSize: 12, color: "var(--warning)" }}>
                {t("persona.unsaved")}
              </span>
            )}
            <button className="btn btn-primary" onClick={save}>
              {t("persona.save")}
            </button>
          </div>
        </div>
        <textarea
          className="editor-textarea"
          value={editContent}
          onChange={(e) => {
            setEditContent(e.target.value);
            setDirty(true);
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
              e.preventDefault();
              save();
            }
          }}
        />
      </div>

      {saved && <div className="toast toast-success">{t("persona.saved")}</div>}
    </div>
  );
}
