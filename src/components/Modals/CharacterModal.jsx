import React, { useState } from "react";
import { deriveCharacterSheet } from "../../game/characterStats.js";
import { getItemById } from "../../game/items.js";
import "../../styles/character.css";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { localizeItem } from "../../i18n/localize.js";
import { setDragPayload, readDragPayload, canDropOnSlot, acceptDrop } from "./dragItem.js";
import { CharacterPreview } from "../CharacterPreview.jsx";

/**
 * Paper-doll slots. A slot with a `source` shows the item worn in that equipment
 * slot and can be clicked to take it off; the rest are decorative placeholders.
 */
const DOLL_SLOTS = {
  columnLeft: [
    { key: "helm", source: "helmet", labelKey: "slots.helmet" },
    { key: "armor", source: "armor", labelKey: "slots.armor" },
    { key: "belt", labelKey: "character.slots.belt" },
    { key: "accessory", source: "accessory", labelKey: "slots.accessory", icon: "accessory" },
    { key: "bracers", labelKey: "character.slots.bracers" },
    { key: "weapon", source: "weapon", labelKey: "slots.weapon" },
    // Sits directly above the corner "Phó mật tịch" slot.
    { key: "secretManual", labelKey: "character.slots.secretManual", icon: "manual" }
  ],
  // Sits at the elbow where the vertical column meets the horizontal row.
  corner: { key: "subManual", labelKey: "character.slots.subManual", icon: "subManual" },
  row: [
    { key: "cosHat", labelKey: "character.slots.cosHat", icon: "cosHat" },
    { key: "cosTop", labelKey: "character.slots.cosTop", icon: "cosTop" },
    { key: "cosPants", labelKey: "character.slots.cosPants", icon: "cosPants" },
    { key: "mount", labelKey: "character.slots.mount", icon: "mount" }
  ]
};

const TABS = [
  { key: "equip", labelKey: "character.tabEquip", enabled: true },
  { key: "news", labelKey: "character.tabNews", enabled: false }
];

/** Faint silhouette drawn behind each empty equipment slot. */
const SLOT_ICONS = {
  helm: (
    <>
      <path d="M6 16v-3a6 6 0 0 1 12 0v3" />
      <path d="M4 16h16v3H4z" />
    </>
  ),
  armor: (
    <>
      <path d="M8 5l4 2 4-2 3 3v11H5V8z" />
      <path d="M12 7v12" />
    </>
  ),
  belt: (
    <>
      <rect x="3" y="10" width="18" height="5" rx="1" />
      <rect x="10" y="9" width="4" height="7" rx="1" />
    </>
  ),
  bracers: (
    <>
      <rect x="7" y="6" width="10" height="12" rx="2" />
      <path d="M7 12h10" />
    </>
  ),
  accessory: (
    <>
      <circle cx="12" cy="15" r="5" />
      <path d="M9 7l2 3h2l2-3" />
    </>
  ),
  weapon: (
    <>
      <path d="M12 2l2 3v11h-4V5z" />
      <path d="M7 16h10" />
      <path d="M12 19v3" />
    </>
  ),
  manual: (
    <>
      <rect x="6" y="4" width="12" height="16" rx="1.5" />
      <path d="M9 9h6" />
      <path d="M9 13h6" />
    </>
  ),
  subManual: (
    <>
      <rect x="6" y="4" width="12" height="16" rx="1.5" />
      <path d="M12 4v6l2-1.5 2 1.5V4" />
    </>
  ),
  cosHat: (
    <>
      <path d="M12 4l9 13H3z" />
      <path d="M4 17h16" />
    </>
  ),
  cosTop: <path d="M9 5l3 2 3-2 3 3-2 2v9H8v-9L6 8z" />,
  cosPants: <path d="M8 4h8v4l-1 12h-2l-1-8-1 8H9L8 8z" />,
  mount: (
    <>
      <path d="M5 19v-6l3-1 4-4 4 2 3 1v8" />
      <path d="M8 19v-3" />
      <path d="M16 19v-3" />
    </>
  )
};

