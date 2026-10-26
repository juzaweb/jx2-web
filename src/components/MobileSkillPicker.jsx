import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { skillUnlocked } from "../game/skills.js";
import { skillLockLabel } from "../game/skillLockLabel.js";
import { SkillIcon } from "./SkillIcon.jsx";

/**
 * Mobile-only picker: choose which sect skill a touch-arc button casts.
 *
 * The arc starts empty ("+"), so tapping an empty button opens this list. A
 * locked art stays visible but disabled, with the level/prerequisite hint.
 */
export function MobileSkillPicker({
  isOpen,
  slotIndex = 0,
  skills = [],
  level = 1,
  selectedSkillId = null,
  onSelect,
  onClear,
  onClose
}) {
  const { t } = useI18n();
  if (!isOpen) return null;

  // A passive art is always running, so it can never be assigned to a button.
  const options = skills.filter((skill) => skill && !skill.passive);

  return (
    <div id="mobile-skill-picker" className="overlay">
      <div className="wuxia-modal metal-card mobile-skill-picker-box">
        <button type="button" className="modal-close-x" onClick={onClose}>
          ×
        </button>
        <div className="modal-eyebrow">{t("skills.mobilePicker.eyebrow")}</div>
        <h2>{t("skills.mobilePicker.title", { index: slotIndex + 1 })}</h2>

        <div className="mobile-skill-list">
          {options.length === 0 ? (
            <p className="mobile-skill-empty">{t("skills.tree.empty")}</p>
          ) : (
            options.map((skill) => {
              const unlocked = skillUnlocked(skill, level);
              return (
                <button
                  key={skill.id}
                  type="button"
                  className={`mobile-skill-row${skill.id === selectedSkillId ? " selected" : ""}${
                    unlocked ? "" : " locked"
                  }`}
                  disabled={!unlocked}
                  onClick={() => onSelect?.(skill.id)}
                >
                  <SkillIcon skill={skill} className="mobile-skill-glyph" />
                  <span className="mobile-skill-name">{t(skill.nameKey, undefined, skill.id)}</span>
                  <span className="mobile-skill-meta">
                    {unlocked ? `${skill.mp} MP` : skillLockLabel(skill, level, t)}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {selectedSkillId && (
          <button type="button" className="mobile-skill-clear" onClick={onClear}>
            {t("skills.mobilePicker.clear")}
          </button>
        )}

        <button type="button" className="wuxia-btn-primary" onClick={onClose}>
          {t("common.back")}
        </button>
      </div>
    </div>
  );
}
