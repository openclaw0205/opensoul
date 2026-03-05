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

  useEffect(() => {
    setLoading(true);
    api.listSkills(agent).then((s) => {
      setSkills(s);
      setLoading(false);
    });
  }, [agent]);

  const handleDelete = async (name: string) => {
    if (!confirm(t("skills.confirmDelete", { name }))) return;
    await api.deleteSkill(agent, name);
    setSkills(skills.filter((s) => s.name !== name));
  };

  return (
    <div>
      <div className="page-header">
        <h2>{t("skills.title")}</h2>
        <p>{t("skills.desc", { count: skills.length })}</p>
      </div>

      {loading ? (
        <div>{t("common.loading")}</div>
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
    </div>
  );
}
