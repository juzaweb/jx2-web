import React, { useEffect, useState } from "react";
import { resolveSkillIcon } from "../game/skills.js";

/**
 * Renders a skill's icon image, falling back to its glyph when the catalog has
 * no icon asset or the image fails to load (e.g. a missing file or a section of
 * the kit that is not authored yet).
 */
export function SkillIcon({ skill, className = "", fallback = "?" }) {
  const icon = resolveSkillIcon(skill) || "";
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [icon]);

  if (icon && !failed) {
    return (
      <img
        className={[className, "skill-icon-img"].filter(Boolean).join(" ")}
        src={icon}
        alt=""
        draggable={false}
        onError={() => setFailed(true)}
      />
    );
  }
  return <span className={className}>{skill?.glyph || fallback}</span>;
}
