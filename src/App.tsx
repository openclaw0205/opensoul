import { useState, useEffect } from "react";
import { api, AgentInfo } from "./api";
import PersonaPage from "./pages/PersonaPage";
import SkillsPage from "./pages/SkillsPage";
import MemoryPage from "./pages/MemoryPage";
import BackupPage from "./pages/BackupPage";
import "./styles/global.css";

type Page = "persona" | "skills" | "memory" | "backup";

const NAV_ITEMS: { id: Page; icon: string; label: string }[] = [
  { id: "persona", icon: "🧠", label: "Persona" },
  { id: "skills", icon: "⚡", label: "Skills" },
  { id: "memory", icon: "📚", label: "Memory" },
  { id: "backup", icon: "💾", label: "Backup" },
];

function App() {
  const [page, setPage] = useState<Page>("persona");
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [activeAgent, setActiveAgent] = useState("main");

  useEffect(() => {
    api.listAgents().then((a) => {
      setAgents(a);
      if (a.length > 0 && !a.find((ag) => ag.id === activeAgent)) {
        setActiveAgent(a[0].id);
      }
    });
  }, []);

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>
            🦞 OpenSoul
          </h1>
          <span>Persona Manager</span>
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
                Agent: {a.id}
              </option>
            ))}
          </select>
        </div>
      </aside>

      <main className="main-content">
        {page === "persona" && <PersonaPage agent={activeAgent} />}
        {page === "skills" && <SkillsPage agent={activeAgent} />}
        {page === "memory" && <MemoryPage agent={activeAgent} />}
        {page === "backup" && <BackupPage agent={activeAgent} />}
      </main>
    </div>
  );
}

export default App;
