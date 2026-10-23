import React, { useState } from "react";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { skillUnlocked } from "../../game/skills.js";
import { SkillIcon } from "../SkillIcon.jsx";
import { useDraggablePanel } from "./useDraggablePanel.js";
import "../../styles/skills-modal.css";

/**
 * Skills Panel modal inspired by JX2 / VLTK2 skill trees ("Võ Công").
 */
export function SkillsModal({
  isOpen,
  onClose,
  skills = [],
  sect = "thieu-lam",
  level = 1,
  skillLoadout = { u: 0, i: 1, o: 2, p: 3, left: 0, right: 1 },
  onEquipSkill
}) {
  const { t } = useI18n();
  const [showHint, setShowHint] = useState(false);
  const { panelRef, dragging, panelStyle, dragHandlers } = useDraggablePanel(isOpen);

  if (!isOpen) return null;

  const sectNameKey = `characterSelect.sect${
    sect === "thieu-lam"
      ? "ThieuLam"
      : sect === "vo-dang"
      ? "VoDang"
      : sect === "nga-my"
      ? "NgaMy"
      : sect === "ngu-doc"
      ? "NguDoc"
      : "ThieuLam"
  }`;

  const getBoundSlots = (slot) => {
    const bound = [];
    if (skillLoadout.u === slot) bound.push("U");
    if (skillLoadout.i === slot) bound.push("I");
    if (skillLoadout.o === slot) bound.push("O");
    if (skillLoadout.p === slot) bound.push("P");
    if (skillLoadout.left === slot) bound.push(t("skills.handLeft"));
    if (skillLoadout.right === slot) bound.push(t("skills.handRight"));
    return bound;
  };

  return (
    <div className="skills-modal-overlay" id="skills-modal">
      <div
        className={`skills-panel metal-card${dragging ? " is-dragging" : ""}`}
        ref={panelRef}
        style={panelStyle}
        role="dialog"
        aria-modal="false"
        aria-label={t("skills.modalTitle")}
      >
        {/* Title Bar */}
        <div className="skills-titlebar" {...dragHandlers}>
          <span className="skills-title">{t("skills.modalTitle")}</span>
          <div className="skills-titlebar-actions">
            <button
              type="button"
              className="skills-icon-btn"
              title={t("character.helpTitle")}
              onClick={() => setShowHint((v) => !v)}
            >
              ?
            </button>
            <button
              type="button"
              className="skills-icon-btn close"
              title={t("character.closeTitle")}
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>

        {/* Sect Info Header */}
        <div className="skills-header-info">
          <span className="skills-sect-badge">{t(sectNameKey)}</span>
          <span className="skills-level-badge">{t("common.level")} {level}</span>
        </div>

        {showHint && <div className="skills-hint">{t("skills.modalHint")}</div>}

        {/* Skill List */}
        <div className="skills-list">
          {skills.map((skill) => {
            const unlocked = skillUnlocked(skill, level);
            const boundSlots = getBoundSlots(skill.slot);

            return (
              <div
                key={skill.id}
                className={`skill-card-row ${unlocked ? "unlocked" : "locked"}`}
              >
                <div className="skill-card-main">
                  <div className="skill-card-icon-wrap">
                    <SkillIcon skill={skill} className="skill-card-icon" />
                    {boundSlots.length > 0 && (
                      <span className="skill-bound-badge">{boundSlots.join(", ")}</span>
                    )}
                  </div>

                  <div className="skill-card-details">
                    <div className="skill-card-header">
                      <span className="skill-card-name">
                        {t(skill.nameKey, undefined, skill.id)}
                      </span>
                      <span className="skill-card-meta">
                        {unlocked
                          ? `${skill.mp} MP`
                          : t("skills.picker.locked", { level: skill.unlockLevel })}
                      </span>
                    </div>

                    <div className="skill-card-stats">
                      {skill.cooldown > 0 && (
                        <span className="skill-stat-tag">
                          CD: {t("skills.cooldownSec", { sec: (skill.cooldown / 1000).toFixed(1) })}
                        </span>
                      )}
                      {skill.range > 0 && (
                        <span className="skill-stat-tag">Range: {skill.range}</span>
                      )}
                      {skill.mult > 0 && (
                        <span className="skill-stat-tag">Dmg: {Math.round(skill.mult * 100)}%</span>
                      )}
                    </div>

                    <p className="skill-card-desc">
                      {t(skill.descKey, undefined, "")}
                    </p>
                  </div>
                </div>

                {/* Quick Bind Buttons */}
                {unlocked && (
                  <div className="skill-card-actions">
                    <span className="skill-bind-label">{t("skills.picker.eyebrow")}:</span>
                    {["u", "i", "o", "p"].map((key) => {
                      const isAssigned = skillLoadout[key] === skill.slot;
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`skill-action-btn key-btn ${isAssigned ? "active" : ""}`}
                          title={t("skills.bindToKey", { key: key.toUpperCase() })}
                          onClick={() => onEquipSkill?.(key, skill.slot)}
                        >
                          {key.toUpperCase()}
                        </button>
                      );
                    })}
                    {skill.target !== "self" && (
                      <button
                        type="button"
                        className={`skill-action-btn mouse-btn ${
                          skillLoadout.left === skill.slot ? "active" : ""
                        }`}
                        title={t("skills.bindLeft")}
                        onClick={() => onEquipSkill?.("left", skill.slot)}
                      >
                        L
                      </button>
                    )}
                    <button
                      type="button"
                      className={`skill-action-btn mouse-btn ${
                        skillLoadout.right === skill.slot ? "active" : ""
                      }`}
                      title={t("skills.bindRight")}
                      onClick={() => onEquipSkill?.("right", skill.slot)}
                    >
                      R
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="skills-footer">
          <button
            type="button"
            className="wuxia-btn-primary"
            onClick={onClose}
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
