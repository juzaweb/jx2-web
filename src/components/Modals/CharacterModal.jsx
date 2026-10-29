import React, { useState } from "react";
import { deriveCharacterSheet } from "../../game/characterStats.js";
import { getItemById } from "../../game/items.js";
import { bonusRows } from "../../game/equipment.js";
import "../../styles/character.css";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { localizeItem, localizeBonusRows } from "../../i18n/localize.js";
import { setDragPayload } from "./dragItem.js";
import { useDraggablePanel } from "./useDraggablePanel.js";

/**
 * Paper-doll slots. A slot with a `source` shows the item worn in that equipment
 * slot and can be clicked to take it off; the rest are decorative placeholders.
 */
const COMPACT_SLOTS = [
  { key: "helm", source: "helmet", labelKey: "slots.helmet", icon: "helm" },
  { key: "secretManual", labelKey: "character.slots.secretManual", icon: "manual" },
  { key: "armor", source: "armor", labelKey: "slots.armor", icon: "armor" },
  { key: "subManual", labelKey: "character.slots.subManual", icon: "subManual" },
  { key: "pants", source: "pants", labelKey: "slots.pants", icon: "cosPants" },
  { key: "belt", labelKey: "character.slots.belt", icon: "belt" },
  { key: "accessory", source: "accessory", labelKey: "slots.accessory", icon: "accessory" },
  { key: "cosHat", labelKey: "character.slots.cosHat", icon: "cosHat" },
  { key: "bracers", labelKey: "character.slots.bracers", icon: "bracers" },
  { key: "cosTop", labelKey: "character.slots.cosTop", icon: "cosTop" },
  { key: "weapon", source: "weapon", labelKey: "slots.weapon", icon: "weapon" },
  { key: "mount", labelKey: "character.slots.mount", icon: "mount" }
];

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
  onUnequipSlot
}) {
  const { t } = useI18n();
  const [showHint, setShowHint] = useState(false);
  const [selectedEquip, setSelectedEquip] = useState(null);
  const { panelRef, dragging, panelStyle, dragHandlers } = useDraggablePanel(isOpen);

  if (!isOpen) return null;

  const sheet = deriveCharacterSheet(stats);

  const handleSlotClick = (slot, item) => {
    if (!item) return;

    const isTouch = typeof window !== "undefined" && (
      window.innerWidth <= 960 ||
      window.innerHeight <= 500 ||
      ("ontouchstart" in window) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)
    );

    if (isTouch) {
      setSelectedEquip({
        item,
        slotKey: slot.key,
        source: slot.source,
        label: t(slot.labelKey)
      });
      return;
    }

    onUnequipSlot?.(slot.source);
  };

  const renderSlot = (slot) => {
    const wornId = slot.source ? equipment?.[slot.source] : null;
    const item = wornId ? localizeItem(getItemById(wornId), t) : null;

    if (item) {
      return (
        <button
          type="button"
          className="equip-slot filled"
          key={slot.key}
          title={t("character.unequipTitle", { name: item.name })}
          data-equip-slot={slot.source}
          draggable
          onDragStart={(event) => setDragPayload(event, { kind: "equipment", slot: slot.source })}
          onClick={() => handleSlotClick(slot, item)}
        >
          <span className={`inv-icon ${item.icon}`} />
        </button>
      );
    }

    return (
      <div
        className="equip-slot"
        key={slot.key}
        title={t("character.notEquipped", { label: t(slot.labelKey) })}
        data-equip-slot={slot.source}
      >
        <svg className="equip-slot-icon" viewBox="0 0 24 24" aria-hidden="true">
          {SLOT_ICONS[slot.icon || slot.key]}
        </svg>
      </div>
    );
  };

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };

  const selectedBonusRows = selectedEquip?.item
    ? localizeBonusRows(bonusRows(selectedEquip.item), t)
    : [];

  return (
    <div className="char-modal-overlay" id="character-modal" onClick={handleOverlayClick}>
      <div
        className={`char-panel${dragging ? " is-dragging" : ""}`}
        ref={panelRef}
        style={panelStyle}
        role="dialog"
        aria-modal="false"
        aria-label={t("character.title")}
      >
        <div className="char-titlebar" {...dragHandlers}>
          <span className="char-title">{t("character.title")}</span>
          <div className="char-titlebar-actions">
            <button
              type="button"
              className="char-icon-btn"
              title={t("character.helpTitle")}
              onClick={() => setShowHint((v) => !v)}
            >
              ?
            </button>
            <button
              type="button"
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
            {playerName && (
              <div className="char-identity">
                {playerName} · Lv {sheet.level}
              </div>
            )}
            <div className="char-stats">
              {sheet.vitals.map((row) => (
                <div className="stat-row vital" key={row.key} data-stat={row.key}>
                  <span className="stat-label">{t(`stats.${row.key}`, undefined, row.label)}</span>
                  <span className="stat-value">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="char-stats">
              {sheet.combat.map((row) => (
                <div className="stat-row" key={row.key} data-stat={row.key}>
                  <span className="stat-label">{t(`stats.${row.key}`, undefined, row.label)}</span>
                  <span className="stat-value">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="char-stats">
              <div className="stat-row" data-stat="points">
                <span className="stat-label">{t("character.points")}</span>
                <span className="stat-value">{sheet.footer.points}</span>
              </div>
            </div>
          </div>

          <div className="char-main">
            <div className="char-equip-grid">
              {COMPACT_SLOTS.map(renderSlot)}
            </div>
          </div>
        </div>

        {selectedEquip && (
          <div className="item-detail-overlay" onClick={() => setSelectedEquip(null)}>
            <div
              className="item-detail-card"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label={selectedEquip.item.name}
            >
              <div className="item-detail-head">
                <span className={`item-detail-icon inv-icon ${selectedEquip.item.icon}`} />
                <div className="item-detail-title-group">
                  <div className="item-detail-name">{selectedEquip.item.name}</div>
                  <div className="item-detail-slot">{selectedEquip.label}</div>
                </div>
                <button
                  type="button"
                  className="item-detail-close-btn"
                  onClick={() => setSelectedEquip(null)}
                  title={t("common.close")}
                >
                  ×
                </button>
              </div>

              {selectedEquip.item.desc && (
                <div className="item-detail-desc">{selectedEquip.item.desc}</div>
              )}

              {selectedBonusRows.length > 0 && (
                <div className="item-detail-bonuses">
                  {selectedBonusRows.map((row) => (
                    <div key={row.stat} className="item-detail-bonus-row">
                      <span>{row.label}</span>
                      <span className="item-detail-bonus-val">+{row.amount}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="item-detail-actions">
                <button
                  type="button"
                  className="item-detail-action-btn equip"
                  onClick={() => {
                    onUnequipSlot?.(selectedEquip.source);
                    setSelectedEquip(null);
                  }}
                >
                  {t("character.unequipAction")}
                </button>
                <button
                  type="button"
                  className="item-detail-action-btn cancel"
                  onClick={() => setSelectedEquip(null)}
                >
                  {t("common.close")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
