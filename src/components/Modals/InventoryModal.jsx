import React, { useRef, useState } from "react";
import {
  INVENTORY_GRID_SIZE,
  splitSilver
} from "../../game/items.js";
import {
  EQUIPMENT_SLOTS,
  bonusRows
} from "../../game/equipment.js";
import "./inventory.css";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { localizeItem, localizeBonusRows } from "../../i18n/localize.js";
import { setDragPayload, readDragPayload, dragKind, acceptDrop } from "./dragItem.js";
import { useDraggablePanel } from "./useDraggablePanel.js";

const TOOLTIP_OFFSET = 16;
const TOOLTIP_EDGE = 12;

/** Fallback grid of empty cells, so the bag renders its full size without items. */
const EMPTY_GRID = Array.from({ length: INVENTORY_GRID_SIZE }, () => null);

const clamp = (value, max) => Math.max(4, Math.min(value, max));

export function InventoryModal({
  isOpen,
  onClose,
  onUseItem,
  onEquipItem,
  onUnequipSlot,
  equipment = {},
  coins = 0,
  inventoryItems = EMPTY_GRID,
  capacity = null
}) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [showHint, setShowHint] = useState(false);
  const tooltipRef = useRef(null);
  const { panelRef, dragging, panelStyle, dragHandlers } = useDraggablePanel(isOpen);

  if (!isOpen) return null;

  // The grid arrives already padded with empty cells, so the footer reflects real
  // bag usage instead of a hard-coded carry weight.
  const carry = capacity || {
    used: inventoryItems.filter(Boolean).length,
    total: Math.max(INVENTORY_GRID_SIZE, inventoryItems.length)
  };
  const usedRatio = Math.min(
    100,
    Math.round((carry.used / carry.total) * 100)
  );
  const treasury = splitSilver(coins);

  const positionTooltip = (clientX, clientY, el) => {
    const width = el?.offsetWidth ?? 210;
    const height = el?.offsetHeight ?? 90;
    return {
      x: clamp(clientX + TOOLTIP_OFFSET, window.innerWidth - width - TOOLTIP_EDGE),
      y: clamp(clientY + TOOLTIP_OFFSET, window.innerHeight - height - TOOLTIP_EDGE)
    };
  };

  const handleSlotEnter = (item, event) => {
    setHovered(localizeItem(item, t));
    setTooltipPos(positionTooltip(event.clientX, event.clientY));
  };

  const handlePanelMouseMove = (event) => {
    const el = tooltipRef.current;
    if (!el) return;
    const { x, y } = positionTooltip(event.clientX, event.clientY, el);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  };

  const handleSlotClick = (item) => {
    if (!item) return;
    if (item.slot) {
      onEquipItem?.(item.id);
      return;
    }
    if (item.useSlot != null) {
      onUseItem?.(item.useSlot);
    }
  };

  // Only a worn item dragged off the character paper-doll can be dropped here.
  const handlePanelDragOver = (event) => {
    if (dragKind(event) === "equipment") acceptDrop(event);
  };

  const handlePanelDrop = (event) => {
    const payload = readDragPayload(event);
    if (payload?.kind === "equipment") {
      event.preventDefault();
      onUnequipSlot?.(payload.slot);
    }
  };

  /** Worn item ids — hidden from the grid so the bag only shows carried items. */
  const equippedIds = new Set(
    EQUIPMENT_SLOTS.map((slot) => equipment?.[slot.key]).filter(Boolean)
  );

  const hoveredBonusRows = hovered ? localizeBonusRows(bonusRows(hovered), t) : [];

  return (
    <div id="inventory-modal" className="inventory-dock">
      <div
        className={`wuxia-modal inventory-panel metal-card${dragging ? " is-dragging" : ""}`}
        ref={panelRef}
        style={panelStyle}
        role="dialog"
        aria-modal="false"
        aria-label={t("inventory.title")}
        onMouseMove={handlePanelMouseMove}
        onMouseLeave={() => setHovered(null)}
        onDragOver={handlePanelDragOver}
        onDrop={handlePanelDrop}
      >
        <div className="inv-titlebar" {...dragHandlers}>
          <span className="inv-title">{t("inventory.title")}</span>
          <div className="inv-titlebar-actions">
            <button
              className="inv-icon-btn"
              title={t("inventory.helpTitle")}
              onClick={() => setShowHint((v) => !v)}
            >
              ?
            </button>
            <button
              className="inv-icon-btn close"
              title={t("inventory.closeTitle")}
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>

        {showHint && (
          <div className="inv-hint">
            {t("inventory.hint")}
          </div>
        )}

        <div className="inv-grid">
          {inventoryItems.map((rawItem, index) => {
            const item = rawItem ? localizeItem(rawItem, t) : null;

            // Worn items live on the character sheet, so the bag shows an empty cell.
            if (!item || equippedIds.has(item.id)) {
              return (
                <div
                  className="inv-slot empty"
                  key={`empty-${index}`}
                  aria-hidden="true"
                />
              );
            }

            const equippable = Boolean(item.slot);
            const usable = equippable || item.useSlot != null;
            return (
              <button
                type="button"
                key={item.id}
                className={`inv-slot${usable ? " usable" : ""}`}
                title={item.name}
                draggable={true}
                onDragStart={(event) =>
                  setDragPayload(event, {
                    kind: "inventory",
                    itemId: item.id,
                    slot: item.slot
                  })
                }
                onMouseEnter={(event) => handleSlotEnter(item, event)}
                onClick={() => handleSlotClick(item)}
              >
                <span className={`inv-icon ${item.icon}`} />
                {typeof item.qty === "number" && (
                  <span className="inv-qty">x{item.qty}</span>
                )}
                {usable && (
                  <span className="inv-use-tag">
                    {equippable ? t("inventory.equip") : t("inventory.use")}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="inv-footer">
          <div className="inv-weight">
            <span className="inv-weight-label">{t("inventory.weight")}</span>
            <div className="inv-weight-bar">
              <div
                className="inv-weight-fill"
                style={{ width: `${usedRatio}%` }}
              />
            </div>
            <span className="inv-weight-value">
              {t("inventory.count", { used: carry.used, total: carry.total })}
            </span>
          </div>

          <div className="inv-currency-row">
            <div className="inv-currency kim" title={t("inventory.gold")}>
              <span className="inv-coin-icon kim" />
              <span className="inv-currency-value">{treasury.gold}</span>
            </div>
            <div className="inv-currency bac" title={t("inventory.silver")}>
              <span className="inv-coin-icon" />
              <span className="inv-currency-value">{treasury.silver}</span>
            </div>
            <div className="inv-currency dong" title={t("inventory.copper")}>
              <span className="inv-coin-icon dong" />
              <span className="inv-currency-value">{treasury.copper}</span>
            </div>
          </div>

          <div className="inv-tab-label">{t("inventory.ngucac")}</div>
        </div>
      </div>

      {hovered && (
        <div
          ref={tooltipRef}
          className="inv-tooltip"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
          role="tooltip"
        >
          <div className="inv-tooltip-name">{hovered.name}</div>
          {typeof hovered.qty === "number" && (
            <div className="inv-tooltip-qty">{t("inventory.quantity", { qty: hovered.qty })}</div>
          )}
          <div className="inv-tooltip-desc">{hovered.desc}</div>
          {hoveredBonusRows.length > 0 && (
            <div className="inv-tooltip-bonus">
              {hoveredBonusRows.map((row) => (
                <div key={row.stat}>
                  {row.label} +{row.amount}
                </div>
              ))}
            </div>
          )}
          {hovered.slot && (
            <div className="inv-tooltip-use">
              {t("inventory.equipHint", {
                slot: t(
                  `slots.${hovered.slot}`,
                  undefined,
                  EQUIPMENT_SLOTS.find((slot) => slot.key === hovered.slot)?.label || hovered.slot
                )
              })}
            </div>
          )}
          {hovered.useSlot != null && (
            <div className="inv-tooltip-use">{t("inventory.useHint")}</div>
          )}
        </div>
      )}
    </div>
  );
}
