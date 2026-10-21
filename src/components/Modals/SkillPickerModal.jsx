import React from "react";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { skillUnlocked } from "../../game/skills.js";
import { SkillIcon } from "../SkillIcon.jsx";

/**
 * Pick which sect skill is bound to the left or right mouse button.
 */
export function SkillPickerModal({ isOpen, hand, skills = [], level = 1, selectedSlot = -1, onSelect, onClose }) {
  const { t } = useI18n();
  if (!isOpen) return null;

  const isKeySlot = ["u", "i", "o", "p"].includes(hand?.toLowerCase());
  const handLabel = isKeySlot
    ? `${t("skills.keySlotLabel", undefined, "Phím")} ${hand.toUpperCase()}`
    : hand === "left"
    ? t("skills.handLeft")
    : t("skills.handRight");

  return (
    <div id="skill-picker-modal" className="overlay">
      <div className="wuxia-modal metal-card skill-picker-box">
        <button className="modal-close-x" onClick={onClose}>
          ×
        </button>
        <div className="modal-eyebrow">{t("skills.picker.eyebrow")}</div>
        <h2>{t("skills.picker.title", { hand: handLabel })}</h2>

        <div className="skill-picker-list">
          {skills.map((skill) => {
            const unlocked = skillUnlocked(skill, level);
            return (
              <button
                key={skill.id}
                type="button"
                className={`skill-picker-row ${skill.slot === selectedSlot ? "selected" : ""} ${
                  unlocked ? "" : "locked"
                }`}
                disabled={!unlocked}
                onClick={() => onSelect(hand, skill.slot)}
              >
                <SkillIcon skill={skill} className="skill-picker-glyph" />
                <span className="skill-picker-name">{t(skill.nameKey, undefined, skill.id)}</span>
                <span className="skill-picker-meta">
                  {unlocked
                    ? `${skill.mp} MP`
                    : t("skills.picker.locked", { level: skill.unlockLevel })}
                </span>
              </button>
            );
          })}
        </div>

        <button type="button" className="wuxia-btn-primary" onClick={onClose}>
          {t("common.back")}
        </button>
      </div>
    </div>
  );
}
