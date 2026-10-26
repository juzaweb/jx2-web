import React, { useCallback, useEffect, useRef, useState } from "react";
import { SkillIcon } from "./SkillIcon.jsx";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { MOBILE_SKILL_SLOTS } from "../game/mobileSkills.js";
import { MOBILE_ITEM_SLOTS } from "../game/mobileItems.js";
import { useSkillCooldowns } from "./hooks/useSkillCooldowns.js";

/** Stable defaults so a missing prop never re-creates the arrays each render. */
const EMPTY_SKILL_SLOTS = Object.freeze(
  Array.from({ length: MOBILE_SKILL_SLOTS }, () => null)
);
const EMPTY_ITEM_SLOTS = Object.freeze(
  Array.from({ length: MOBILE_ITEM_SLOTS }, () => null)
);

/**
 * How long a bound button must be held to become a re-bind gesture. Long enough
 * that combat taps never trip it, short enough to feel deliberate. Kept in sync
 * with `--mctrl-rebind-ms` in index.css, which drives the progress ring.
 */
const REBIND_HOLD_MS = 780;

/**
 * Mobile Controls with Virtual Joystick on bottom-left and Arc Skill Buttons on bottom-right.
 *
 * The arc is laid out by CSS: each button only reports its ring index through
 * the `--i` custom property, so adding a slot costs one array entry. Both the
 * skill fan and the consumable column start empty — a tap on "+" opens the
 * matching picker, a long hold re-binds an occupied button.
 */
export function MobileControls({
  onMove,
  onAttack,
  onCastSkill,
  onAssignSkill,
  onUseItem,
  onAssignItem,
  skills = [],
  skillSlots = EMPTY_SKILL_SLOTS,
  items = [],
  itemSlots = EMPTY_ITEM_SLOTS
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
  /** Slot whose rebind ring is currently filling, keyed "skill:0" / "item:1". */
  const [holdingKey, setHoldingKey] = useState(null);
  const cooldownLeft = useSkillCooldowns();

  useEffect(
    () => () => {
      // Unmounting mid-hold must not leave a pending rebind behind.
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

  // Consumable buttons, same contract as the skills: empty until the player
  // binds an item from the bag.
  const itemButtons = Array.from({ length: MOBILE_ITEM_SLOTS }, (_, idx) => {
    const itemId = itemSlots?.[idx] || null;
    const item = itemId
      ? items.find((entry) => entry && entry.id === itemId) || null
      : null;
    return { idx, item };
  });

  const handlePickPress = (open) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    open();
  };

  /**
   * Press-and-hold a bound button to re-bind it. The ring fills for exactly as
   * long as the timer runs, so the gesture is discoverable; releasing earlier
   * is a plain tap and activates the button.
   */
  const startPress = (key, onLongPress) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Capture the pointer so the release still lands on this button even if the
    // finger drifts — otherwise the cast/use would be lost.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    longPressFired.current = false;
    clearTimeout(longPressTimer.current);
    setHoldingKey(key);
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      longPressFired.current = true;
      setHoldingKey(null);
      navigator.vibrate?.(10);
      onLongPress();
    }, REBIND_HOLD_MS);
  };

  const endPress = (activate) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    setHoldingKey(null);
    if (longPressFired.current) return;
    activate();
  };

  const cancelPress = () => {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    setHoldingKey(null);
  };

  const handleAttackPress = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Same reason as the action buttons: a drifting finger must still attack.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    onAttack?.();
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
        {/* Main Central Attack Button: also the centre of the orbit. */}
        <button
          id="mobile-attack"
          className="arc-btn arc-btn-attack"
          onPointerDown={handleAttackPress}
          title={t("skills.basicAttack", undefined, "Thường")}
          aria-label={t("skills.basicAttack", undefined, "Thường")}
        >
          <span className="arc-icon">⚔</span>
          <span className="arc-label">Công</span>
        </button>

        {/* Skill Buttons in Arc: empty slots show "+", tap to choose a skill */}
        {arcSlots.map(({ idx, skill }) => {
          const label = skill
            ? `${t(skill.nameKey, undefined, skill.id)} — ${t("skills.mobilePicker.rebind")}`
            : t("skills.mobilePicker.empty");
          // Seconds of cooldown left, so the arc matches the desktop quick bar.
          const cdLeft = skill ? cooldownLeft(skill.id) : 0;
          return (
            <button
              key={`mobile-skill-${idx}`}
              id={`mobile-skill-${idx}`}
              className={`arc-btn arc-btn-skill arc-orbit${
                skill ? "" : " arc-btn-empty"
              }${holdingKey === `skill:${idx}` ? " is-holding" : ""}`}
              style={{ "--i": idx }}
              onPointerDown={
                skill
                  ? startPress(`skill:${idx}`, () => onAssignSkill?.(idx))
                  : handlePickPress(() => onAssignSkill?.(idx))
              }
              onPointerUp={skill ? endPress(() => onCastSkill?.(skill.id)) : undefined}
              onPointerCancel={skill ? cancelPress : undefined}
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
              {cdLeft > 0 && <span className="arc-cd">{Math.ceil(cdLeft / 1000)}</span>}
            </button>
          );
        })}

        {/* Consumable buttons: a column outside the fan, empty until bound */}
        {itemButtons.map(({ idx, item }) => {
          // A bound consumable the bag has run out of must not read as "ready".
          const outOfStock = Boolean(item) && !(item.qty > 0);
          const label = item
            ? `${item.name} ×${item.qty ?? 0} — ${
                outOfStock
                  ? t("mobileItems.picker.outOfStock")
                  : t("mobileItems.picker.rebind")
              }`
            : t("mobileItems.picker.empty");
          return (
            <button
              key={`mobile-item-${idx}`}
              id={`mobile-item-${idx}`}
              className={`arc-btn arc-btn-potion${item ? "" : " arc-btn-empty"}${
                outOfStock ? " is-out-of-stock" : ""
              }${holdingKey === `item:${idx}` ? " is-holding" : ""}`}
              style={{ "--item-slot": idx }}
              onPointerDown={
                item
                  ? startPress(`item:${idx}`, () => onAssignItem?.(idx))
                  : handlePickPress(() => onAssignItem?.(idx))
              }
              onPointerUp={item ? endPress(() => onUseItem?.(item.id)) : undefined}
              onPointerCancel={item ? cancelPress : undefined}
              onContextMenu={(event) => {
                event.preventDefault();
                onAssignItem?.(idx);
              }}
              title={label}
              aria-label={label}
            >
              {item ? (
                <>
                  <div className={`item-icon ${item.icon}`} />
                  {item.qty > 0 && <span className="arc-badge">{item.qty}</span>}
                </>
              ) : (
                <span className="arc-plus" aria-hidden="true">
                  +
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