export function CharacterModal({
  isOpen,
  onClose,
  stats,
  playerName = "",
  equipment = {},
  gender = "male",
  onUnequipSlot,
  onEquipItem
}) {
  const { t } = useI18n();
  const [showHint, setShowHint] = useState(false);
  const [dragOverKey, setDragOverKey] = useState(null);

  if (!isOpen) return null;

  const sheet = deriveCharacterSheet(stats);

  // Only highlight a slot for a bag item that belongs in it; other drags pass through.
  const handleSlotDragOver = (event, slot) => {
    if (!canDropOnSlot(event, slot.source)) return;
    acceptDrop(event);
    setDragOverKey(slot.key);
  };

  const clearSlotDragOver = (slot) =>
    setDragOverKey((key) => (key === slot.key ? null : key));

  // Dropping a bag item on a doll slot equips it when the slot matches.
  const handleSlotDrop = (event, slot) => {
    setDragOverKey(null);
    const payload = readDragPayload(event);
    if (payload?.kind === "inventory" && payload.slot === slot.source) {
      event.preventDefault();
      onEquipItem?.(payload.itemId);
    }
  };

  const renderSlot = (slot) => {
    const wornId = slot.source ? equipment?.[slot.source] : null;
    const item = wornId ? localizeItem(getItemById(wornId), t) : null;

    if (item) {
      return (
        <button
          type="button"
          className={`equip-slot filled${dragOverKey === slot.key ? " drag-over" : ""}`}
          key={slot.key}
          title={t("character.unequipTitle", { name: item.name })}
          draggable
          onDragStart={(event) => setDragPayload(event, { kind: "equipment", slot: slot.source })}
          onDragOver={(event) => handleSlotDragOver(event, slot)}
          onDragLeave={() => clearSlotDragOver(slot)}
          onDrop={(event) => handleSlotDrop(event, slot)}
          onClick={() => onUnequipSlot?.(slot.source)}
        >
          <span className={`inv-icon ${item.icon}`} />
        </button>
      );
    }

    const droppable = Boolean(slot.source);
    return (
      <div
        className={`equip-slot${dragOverKey === slot.key ? " drag-over" : ""}`}
        key={slot.key}
        title={t("character.notEquipped", { label: t(slot.labelKey) })}
        onDragOver={droppable ? (event) => handleSlotDragOver(event, slot) : undefined}
        onDragLeave={droppable ? () => clearSlotDragOver(slot) : undefined}
        onDrop={droppable ? (event) => handleSlotDrop(event, slot) : undefined}
      >
        <svg className="equip-slot-icon" viewBox="0 0 24 24" aria-hidden="true">
          {SLOT_ICONS[slot.icon || slot.key]}
        </svg>
      </div>
    );
  };

  return (
    <div className="char-modal-overlay" id="character-modal">
      <div
        className="char-panel"
        role="dialog"
        aria-modal="false"
        aria-label={t("character.title")}
      >
        <div className="char-titlebar">
          <span className="char-title">{t("character.title")}</span>
          <div className="char-titlebar-actions">
            <button
              className="char-icon-btn"
              title={t("character.helpTitle")}
              onClick={() => setShowHint((v) => !v)}
            >
              ?
            </button>
            <button
              className="char-icon-btn close"
              title={t("character.closeTitle")}
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>

        {showHint && (
          <div className="char-hint">
            {t("character.hint")}
          </div>
        )}

        <div className="char-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={tab.enabled}
              className={`char-tab${tab.enabled ? " active" : ""}`}
              disabled={!tab.enabled}
              title={tab.enabled ? t(tab.labelKey) : t("character.locked", { label: t(tab.labelKey) })}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        <div className="char-body">
          <div className="char-side">
            <div className="char-stats">
              {sheet.vitals.map((row) => (
                <div className="stat-row vital" key={row.key}>
                  <span className="stat-label">{t(`stats.${row.key}`, undefined, row.label)}</span>
                  <span className="stat-value">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="char-stats">
              {sheet.combat.map((row) => (
                <div className="stat-row" key={row.key}>
                  <span className="stat-label">{t(`stats.${row.key}`, undefined, row.label)}</span>
                  <span className="stat-value">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="char-stats">
              {sheet.attributes.map((row) => (
                <div className="stat-row attr" key={row.key}>
                  <span className="stat-label">{t(`stats.${row.key}`, undefined, row.label)}</span>
                  <span className="stat-value">
                    {row.base}
                    <span className="attr-bonus">+{row.bonus}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="char-potential">
              <span className="stat-label">{t("character.potential")}</span>
              <span className="stat-value">{sheet.footer.potential}</span>
            </div>
          </div>

          <div className="char-main">
            <div className="char-equip">
              <div className="equip-col left">
                {DOLL_SLOTS.columnLeft.map(renderSlot)}
              </div>

              <div className="char-model">
                <CharacterPreview gender={gender} equipment={equipment} />
                {playerName && <div className="char-model-name">{playerName}</div>}
              </div>

              <div className="equip-corner">{renderSlot(DOLL_SLOTS.corner)}</div>

              <div className="equip-row">{DOLL_SLOTS.row.map(renderSlot)}</div>
            </div>
          </div>
        </div>

        <div className="char-footer">
          <span>
            {t("character.points")} <b>{sheet.footer.points}</b>
          </span>
          <span>
            {t("character.nextLevel")} <b>{sheet.footer.nextLevelExp}</b>
          </span>
        </div>
      </div>
    </div>
  );
}
