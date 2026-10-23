import React, { useMemo, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { skillLockReason, skillUnlocked } from "../../game/skills.js";
import { formatSkillLock } from "../../game/skillLockLabel.js";
import { buildSkillTree, initialSelectedId } from "../../game/skillTree.js";
import { SkillIcon } from "../SkillIcon.jsx";
import { useDraggablePanel } from "./useDraggablePanel.js";
import "../../styles/skills-modal.css";

const KEY_BINDINGS = ["u", "i", "o", "p"];

const SECT_NAME_KEYS = {
  "thieu-lam": "characterSelect.sectThieuLam",
  "vo-dang": "characterSelect.sectVoDang",
  "nga-my": "characterSelect.sectNgaMy",
  "ngu-doc": "characterSelect.sectNguDoc"
};

const ARROW_MARKER_ID = "skill-tree-arrow";

/**
 * Skills Panel modal inspired by JX2 / VLTK2 skill trees ("Bảng Võ Học").
 *
 * The left side renders the sect's skills as a tree of gold tiles joined by
 * arrows (layout derived from each skill's `requires`); the right side shows the
 * selected skill's details and its quick-bind buttons.
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
  const [pickedId, setPickedId] = useState(null);
  const { panelRef, dragging, panelStyle, dragHandlers } = useDraggablePanel(isOpen);

  const tree = useMemo(() => buildSkillTree(skills), [skills]);
  const defaultId = useMemo(() => initialSelectedId(skills, level), [skills, level]);
  const selectedId = skills.some((skill) => skill?.id === pickedId) ? pickedId : defaultId;
  const selectedSkill = skills.find((skill) => skill?.id === selectedId) || null;

  if (!isOpen) return null;

  const sectNameKey = SECT_NAME_KEYS[sect] || SECT_NAME_KEYS["thieu-lam"];

  const getBoundSlots = (slot) => {
    const bound = [];
    if (skillLoadout.u === slot) bound.push("U");
    if (skillLoadout.i === slot) bound.push("I");
    if (skillLoadout.o === slot) bound.push("O");
    if (skillLoadout.p === slot) bound.push("P");
    if (skillLoadout.left === slot) bound.push("L");
    if (skillLoadout.right === slot) bound.push("R");
    return bound;
  };

  const selectedUnlocked = selectedSkill ? skillUnlocked(selectedSkill, level) : false;
  const selectedLockReason = selectedUnlocked ? null : skillLockReason(selectedSkill, level);
  const selectedLockLabel = formatSkillLock(selectedLockReason, t);

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

        <div className="skills-body">
          {/* Skill tree */}
          <div className="skills-tree-scroll">
            {tree.nodes.length === 0 ? (
              <p className="skills-empty">{t("skills.tree.empty")}</p>
            ) : (
              <div
                className="skills-tree"
                style={{ width: tree.width, height: tree.height }}
                role="group"
                aria-label={t("skills.modalTitle")}
              >
                {tree.edges.length > 0 && (
                  <svg
                    className="skills-tree-links"
                    width={tree.width}
                    height={tree.height}
                    viewBox={`0 0 ${tree.width} ${tree.height}`}
                    aria-hidden="true"
                    focusable="false"
                  >
                    <defs>
                      <marker
                        id={ARROW_MARKER_ID}
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="5"
                        markerHeight="5"
                        orient="auto"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" />
                      </marker>
                    </defs>
                    {tree.edges.map((edge) => (
                      <path
                        key={`${edge.from}->${edge.to}`}
                        className="skill-tree-link"
                        d={edge.path}
                        markerEnd={`url(#${ARROW_MARKER_ID})`}
                      />
                    ))}
                  </svg>
                )}

                {tree.nodes.map(({ skill, x, y }) => {
                  const unlocked = skillUnlocked(skill, level);
                  const lockReason = unlocked ? null : skillLockReason(skill, level);
                  const isSelected = skill.id === selectedId;
                  const boundSlots = getBoundSlots(skill.slot);
                  const name = t(skill.nameKey, undefined, skill.id);
                  const lockLabel = formatSkillLock(lockReason, t);

                  return (
                    <button
                      key={skill.id}
                      type="button"
                      className={`skill-node ${unlocked ? "unlocked" : "locked"}${
                        isSelected ? " selected" : ""
                      }`}
                      style={{ left: x, top: y, width: tree.tile, height: tree.tile }}
                      data-skill-id={skill.id}
                      aria-pressed={isSelected}
                      aria-label={lockLabel ? `${name} — ${lockLabel}` : name}
                      title={lockLabel ? `${name} — ${lockLabel}` : name}
                      onClick={() => setPickedId(skill.id)}
                    >
                      <span className="skill-node-face">
                        <SkillIcon skill={skill} className="skill-node-icon" />
                        {boundSlots.length > 0 && (
                          <span className="skill-node-keys">{boundSlots.join("")}</span>
                        )}
                        {!unlocked && (
                          <span className="skill-node-lock" aria-hidden="true">
                            🔒
                          </span>
                        )}
                      </span>
                      {!unlocked && (
                        <span className="skill-node-level" aria-hidden="true">
                          {lockReason?.level ?? skill.unlockLevel}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected skill details */}
          {selectedSkill ? (
            <div className="skills-detail">
              <div className="skills-detail-head">
                <span className="skills-detail-icon-wrap">
                  <SkillIcon skill={selectedSkill} className="skills-detail-icon" />
                </span>
                <div className="skills-detail-heading">
                  <span className="skills-detail-name">
                    {t(selectedSkill.nameKey, undefined, selectedSkill.id)}
                  </span>
                  <span
                    className={`skills-detail-meta ${selectedUnlocked ? "unlocked" : "locked"}`}
                  >
                    {selectedUnlocked
                      ? `${selectedSkill.mp} MP`
                      : selectedLockLabel || t("skills.tree.selectHint")}
                  </span>
                </div>
              </div>

              <p className="skills-detail-desc">{t(selectedSkill.descKey, undefined, "")}</p>

              <div className="skills-detail-stats">
                <span className="skills-stat-chip">
                  {t("common.level")} {selectedSkill.unlockLevel}
                </span>
                {selectedSkill.cooldown > 0 && (
                  <span className="skills-stat-chip">
                    CD:{" "}
                    {t("skills.cooldownSec", {
                      sec: (selectedSkill.cooldown / 1000).toFixed(1)
                    })}
                  </span>
                )}
                {selectedSkill.range > 0 && (
                  <span className="skills-stat-chip">
                    {t("skills.rangeTag", { range: selectedSkill.range })}
                  </span>
                )}
                {selectedSkill.mult > 0 && (
                  <span className="skills-stat-chip">
                    {t("skills.dmgTag", { pct: Math.round(selectedSkill.mult * 100) })}
                  </span>
                )}
              </div>

              {selectedUnlocked && (
                <div className="skills-detail-bind">
                  <div className="skills-detail-bind-label">{t("skills.picker.eyebrow")}</div>
                  <div className="skills-bind-grid">
                    {KEY_BINDINGS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        className={`skill-action-btn key-btn ${
                          skillLoadout[key] === selectedSkill.slot ? "active" : ""
                        }`}
                        title={t("skills.bindToKey", { key: key.toUpperCase() })}
                        onClick={() => onEquipSkill?.(key, selectedSkill.slot)}
                      >
                        {key.toUpperCase()}
                      </button>
                    ))}
                    {selectedSkill.target !== "self" && (
                      <button
                        type="button"
                        className={`skill-action-btn mouse-btn ${
                          skillLoadout.left === selectedSkill.slot ? "active" : ""
                        }`}
                        title={t("skills.bindLeft")}
                        onClick={() => onEquipSkill?.("left", selectedSkill.slot)}
                      >
                        L
                      </button>
                    )}
                    <button
                      type="button"
                      className={`skill-action-btn mouse-btn ${
                        skillLoadout.right === selectedSkill.slot ? "active" : ""
                      }`}
                      title={t("skills.bindRight")}
                      onClick={() => onEquipSkill?.("right", selectedSkill.slot)}
                    >
                      R
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="skills-detail skills-detail-empty">
              <p className="skills-empty">{t("skills.tree.selectHint")}</p>
            </div>
          )}
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
