import { useState, useEffect } from "react";
import { api, SkillInfo } from "../api";

interface Props {
  agent: string;
}

export default function SkillsPage({ agent }: Props) {
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
    if (!confirm(`Delete skill "${name}"?`)) return;
    await api.deleteSkill(agent, name);
    setSkills(skills.filter((s) => s.name !== name));
  };

  return (
    <div>
      <div className="page-header">
        <h2>⚡ Skills</h2>
        <p>
          Manage installed skills · {skills.length} skill
          {skills.length !== 1 ? "s" : ""} installed
        </p>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : skills.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--text-secondary)" }}>
            No skills installed. Install skills via{" "}
            <code>openclaw skill install</code>
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
                  Uninstall
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
