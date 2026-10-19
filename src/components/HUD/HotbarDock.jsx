import React, { useEffect, useState } from "react";
import { QUICK_ITEMS } from "../../game/items.js";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { localizeItem } from "../../i18n/localize.js";
import { bridge, EVENTS } from "../../game/bridge.js";

export function HotbarDock({
  coins = 0,
  audioEnabled,
  onUseItem,
  onInventory,
  onCharacter,
  onOpenHelp,
  onToggleAudio,
  onLogout,
  onTogglePk,
  pkEnabled = false,
  skills = [],
  selectedSkillSlot = 0,
  leftSkillSlot = 0,
  onPickSkill,
  items = QUICK_ITEMS
}) {
  const { t } = useI18n();
  const [cooldownEnds, setCooldownEnds] = useState({});
  const [clock, setClock] = useState(0);

  useEffect(() => {
    const off = bridge.on(EVENTS.SKILL_CAST, ({ skillId, cooldown }) => {
      if (!skillId) return;
      const now = Date.now();
      setClock(now);
      setCooldownEnds((prev) => ({ ...prev, [skillId]: now + (cooldown || 0) }));
    });
    return off;
  }, []);

  useEffect(() => {
    const active = Object.values(cooldownEnds).some((end) => end > Date.now());
    if (!active) return undefined;
    const id = setInterval(() => {
      const now = Date.now();
      setClock(now);
      setCooldownEnds((prev) => {
        const next = {};
        let changed = false;
        for (const [slot, end] of Object.entries(prev)) {
          if (end > now) next[slot] = end;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 200);
    return () => clearInterval(id);
  }, [cooldownEnds]);

  const cooldownLeft = (skillId) =>
    skillId ? Math.max(0, (cooldownEnds[skillId] || 0) - clock) : 0;
  const selectedSkill = skills.find((skill) => skill.slot === selectedSkillSlot) || null;
  const leftSkill = skills.find((skill) => skill.slot === leftSkillSlot) || null;
  const leftCooldown = cooldownLeft(leftSkill?.id);
  const rightCooldown = cooldownLeft(selectedSkill?.id);

  return (
    <section className="bottom-dock" id="bottom-dock">
      <div className="dock-container">
        {/* Left Belt: Numbered Quick Slots (Potions & Scrolls) */}
        <div className="hotbar-slots">
          {items.map((rawItem) => {
            const item = localizeItem(rawItem, t);
            return (
              <div
                className="slot-item"
                id={`slot-${item.useSlot}`}
                key={item.id}
                title={t("hotbar.slotTitle", { key: item.useSlot, name: item.name })}
                onClick={() => onUseItem(item.useSlot)}
              >
                <span className="slot-key">{item.useSlot}</span>
                <div className={`item-icon ${item.icon}`} />
                <span className="slot-qty" id={`qty-${item.id}`}>
                  {item.qty}
                </span>
              </div>
            );
          })}

        </div>

        {/* Middle: the left/right mouse skills and the sect skill bar */}
        <div className="martial-center">
          <button
            type="button"
            className="hand-slot"
            id="left-hand-slot"
            title={t("skills.leftHandTitle")}
            onClick={() => onPickSkill?.("left")}
          >
            <span className="hand-glyph">{leftSkill?.glyph || "?"}</span>
            {leftCooldown > 0 && <span className="hand-cd">{Math.ceil(leftCooldown / 1000)}</span>}
            <span className="click-badge">{t("skills.handLeft")}</span>
          </button>

          <button
            type="button"
            className="hand-slot"
            id="right-hand-slot"
            title={t("skills.rightHandTitle")}
            onClick={() => onPickSkill?.("right")}
          >
            <span className="hand-glyph">{selectedSkill?.glyph || "?"}</span>
            {rightCooldown > 0 && <span className="hand-cd">{Math.ceil(rightCooldown / 1000)}</span>}
            <span className="click-badge">{t("skills.handRight")}</span>
          </button>

        </div>

        {/* Hero Portrait */}
        <div className="hero-portrait" title={t("hotbar.portraitTitle")}>
          <div className="portrait-avatar">
            <img
              src="/hero_portrait.png"
              alt={t("hotbar.portraitAlt")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center 15%",
                display: "block"
              }}
            />
          </div>
          <div className="portrait-coins" id="coin-label">
            {t("hotbar.coins")}: {coins}
          </div>
        </div>

        {/* Right Utility: System Icons Tray */}
        <div className="system-icons-tray">
          <button
            className="sys-btn"
            id="char-btn"
            title={`${t("hotbar.character")} (F3)`}
            onClick={onCharacter}
          >
            <span className="sys-ico">🧍</span>
            <span className="sys-lbl">{t("hotbar.character")}</span>
          </button>
          <button
            className="sys-btn"
            id="inv-btn"
            title={`${t("hotbar.inventory")} (F4)`}
            onClick={onInventory}
          >
            <span className="sys-ico">🎒</span>
            <span className="sys-lbl">{t("hotbar.inventory")}</span>
          </button>
          <button
            className="sys-btn"
            id="help-btn"
            title={t("hotbar.help")}
            onClick={onOpenHelp}
          >
            <span className="sys-ico">📜</span>
            <span className="sys-lbl">{t("hotbar.help")}</span>
          </button>
          <button
            className={`sys-btn pk-mode${pkEnabled ? " pk-active" : ""}`}
            id="pk-btn"
            title={t("hotbar.pkTitle")}
            onClick={onTogglePk}
          >
            <span className="sys-ico">⚔️</span>
            <span className="sys-lbl">{pkEnabled ? t("hotbar.pkOn") : t("hotbar.pkOff")}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
