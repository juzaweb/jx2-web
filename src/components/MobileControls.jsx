import React, { useCallback, useEffect, useRef, useState } from "react";
import { SkillIcon } from "./SkillIcon.jsx";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { MOBILE_SKILL_SLOTS } from "../game/mobileSkills.js";

/** Stable default so a missing prop never re-creates the array each render. */
const EMPTY_SKILL_SLOTS = Object.freeze(
  Array.from({ length: MOBILE_SKILL_SLOTS }, () => null)
);

/**
 * Mobile Controls with Virtual Joystick on bottom-left and Arc Skill Buttons on bottom-right.
 */
export function MobileControls({
  onMove,
  onAttack,
  onCastSkill,
  onAssignSkill,
  onUseItem,
  skills = [],
  skillSlots = EMPTY_SKILL_SLOTS
}) {
  const { t } = useI18n();
  const [joystickActive, setJoystickActive] = useState(false);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const activePointerId = useRef(null);
  const baseRef = useRef(null);
  const activeDirRef = useRef(null);
  /** Pending long-press that turns a bound button into a re-bind gesture. */
  const longPressTimer = useRef(null);
  const longPressFired = useRef(false);

  useEffect(
    () => () => {
      clearTimeout(longPressTimer.current);
    },
    []
  );

  const calculateDirection = (dx, dy) => {
    const dist = Math.hypot(dx, dy);
    if (dist < 12) return null;

    const angle = Math.atan2(dy, dx); // radians, -PI to PI
    // Divide circle into 4 or 8 sectors
    // Up: dy < 0, angle ~ -PI/2
    // Down: dy > 0, angle ~ PI/2
    // Right: dx > 0, angle ~ 0
    // Left: dx < 0, angle ~ PI or -PI
    if (angle >= -Math.PI * 0.75 && angle < -Math.PI * 0.25) return "up";
    if (angle >= -Math.PI * 0.25 && angle < Math.PI * 0.25) return "right";
    if (angle >= Math.PI * 0.25 && angle < Math.PI * 0.75) return "down";
    return "left";
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (activePointerId.current !== null) return;
    activePointerId.current = e.pointerId;
    e.target.setPointerCapture?.(e.pointerId);

    setJoystickActive(true);
    updateStick(e);
  };

  const updateStick = useCallback((e) => {
    if (!baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = e.clientX - centerX;
    let dy = e.clientY - centerY;
    const maxRadius = rect.width / 2 - 10;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    setStickPos({ x: dx, y: dy });

    const dir = calculateDirection(dx, dy);
    if (dir !== activeDirRef.current) {
      activeDirRef.current = dir;
      onMove?.(dir);
    }
  }, [onMove]);

  const handlePointerMove = (e) => {
    if (e.pointerId !== activePointerId.current) return;
    e.preventDefault();
    updateStick(e);
  };

  const handlePointerUp = (e) => {
    if (e.pointerId !== activePointerId.current) return;
    e.preventDefault();
    activePointerId.current = null;
    setJoystickActive(false);
    setStickPos({ x: 0, y: 0 });
    if (activeDirRef.current !== null) {
      activeDirRef.current = null;
      onMove?.(null);
    }
  };

  // Four arc buttons, each bound to a chosen skill (empty until the player taps
  // the "+" and picks one).
  const arcSlots = Array.from({ length: MOBILE_SKILL_SLOTS }, (_, idx) => {
    const skillId = skillSlots?.[idx] || null;
    const skill = skillId ? skills.find((entry) => entry?.id === skillId) || null : null;
    return { idx, skill };
  });

  const handlePickPress = (idx) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    onAssignSkill?.(idx);
  };

  const startSkillPress = (idx, skill) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Capture the pointer so the release still lands on this button even if the
    // finger drifts — otherwise the cast would be lost.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    longPressFired.current = false;
    clearTimeout(longPressTimer.current);
    // Hold a bound button to choose a different skill for it.
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      onAssignSkill?.(idx);
    }, 500);
  };

  const endSkillPress = (skill) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    if (longPressFired.current) return;
    onCastSkill?.(skill.id);
  };

  const cancelSkillPress = () => {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const handleAttackPress = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onAttack?.();
  };

  const handlePotionPress = (slot) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    onUseItem?.(slot);
  };

  return (
    <div className="mobile-controls" id="mobile-controls">
      {/* Virtual Joystick (Bottom Left) */}
      <div
        ref={baseRef}
        className={`virtual-joystick-base ${joystickActive ? "active" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="virtual-joystick-stick"
          style={{
            transform: `translate(${stickPos.x}px, ${stickPos.y}px)`
          }}
        />
        <div className="joystick-dir-indicator dir-up">▲</div>
        <div className="joystick-dir-indicator dir-left">◀</div>
        <div className="joystick-dir-indicator dir-right">▶</div>
        <div className="joystick-dir-indicator dir-down">▼</div>
      </div>

      {/* Radial Arc Skill Cluster (Bottom Right) */}
      <div className="mobile-skill-arc">
        {/* Main Central Attack Button */}
        <button
          id="mobile-attack"
          className="arc-btn arc-btn-attack"
          onPointerDown={handleAttackPress}
          title={t("skills.basicAttack", undefined, "Thường")}
        >
          <span className="arc-icon">⚔</span>
          <span className="arc-label">Công</span>
        </button>

        {/* Skill Buttons in Arc: empty slots show "+", tap to choose a skill */}
        {arcSlots.map(({ idx, skill }) => {
          const label = skill
            ? `${t(skill.nameKey, undefined, skill.id)} — ${t("skills.mobilePicker.rebind")}`
            : t("skills.mobilePicker.empty");
          return (
            <button
              key={`mobile-skill-${idx}`}
              id={`mobile-skill-${idx}`}
              className={`arc-btn arc-btn-skill arc-skill-${idx}${
                skill ? "" : " arc-btn-empty"
              }`}
              onPointerDown={skill ? startSkillPress(idx, skill) : handlePickPress(idx)}
              onPointerUp={skill ? endSkillPress(skill) : undefined}
              onPointerCancel={skill ? cancelSkillPress : undefined}
              onContextMenu={(event) => {
                event.preventDefault();
                onAssignSkill?.(idx);
              }}
              title={label}
              aria-label={label}
            >
              {skill ? (
                <SkillIcon skill={skill} className="arc-skill-img" />
              ) : (
                <span className="arc-plus" aria-hidden="true">
                  +
                </span>
              )}
            </button>
          );
        })}

        {/* Quick Potions Arc (fixed consumables, independent of hotbar slots) */}
        <button
          className="arc-btn arc-btn-potion arc-potion-1"
          onPointerDown={handlePotionPress("kim-sang-duoc")}
          title="Kim Sáng Dược (+35 HP)"
        >
          <span className="arc-icon">🧪</span>
          <span className="arc-badge">1</span>
        </button>
        <button
          className="arc-btn arc-btn-potion arc-potion-2"
          onPointerDown={handlePotionPress("dai-hoan-dan")}
          title="Đại Hoàn Đan (+25 MP)"
        >
          <span className="arc-icon">🍷</span>
          <span className="arc-badge">2</span>
        </button>
      </div>
    </div>
  );
}
