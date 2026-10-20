import React from "react";

/**
 * Renders a skill's icon image, falling back to its glyph when the catalog has
 * no icon asset (e.g. sects whose kits are not authored yet).
 */
export function SkillIcon({ skill, className = "", fallback = "?" }) {
  if (skill?.icon) {
    return (
      <img
        className={[className, "skill-icon-img"].filter(Boolean).join(" ")}
        src={skill.icon}
        alt=""
        draggable={false}
      />
    );
  }
  return <span className={className}>{skill?.glyph || fallback}</span>;
}
