import React, { useEffect, useState } from "react";
import { QUICK_ITEMS } from "../../game/items.js";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { localizeItem } from "../../i18n/localize.js";
import { bridge, EVENTS } from "../../game/bridge.js";
import { SkillIcon } from "../SkillIcon.jsx";

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
  skillLoadout = { u: 0, i: 1, o: 2, p: 3 },
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
  const skillSlots = [
    { key: "u", slot: skillLoadout?.u ?? leftSkillSlot ?? 0 },
    { key: "i", slot: skillLoadout?.i ?? selectedSkillSlot ?? 1 },
    { key: "o", slot: skillLoadout?.o ?? 2 },
    { key: "p", slot: skillLoadout?.p ?? 3 }
  ];

  // The bottom bar mirrors the reference: consumables in 1-4, skill icons in
  // 5-10 and two spare slots at the end.
  const quickSlots = Array.from({ length: 12 }, (_, index) => {
    const useSlot = index + 1;
    const raw = items.find((entry) => entry.useSlot === useSlot);
    const skill = useSlot >= 5 && useSlot <= 10
      ? skills.find((entry) => entry.slot === useSlot - 5) || null
      : null;
    return { useSlot, item: raw ? localizeItem(raw, t) : null, skill };
  });

  return (
    <section className="bottom-dock" id="bottom-dock">
      <div className="dock-container">
        {/* Left Belt: Numbered Quick Slots (Potions & Scrolls) */}
        <div className="hotbar-slots">
          {quickSlots.map(({ useSlot, item, skill }) => {
            if (!item && !skill) {
              return (
                <div className="slot-item empty" id={`slot-${useSlot}`} key={`slot-${useSlot}`}>
                  <span className="slot-key">{useSlot}</span>
                </div>
              );
            }
            if (!item && skill) {
              return (
                <div
                  className="slot-item skill-slot"
                  id={`slot-${useSlot}`}
                  key={`skill-${skill.id}`}
                  title={t(skill.nameKey, undefined, skill.nameKey)}
                >
                  <span className="slot-key">{useSlot}</span>
                  <SkillIcon skill={skill} className="slot-skill-img" />
                </div>
              );
            }
            return (
              <div
                className="slot-item"
                id={`slot-${useSlot}`}
                key={item.id}
                title={t("hotbar.slotTitle", { key: useSlot, name: item.name })}
                onClick={() => onUseItem(useSlot)}
              >
                <span className="slot-key">{useSlot}</span>
                <div className={`item-icon ${item.icon}`} />
                <span className="slot-qty" id={`qty-${item.id}`}>
                  {item.qty}
                </span>
              </div>
            );
          })}
        </div>

        {/* Middle: 4 UIOP sect skill slots */}
        <div className="martial-center">
          {skillSlots.map(({ key, slot }) => {
            const assignedSkill = skills.find((entry) => entry.slot === slot) || null;
            const cd = cooldownLeft(assignedSkill?.id);
            const keyLabel = key.toUpperCase();
            return (
              <button
                key={key}
                type="button"
                className="hand-slot skill-key-slot"
                id={`skill-slot-${key}`}
                title={
                  assignedSkill
                    ? `${keyLabel}: ${t(assignedSkill.nameKey, undefined, assignedSkill.id)}`
                    : t("skills.assignKey", { key: keyLabel }, `Gán chiêu [${keyLabel}]`)
                }
                onClick={() => onPickSkill?.(key)}
              >
                <SkillIcon skill={assignedSkill} className="hand-glyph" />
                {cd > 0 && <span className="hand-cd">{Math.ceil(cd / 1000)}</span>}
                <span className="click-badge">{keyLabel}</span>
              </button>
            );
          })}
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
