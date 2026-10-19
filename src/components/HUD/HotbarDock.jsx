import React from "react";
import { QUICK_ITEMS } from "../../game/items.js";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { localizeItem } from "../../i18n/localize.js";

export function HotbarDock({
  coins = 0,
  audioEnabled,
  onUseItem,
  onAttack,
  onSkill,
  onSave,
  onInventory,
  onCharacter,
  onOpenHelp,
  onToggleAudio,
  onLogout,
  onTogglePk,
  pkEnabled = false,
  items = QUICK_ITEMS
}) {
  const { t } = useI18n();
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

          {/* Slot 5 to 7: Martial shortcuts */}
          <div className="slot-item empty">
            <span className="slot-key">5</span>
          </div>
          <div className="slot-item empty">
            <span className="slot-key">6</span>
          </div>
          <div className="slot-item empty">
            <span className="slot-key">7</span>
          </div>

          {/* Slot 8 / Q: Kiếm Khí Skill */}
          <div
            className="slot-item skill-slot"
            id="slot-8"
            title={t("hotbar.skillSlotTitle")}
            onClick={onSkill}
          >
            <span className="slot-key">8/Q</span>
            <div className="item-icon icon-sword-aura"></div>
          </div>
        </div>

        {/* Middle: Active Martial Arts Cooldown & Skills Display */}
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
            className="martial-skill-box r-click"
            id="skill-q-box"
            title={t("hotbar.skillTitle")}
            onClick={onSkill}
          >
            <div className="skill-art art-aura"></div>
            <span className="click-badge">{t("hotbar.rightClickQ")}</span>
          </div>
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
