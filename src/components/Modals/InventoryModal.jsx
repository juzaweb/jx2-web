import React, { useRef, useState } from "react";
import {
  QUICK_ITEMS,
  INVENTORY_ITEMS,
  INVENTORY_CAPACITY,
  INVENTORY_TREASURY,
  getItemById
} from "../../game/items.js";
import {
  EQUIPMENT_SLOTS,
  BONUS_LABELS,
  bonusRows,
  deriveEquipmentBonuses
} from "../../game/equipment.js";
import "./inventory.css";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { localizeItem, localizeBonusRows } from "../../i18n/localize.js";

const GRID_COLUMNS = 5;
const TOOLTIP_OFFSET = 16;
const TOOLTIP_EDGE = 12;

const clamp = (value, max) => Math.max(4, Math.min(value, max));

export function InventoryModal({
  isOpen,
  onClose,
  onUseItem,
  onEquipItem,
  onUnequipSlot,
  equipment = {},
  coins = 0,
  quickItems = QUICK_ITEMS,
  inventoryItems = INVENTORY_ITEMS
}) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [showHint, setShowHint] = useState(false);
  const tooltipRef = useRef(null);

  if (!isOpen) return null;

  const usedRatio = Math.min(
    100,
    Math.round((INVENTORY_CAPACITY.used / INVENTORY_CAPACITY.total) * 100)
  );

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

  const handleUnequip = (slotKey) => {
    onUnequipSlot?.(slotKey);
  };

  const equippedItems = EQUIPMENT_SLOTS.map((slot) => ({
    ...slot,
    item: equipment?.[slot.key] ? getItemById(equipment[slot.key]) : null
  }));

  /** Item ids currently worn, so the grid can mark them instead of re-equipping. */
  const equippedIds = new Set(
    EQUIPMENT_SLOTS.map((slot) => equipment?.[slot.key]).filter(Boolean)
  );

  const bonusSummary = localizeBonusRows(
    Object.entries(deriveEquipmentBonuses(equipment))
      .filter(([, amount]) => amount !== 0)
      .map(([stat, amount]) => ({ stat, label: BONUS_LABELS[stat] || stat, amount })),
    t
  );

  const hoveredBonusRows = hovered ? localizeBonusRows(bonusRows(hovered), t) : [];

  return (
    <div id="inventory-modal" className="inventory-dock">
      <div
        className="wuxia-modal inventory-panel metal-card"
        role="dialog"
        aria-modal="false"
        aria-label={t("inventory.title")}
        onMouseMove={handlePanelMouseMove}
        onMouseLeave={() => setHovered(null)}
      >
        <div className="inv-titlebar">
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

        {/* Top equip / quick-access belt */}
        <div className="inv-quickrow">
          {quickItems.map((rawItem) => {
            const item = localizeItem(rawItem, t);
            return (
              <button
                type="button"
                key={item.id}
                className="inv-slot usable"
                title={item.name}
                onMouseEnter={(event) => handleSlotEnter(item, event)}
                onClick={() => handleSlotClick(item)}
              >
                <span className={`inv-icon ${item.icon}`} />
                <span className="inv-qty">x{item.qty}</span>
              </button>
            );
          })}
          <span className="inv-slot locked" aria-hidden="true">
            <span className="inv-lock-icon" />
          </span>
          <span className="inv-slot locked" aria-hidden="true">
            <span className="inv-lock-icon" />
          </span>
        </div>

        {/* Equipment slots: click a filled slot to take the item off */}
        <div className="inv-equiprow">
          {equippedItems.map(({ key, label, item: rawItem }) => {
            const labelText = t(`slots.${key}`, undefined, label);
            const item = localizeItem(rawItem, t);
            return (
              <button
                type="button"
                key={key}
                className={`inv-slot equip${item ? " filled" : ""}`}
                title={
                  item
                    ? t("inventory.equipTitle", { label: labelText, name: item.name })
                    : labelText
                }
                onMouseEnter={(event) =>
                  item ? handleSlotEnter(item, event) : setHovered(null)
                }
                onClick={() => item && handleUnequip(key)}
              >
                {item ? (
                  <span className={`inv-icon ${item.icon}`} />
                ) : (
                  <span className="inv-equip-label">{labelText}</span>
                )}
              </button>
            );
          })}
        </div>

        {bonusSummary.length > 0 && (
          <div className="inv-equip-bonus">
            {bonusSummary.map((row) => (
              <span key={row.stat} className="inv-equip-bonus-item">
                {row.label} <b>+{row.amount}</b>
              </span>
            ))}
          </div>
        )}

        <div
          className="inv-grid"
          style={{ gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)` }}
        >
          {inventoryItems.map((rawItem, index) => {
            if (!rawItem) {
              return (
                <div
                  className="inv-slot empty"
                  key={`empty-${index}`}
                  aria-hidden="true"
                />
              );
            }

            const item = localizeItem(rawItem, t);
            const equippable = Boolean(item.slot);
            const equipped = equippable && equippedIds.has(item.id);
            const usable = equippable || item.useSlot != null;
            return (
              <button
                type="button"
                key={item.id}
                className={`inv-slot${usable ? " usable" : ""}${equipped ? " equipped" : ""}`}
                title={item.name}
                onMouseEnter={(event) => handleSlotEnter(item, event)}
                onClick={() => !equipped && handleSlotClick(item)}
              >
                <span className={`inv-icon ${item.icon}`} />
                {typeof item.qty === "number" && (
                  <span className="inv-qty">x{item.qty}</span>
                )}
                {usable && (
                  <span className="inv-use-tag">
                    {equippable ? (equipped ? t("inventory.equipped") : t("inventory.equip")) : t("inventory.use")}
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
              {t("inventory.count", { used: INVENTORY_CAPACITY.used, total: INVENTORY_CAPACITY.total })}
            </span>
          </div>

          <div className="inv-currency-row">
            <div className="inv-currency bac" title={t("inventory.silver")}>
              <span className="inv-coin-icon" />
              <span className="inv-currency-value">{coins}</span>
            </div>
            <div className="inv-currency kim" title={t("inventory.gold")}>
              <span className="inv-coin-icon kim" />
              <span className="inv-currency-value">
                {INVENTORY_TREASURY.kimNguyenBao}
              </span>
            </div>
            <div className="inv-currency tien" title={t("inventory.jade")}>
              <span className="inv-coin-icon tien" />
              <span className="inv-currency-value">
                {INVENTORY_TREASURY.tienNgoc}
              </span>
            </div>
          </div>

          <div className="inv-kim-phieu">
            {t("inventory.kimPhieu")} <b>{INVENTORY_TREASURY.kimPhieu}</b>
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
