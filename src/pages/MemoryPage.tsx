import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api, MemoryEntry } from "../api";

interface Props {
  agent: string;
}

export default function MemoryPage({ agent }: Props) {
  const { t } = useTranslation();
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [longTermMemory, setLongTermMemory] = useState("");
  const [selected, setSelected] = useState<MemoryEntry | null>(null);
  const [tab, setTab] = useState<"daily" | "longterm">("daily");

  useEffect(() => {
    api.listMemories(agent).then(setMemories);
    api.readLongTermMemory(agent).then(setLongTermMemory);
  }, [agent]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="page-header">
        <h2>{t("memory.title")}</h2>
        <p>{t("memory.desc")}</p>
      </div>

      <div className="tabs">
        <button
          className={`tab ${tab === "daily" ? "active" : ""}`}
          onClick={() => setTab("daily")}
        >
          {t("memory.daily")} ({memories.length})
        </button>
        <button
          className={`tab ${tab === "longterm" ? "active" : ""}`}
          onClick={() => setTab("longterm")}
        >
          {t("memory.longterm")}
        </button>
      </div>

      {tab === "daily" ? (
        <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
          <div style={{ width: 250, flexShrink: 0, overflowY: "auto" }}>
            <div className="memory-timeline">
              {memories.map((m) => (
                <div
                  key={m.filename}
                  className="memory-item"
                  onClick={() => setSelected(m)}
                  style={{
                    borderColor:
                      selected?.filename === m.filename
                        ? "var(--accent)"
                        : undefined,
                  }}
                >
                  <div className="date">{m.date}</div>
                  <div className="preview">{m.content.slice(0, 80)}...</div>
                </div>
              ))}
              {memories.length === 0 && (
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  {t("memory.noDaily")}
                </p>
              )}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {selected ? (
              <div className="card">
                <div className="card-header">
                  <h3>{selected.filename}</h3>
                </div>
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: "var(--text-secondary)",
                  }}
                >
                  {selected.content}
                </pre>
              </div>
            ) : (
              <div className="card">
                <p style={{ color: "var(--text-muted)" }}>
                  {t("memory.selectDate")}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--text-secondary)",
            }}
          >
            {longTermMemory || t("memory.noLongterm")}
          </pre>
        </div>
      )}
    </div>
  );
}
