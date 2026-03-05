import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api, SkillInfo } from "../api";

interface Props {
  agent: string;
}

export default function SkillsPage({ agent }: Props) {
  const { t } = useTranslation();
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .listSkills(agent)
      .then((s) => {
        setSkills(s);
        setLoading(false);
      })
      .catch((e) => {
        setError(e?.toString() || "Failed to load skills");
        setLoading(false);
      });
  }, [agent]);

  const handleDelete = async (name: string) => {
    if (!confirm(t("skills.confirmDelete", { name }))) return;
    try {
      await api.deleteSkill(agent, name);
      setSkills(skills.filter((s) => s.name !== name));
      showToast(t("skills.deleted", { name }));
    } catch (e: any) {
      showToast(e?.toString() || "Failed to delete", "error");
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>{t("skills.title")}</h2>
        <p>{t("skills.desc", { count: skills.length })}</p>
      </div>

      {loading ? (
        <div>{t("common.loading")}</div>
      ) : error ? (
        <div className="card">
          <p style={{ color: "var(--danger)" }}>{error}</p>
        </div>
      ) : skills.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--text-secondary)" }}>
            {t("skills.empty")} <code>{t("skills.emptyCmd")}</code>
          </p>
        </div>
      ) : (
        <div className="skills-grid">
          {skills.map((skill) => (
            <div key={skill.name} className="skill-card">
              <h4>{skill.name}</h4>
              <p>{skill.description}</p>
              <div className="skill-actions">
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(skill.name)}
                >
                  {t("skills.uninstall")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
