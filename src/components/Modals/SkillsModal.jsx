import React, { useMemo, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import {
  MAX_SKILL_LEVEL,
  characterLevelForSkillLevel,
  skillAtLevel,
  skillFundsShortfall,
  skillLearnCost,
  skillLevelBonus,
  skillLevelOf,
  skillLockReason,
  skillUpgradeCost
} from "../../game/skills.js";
import { normalizeWeaponType, WEAPON_LABEL_KEYS } from "../../game/weapons.js";
import { SECTS, normalizeSect } from "../../game/sects.js";
import { formatSkillLock } from "../../game/skillLockLabel.js";
import { moneyLabel } from "../../game/moneyLabel.js";
import { buildSkillTree, initialSelectedId } from "../../game/skillTree.js";
import { NORMAL_ATTACK_MULT } from "../../game/combatConfig.js";
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
 * The left side renders the hero's sect kit as a tree of gold tiles joined by
 * arrows (layout derived from each skill's `requires`); the right side shows the
 * selected skill's details, its study price and its quick-bind buttons. An art
 * the hero meets the level/prerequisites for but has not studied yet is learned
 * here, paid in silver + EXP.
 */
export function SkillsModal({
  isOpen,
  onClose,
  skills = [],
  weapon = "kiem",
  sect = "vo-dang",
  learnedSkills = [],
  skillLevels = {},
  level = 1,
  coins = 0,
  exp = 0,
  quickSlotsMapping = {},
  onAssignSkill,
  onUpgradeSkill,
  onLearnSkill
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
  const sectEntry = SECTS[normalizeSect(sect)] || null;

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
  /** Level this hero has in the selected art (1 for a freshly studied skill). */
  const selectedLevel = selectedSkill ? skillLevelOf(skillLevels, selectedSkill.id) : 1;
  /** The entry as it actually behaves at `selectedLevel` (scaled damage/effects). */
  const selectedAtLevel = selectedSkill ? skillAtLevel(selectedSkill, selectedLevel) : null;
  /** Price of the next level, or null when the art is already maxed. */
  const upgradeCost = selectedUnlocked
    ? skillUpgradeCost(selectedLevel, selectedSkill)
    : null;
  /** Price as the player reads it: vàng once it reaches one, bạc below that. */
  const upgradePrice = upgradeCost ? moneyLabel(upgradeCost.coinsBac, t) : "";
  const upgradeShortfall = upgradeCost
    ? skillFundsShortfall(upgradeCost, { coins, exp })
    : null;
  /** Character level the next rank demands, or null when the art is maxed. */
  const nextLevelRequired = upgradeCost
    ? characterLevelForSkillLevel(selectedSkill, selectedLevel + 1)
    : null;
  const levelTooLow = nextLevelRequired !== null && level < nextLevelRequired;
  /** HP/s an always-on art restores at its current level; 0 for every cast skill. */
  const selectedRegen = selectedSkill ? regenPerSecond(selectedSkill, selectedLevel) : 0;
  /** Price of studying this art, when it is eligible and still unknown. */
  const learnCost =
    selectedSkill && selectedLockReason?.kind === "learn" ? skillLearnCost(selectedSkill) : null;
  const learnPrice = learnCost ? moneyLabel(learnCost.coinsBac, t) : "";
  const learnShortfall = learnCost ? skillFundsShortfall(learnCost, { coins, exp }) : null;

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
          <span className="skills-weapon-badge">
            {sectEntry ? t(sectEntry.nameKey) : t(weaponLabelKey)}
          </span>
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
                    {/*
                     * A skill's `mult` is measured against `attack - defence`, and a
                     * plain swing now only takes a `NORMAL_ATTACK_MULT` share of that,
                     * so divide it back out: the chip reads "vs one normal hit", the
                     * only damage figure the player has to compare against.
                     */}
                    {t("skills.dmgTag", {
                      pct: Math.round((selectedAtLevel.mult / NORMAL_ATTACK_MULT) * 100)
                    })}
                  </span>
                )}
                {selectedRegen > 0 && (
                  <span className="skills-stat-chip">
                    {t("skills.regenTag", { hp: selectedRegen })}
                  </span>
                )}
                {selectedUnlocked && (
                  <span className="skills-stat-chip skills-level-chip">
                    {t("skills.levelTag", { level: selectedLevel, max: MAX_SKILL_LEVEL })}
                  </span>
                )}
                {selectedUnlocked && selectedLevel > 1 && (
                  <span className="skills-stat-chip skills-level-bonus">
                    {t("skills.levelBonus", {
                      pct: Math.round(skillLevelBonus(selectedLevel) * 100)
                    })}
                  </span>
                )}
                {nextLevelRequired !== null && (
                  <span
                    className={`skills-stat-chip skills-req-chip${levelTooLow ? " unmet" : ""}`}
                  >
                    {t("skills.reqLevelTag", { level: nextLevelRequired })}
                  </span>
                )}
              </div>

              {/* Studying: an art of the hero's own sect whose level and
                  prerequisites are met is learned here, paid in silver + EXP. */}
              {learnCost && (
                <div className="skills-upgrade">
                  <button
                    type="button"
                    className="skills-upgrade-btn"
                    disabled={Boolean(learnShortfall)}
                    title={
                      learnShortfall
                        ? t("skills.learnShort", { price: learnPrice, exp: learnCost.exp })
                        : t("skills.learnHint")
                    }
                    onClick={() => onLearnSkill?.(selectedSkill.id)}
                  >
                    <span className="skills-upgrade-label">{t("skills.learn")}</span>
                    <span className="skills-upgrade-cost">
                      {t("skills.learnCost", { price: learnPrice, exp: learnCost.exp })}
                    </span>
                  </button>
                </div>
              )}

              {/* Levelling: the server owns the price and the debit; the panel
                  only shows what the next rank costs and whether it is affordable. */}
              {selectedUnlocked && (
                <div className="skills-upgrade">
                  {upgradeCost ? (
                    <button
                      type="button"
                      className="skills-upgrade-btn"
                      disabled={Boolean(upgradeShortfall) || levelTooLow}
                      title={
                        levelTooLow
                          ? t("skills.levelShort", { level: nextLevelRequired })
                          : upgradeShortfall
                            ? t("skills.upgradeShort", {
                                price: upgradePrice,
                                exp: upgradeCost.exp
                              })
                            : t("skills.upgradeHint")
                      }
                      onClick={() => onUpgradeSkill?.(selectedSkill.id)}
                    >
                      <span className="skills-upgrade-label">
                        {t("skills.upgrade", { level: selectedLevel + 1 })}
                      </span>
                      <span className="skills-upgrade-cost">
                        {t("skills.upgradeCost", {
                          price: upgradePrice,
                          exp: upgradeCost.exp
                        })}
                      </span>
                    </button>
                  ) : (
                    <span className="skills-upgrade-maxed">
                      {t("skills.maxLevel", { max: MAX_SKILL_LEVEL })}
                    </span>
                  )}
                </div>
              )}

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
