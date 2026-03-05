import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api, AgentInfo } from "./api";
import PersonaPage from "./pages/PersonaPage";
import SkillsPage from "./pages/SkillsPage";
import MemoryPage from "./pages/MemoryPage";
import BackupPage from "./pages/BackupPage";
import ConfigPage from "./pages/ConfigPage";
import "./styles/global.css";

type Page = "persona" | "skills" | "memory" | "backup" | "config";

function App() {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState<Page>("persona");
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [activeAgent, setActiveAgent] = useState("main");

  const NAV_ITEMS: { id: Page; icon: string; label: string }[] = [
    { id: "persona", icon: "🧠", label: t("nav.persona") },
    { id: "skills", icon: "⚡", label: t("nav.skills") },
    { id: "memory", icon: "📚", label: t("nav.memory") },
    { id: "backup", icon: "💾", label: t("nav.backup") },
    { id: "config", icon: "⚙️", label: t("nav.config") },
  ];

  useEffect(() => {
    api.listAgents().then((a) => {
      setAgents(a);
      if (a.length > 0 && !a.find((ag) => ag.id === activeAgent)) {
        setActiveAgent(a[0].id);
      }
    });
  }, []);

  const switchLang = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("opensoul-lang", lang);
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>🦞 {t("app.title")}</h1>
          <span>{t("app.subtitle")}</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => setPage(item.id)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <select
            className="agent-selector"
            value={activeAgent}
            onChange={(e) => setActiveAgent(e.target.value)}
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {t("agent.label", { id: a.id })}
              </option>
            ))}
          </select>

          <div className="lang-switcher" style={{ marginTop: 8, display: "flex", gap: 4 }}>
            <button
              className={`btn btn-sm ${i18n.language === "en" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => switchLang("en")}
            >
              EN
            </button>
            <button
              className={`btn btn-sm ${i18n.language === "zh" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => switchLang("zh")}
            >
              中文
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {page === "persona" && <PersonaPage agent={activeAgent} />}
        {page === "skills" && <SkillsPage agent={activeAgent} />}
        {page === "memory" && <MemoryPage agent={activeAgent} />}
        {page === "backup" && <BackupPage agent={activeAgent} />}
        {page === "config" && <ConfigPage agent={activeAgent} />}
      </main>
    </div>
  );
}

export default App;
