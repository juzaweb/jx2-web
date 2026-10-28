import React, { useEffect, useRef, useState } from "react";
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
import { readDragPayload, dragKind, acceptDrop } from "./dragItem.js";
import { beginItemDrag, cancelItemDrag, didItemDragJustEnd } from "./pointerItemDrag.js";
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
  onAssignQuickSlot,
  onSwitchToCharacter,
  equipment = {},
  coins = 0,
  inventoryItems = EMPTY_GRID,
  capacity = null
}) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [showHint, setShowHint] = useState(false);
  const tooltipRef = useRef(null);
  const { panelRef, dragging, panelStyle, dragHandlers } = useDraggablePanel(isOpen);

  // Closing the bag mid-drag must not leave a ghost icon or window listeners behind.
  useEffect(() => {
    if (!isOpen) {
      cancelItemDrag();
      setSelectedItem(null);
      setHovered(null);
    }
  }, [isOpen]);

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

  const handleSlotClick = (event, item) => {
    if (!item) return;
    // The pointer drag ends with a click on the item it moved; do not also use it.
    if (didItemDragJustEnd(event.currentTarget)) return;

    const isTouch = typeof window !== "undefined" && (
      window.innerWidth <= 960 ||
      window.innerHeight <= 500 ||
      ("ontouchstart" in window) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)
    );

    if (isTouch) {
      setSelectedItem(localizeItem(item, t));
      return;
    }

    if (item.slot) {
      onEquipItem?.(item.id);
      return;
    }
    if (item.useSlot != null || item.skillId) {
      // Use this exact item; the hotbar mapping may point somewhere else.
      onUseItem?.(item.id);
    }
  };

  /**
   * Drag a bag item with pointer events: onto the numbered bar to bind a quick
   * slot, or onto its matching paper-doll slot to equip it.
   */
  const handleSlotPointerDown = (event, item) => {
    beginItemDrag({
      event,
      payload: { kind: "inventory", itemId: item.id, slot: item.slot },
      ghostIcon: item.icon,
      onDrop: (zone) => {
        if (!zone) return;
        if (zone.type === "hotbar") {
          onAssignQuickSlot?.(zone.slot, item.id);
        } else if (zone.type === "equip" && item.slot && zone.slot === item.slot) {
          onEquipItem?.(item.id);
        }
      }
    });
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
  const selectedBonusRows = selectedItem ? localizeBonusRows(bonusRows(selectedItem), t) : [];

  const handleDockClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };

  return (
    <div id="inventory-modal" className="inventory-dock" onClick={handleDockClick}>
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
              type="button"
              className="inv-icon-btn"
              title={t("inventory.helpTitle")}
              onClick={() => setShowHint((v) => !v)}
            >
              ?
            </button>
            <button
              type="button"
              className="inv-icon-btn close"
              title={t("inventory.closeTitle")}
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>

        <div className="inv-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected="true"
            className="inv-tab active"
          >
            {t("inventory.title")}
          </button>
          {onSwitchToCharacter && (
            <button
              type="button"
              role="tab"
              aria-selected="false"
              className="inv-tab"
              onClick={onSwitchToCharacter}
            >
              {t("inventory.tabCharacter")}
            </button>
          )}
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
            const usable = equippable || item.useSlot != null || Boolean(item.skillId);
            return (
              <button
                type="button"
                key={item.id}
                className={`inv-slot${usable ? " usable" : ""}`}
                title={item.name}
                onPointerDown={(event) => handleSlotPointerDown(event, item)}
                onMouseEnter={(event) => handleSlotEnter(item, event)}
                onClick={(event) => handleSlotClick(event, item)}
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
          {(hovered.useSlot != null || hovered.skillId) && (
            <div className="inv-tooltip-use">{t("inventory.useHint")}</div>
          )}
        </div>
      )}

      {selectedItem && (
        <div className="item-detail-overlay" onClick={() => setSelectedItem(null)}>
          <div
            className="item-detail-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={selectedItem.name}
          >
            <div className="item-detail-head">
              <span className={`item-detail-icon inv-icon ${selectedItem.icon}`} />
              <div className="item-detail-title-group">
                <div className="item-detail-name">{selectedItem.name}</div>
                {typeof selectedItem.qty === "number" && (
                  <div className="item-detail-qty">
                    {t("inventory.quantity", { qty: selectedItem.qty })}
                  </div>
                )}
                {selectedItem.slot && (
                  <div className="item-detail-slot">
                    {t("inventory.equipHint", {
                      slot: t(
                        `slots.${selectedItem.slot}`,
                        undefined,
                        EQUIPMENT_SLOTS.find((s) => s.key === selectedItem.slot)?.label || selectedItem.slot
                      )
                    })}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="item-detail-close-btn"
                onClick={() => setSelectedItem(null)}
                title={t("common.close")}
              >
                ×
              </button>
            </div>

            {selectedItem.desc && (
              <div className="item-detail-desc">{selectedItem.desc}</div>
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
              {selectedItem.slot && (
                <button
                  type="button"
                  className="item-detail-action-btn equip"
                  onClick={() => {
                    onEquipItem?.(selectedItem.id);
                    setSelectedItem(null);
                  }}
                >
                  {t("inventory.equip")}
                </button>
              )}
              {(selectedItem.useSlot != null || selectedItem.skillId) && (
                <button
                  type="button"
                  className="item-detail-action-btn use"
                  onClick={() => {
                    onUseItem?.(selectedItem.id);
                    setSelectedItem(null);
                  }}
                >
                  {t("inventory.use")}
                </button>
              )}
              <button
                type="button"
                className="item-detail-action-btn cancel"
                onClick={() => setSelectedItem(null)}
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
