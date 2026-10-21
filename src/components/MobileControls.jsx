import React, { useRef, useState, useCallback } from "react";
import { SkillIcon } from "./SkillIcon.jsx";
import { useI18n } from "../i18n/I18nProvider.jsx";

/**
 * Mobile Controls with Virtual Joystick on bottom-left and Arc Skill Buttons on bottom-right.
 */
export function MobileControls({
  onMove,
  onAttack,
  onSkill,
  onCastKey,
  onUseItem,
  skills = [],
  skillLoadout = { u: 0, i: 1, o: 2, p: 3 }
}) {
  const { t } = useI18n();
  const [joystickActive, setJoystickActive] = useState(false);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const activePointerId = useRef(null);
  const baseRef = useRef(null);
  const activeDirRef = useRef(null);

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

  const skillKeys = [
    { key: "u", slot: skillLoadout?.u ?? 0, angle: 180, label: "U" },
    { key: "i", slot: skillLoadout?.i ?? 1, angle: 215, label: "I" },
    { key: "o", slot: skillLoadout?.o ?? 2, angle: 250, label: "O" },
    { key: "p", slot: skillLoadout?.p ?? 3, angle: 285, label: "P" }
  ];

  const handleSkillPress = (key) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onCastKey) {
      onCastKey(key);
    } else {
      onSkill?.();
    }
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

        {/* Skill Buttons in Arc (U, I, O, P) */}
        {skillKeys.map(({ key, slot, label }, idx) => {
          const skill = skills.find((s) => s.slot === slot) || null;
          return (
            <button
              key={key}
              id={`mobile-skill-${key}`}
              className={`arc-btn arc-btn-skill arc-skill-${idx}`}
              onPointerDown={handleSkillPress(key)}
              title={skill ? t(skill.nameKey, undefined, skill.id) : label}
            >
              {skill ? (
                <SkillIcon skill={skill} className="arc-skill-img" />
              ) : (
                <span className="arc-glyph">氣</span>
              )}
              <span className="arc-badge">{label}</span>
            </button>
          );
        })}

        {/* Quick Potions Arc (Slots 1 & 2) */}
        <button
          className="arc-btn arc-btn-potion arc-potion-1"
          onPointerDown={handlePotionPress(1)}
          title="Kim Sáng Dược (1)"
        >
          <span className="arc-icon">🧪</span>
          <span className="arc-badge">1</span>
        </button>
        <button
          className="arc-btn arc-btn-potion arc-potion-2"
          onPointerDown={handlePotionPress(2)}
          title="Đại Hoàn Đan (2)"
        >
          <span className="arc-icon">🍷</span>
          <span className="arc-badge">2</span>
        </button>
      </div>
    </div>
  );
}
