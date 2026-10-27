import React, { useMemo, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { skillLockReason } from "../../game/skills.js";
import { normalizeWeaponType, WEAPON_LABEL_KEYS } from "../../game/weapons.js";
import { formatSkillLock } from "../../game/skillLockLabel.js";
import { buildSkillTree, initialSelectedId } from "../../game/skillTree.js";
import { regenPerSecond } from "../../game/passiveRegen.js";
import { SkillIcon } from "../SkillIcon.jsx";
import { useDraggablePanel } from "./useDraggablePanel.js";
import { beginItemDrag, didItemDragJustEnd } from "./pointerItemDrag.js";
import { skillBinding } from "../../game/quickSlots.js";
import "../../styles/skills-modal.css";

const ARROW_MARKER_ID = "skill-tree-arrow";

/**
 * Skills Panel modal inspired by JX2 / VLTK2 skill trees ("Bảng Võ Học").
 *
 * The left side renders the equipped weapon's skills as a tree of gold tiles
 * joined by arrows (layout derived from each skill's `requires`); the right side
 * shows the selected skill's details and its quick-bind buttons. Skills not yet
 * studied from a book stay locked.
 */
export function SkillsModal({
  isOpen,
  onClose,
  skills = [],
  weapon = "kiem",
  learnedSkills = [],
  level = 1,
  quickSlotsMapping = {},
  onAssignSkill
}) {
  const { t } = useI18n();
  const [showHint, setShowHint] = useState(false);
  const [pickedId, setPickedId] = useState(null);
  const { panelRef, dragging, panelStyle, dragHandlers } = useDraggablePanel(isOpen);

  const tree = useMemo(() => buildSkillTree(skills), [skills]);
  const defaultId = useMemo(
    () => initialSelectedId(skills, level, learnedSkills),
    [skills, level, learnedSkills]
  );
  const selectedId = skills.some((skill) => skill?.id === pickedId) ? pickedId : defaultId;
  const selectedSkill = skills.find((skill) => skill?.id === selectedId) || null;

  if (!isOpen) return null;

  const weaponLabelKey = WEAPON_LABEL_KEYS[normalizeWeaponType(weapon)];

  const getBoundSlots = (skillId) => {
    const bound = [];
    for (let slot = 1; slot <= 9; slot++) {
      if (quickSlotsMapping?.[slot] === skillBinding(skillId)) bound.push(slot);
    }
    return bound;
  };

  const selectedLockReason = selectedSkill
    ? skillLockReason(selectedSkill, level, learnedSkills)
    : null;
  const selectedUnlocked = selectedSkill ? selectedLockReason === null : false;
  const selectedLockLabel = formatSkillLock(selectedLockReason, t);
  /** HP/s an always-on art restores; 0 for every cast skill. */
  const selectedRegen = selectedSkill ? regenPerSecond(selectedSkill) : 0;

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

        {/* Weapon Info Header */}
        <div className="skills-header-info">
          <span className="skills-weapon-badge">{t(weaponLabelKey)}</span>
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
                  const lockReason = skillLockReason(skill, level, learnedSkills);
                  const unlocked = lockReason === null;
                  const isSelected = skill.id === selectedId;
                  const boundSlots = getBoundSlots(skill.id);
                  const name = t(skill.nameKey, undefined, skill.id);
                  const lockLabel = formatSkillLock(lockReason, t);
                  const isDraggable = unlocked && !skill.passive;

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
                      onPointerDown={
                        isDraggable
                          ? (event) =>
                              beginItemDrag({
                                event,
                                payload: { kind: "hotbar", skillId: skill.id },
                                ghostImage: skill.icon,
                                onDrop: (zone) => {
                                  if (zone?.type === "hotbar") onAssignSkill?.(zone.slot, skill.id);
                                }
                              })
                          : undefined
                      }
                      onClick={(event) => {
                        // A drop already handled the gesture; don't re-select after it.
                        if (didItemDragJustEnd(event.currentTarget)) return;
                        setPickedId(skill.id);
                      }}
                    >
                      <span className="skill-node-face">
                        <SkillIcon skill={skill} className="skill-node-icon" />
                        {boundSlots.length > 0 && (
                          <span className="skill-node-keys">{boundSlots.join(" ")}</span>
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
                    {!selectedUnlocked
                      ? selectedLockLabel || t("skills.tree.selectHint")
                      : selectedSkill.passive
                        ? t("skills.passiveTag")
                        : `${selectedSkill.mp} MP`}
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
                {selectedRegen > 0 && (
                  <span className="skills-stat-chip">
                    {t("skills.regenTag", { hp: selectedRegen })}
                  </span>
                )}
              </div>

              {/* An always-on passive art has nothing to bind: it runs without
                  being cast, so the drag hint is hidden for it. */}
              {selectedUnlocked && !selectedSkill.passive && (
                <div className="skills-detail-bind">
                  <div className="skills-detail-bind-label">{t("skills.picker.eyebrow")}</div>
                  <p className="skills-drag-hint">{t("skills.dragHint")}</p>
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
