import React, { useEffect, useState } from "react";
import { QUICK_ITEMS } from "../../game/items.js";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { localizeItem } from "../../i18n/localize.js";
import { bridge, EVENTS } from "../../game/bridge.js";

export function HotbarDock({
  coins = 0,
  audioEnabled,
  onUseItem,
  onAttack,
  onSkill,
  onSelectSkill,
  onOpenSkillKeys,
  onInventory,
  onCharacter,
  onOpenHelp,
  onToggleAudio,
  onLogout,
  onTogglePk,
  pkEnabled = false,
  skills = [],
  skillBinds = [],
  selectedSkillSlot = 0,
  items = QUICK_ITEMS
}) {
  const { t } = useI18n();
  const [cooldownEnds, setCooldownEnds] = useState({});
  const [clock, setClock] = useState(0);

  useEffect(() => {
    const off = bridge.on(EVENTS.SKILL_CAST, ({ slot, cooldown }) => {
      if (typeof slot !== "number") return;
      setCooldownEnds((prev) => ({ ...prev, [slot]: Date.now() + (cooldown || 0) }));
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

  const cooldownLeft = (slot) => Math.max(0, (cooldownEnds[slot] || 0) - clock);
  const selectedSkill = skills.find((skill) => skill.slot === selectedSkillSlot) || skills[0] || null;

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

        {/* Middle: normal attack, right-hand skill, and the sect skill bar */}
        <div className="martial-center">
          <div
            className="martial-skill-box l-click"
            id="skill-attack-box"
            title={t("hotbar.attackTitle")}
            onClick={onAttack}
          >
            <div className="skill-art art-sword"></div>
            <span className="click-badge">{t("hotbar.leftClick")}</span>
          </div>

          <div
            className="right-hand-slot"
            id="right-hand-slot"
            title={t("skills.rightHandTitle")}
            onClick={onSkill}
          >
            <span className="right-hand-glyph">{selectedSkill?.glyph || "?"}</span>
            <span className="click-badge">{t("skills.rightClickCast")}</span>
          </div>

          <div className="skill-bar" id="skill-bar">
            {skills.map((skill) => {
              const remaining = cooldownLeft(skill.slot);
              return (
                <button
                  key={skill.id}
                  type="button"
                  className={`skill-slot ${skill.slot === selectedSkillSlot ? "selected" : ""} ${
                    remaining > 0 ? "cooling" : ""
                  }`}
                  title={`${t(skill.nameKey, undefined, skill.id)} · ${skill.mp} MP`}
                  onClick={() => onSelectSkill?.(skill.slot)}
                >
                  <span className="skill-slot-glyph">{skill.glyph}</span>
                  <span className="skill-slot-key">{(skillBinds[skill.slot] || "?").toUpperCase()}</span>
                  {remaining > 0 && (
                    <span className="skill-slot-cd">{Math.ceil(remaining / 1000)}</span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="skill-bind-btn"
            title={t("skills.keybind.title")}
            onClick={onOpenSkillKeys}
          >
            {t("skills.keybind.short")}
          </button>

          <div className="martial-text-label">
            <div className="martial-name">{t("hotbar.martialName")}</div>
            <div className="martial-sub">{t("hotbar.martialSub")}</div>
          </div>
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
