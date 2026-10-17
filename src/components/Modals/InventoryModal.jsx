import React, { useRef, useState } from "react";
import {
  QUICK_ITEMS,
  INVENTORY_ITEMS,
  INVENTORY_CAPACITY,
  INVENTORY_TREASURY
} from "../../game/items.js";
import "./inventory.css";

const GRID_COLUMNS = 5;
const TOOLTIP_OFFSET = 16;
const TOOLTIP_EDGE = 12;

const clamp = (value, max) => Math.max(4, Math.min(value, max));

export function InventoryModal({ isOpen, onClose, onUseItem, coins = 0 }) {
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
    setHovered(item);
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
    if (!item || item.useSlot == null) return;
    onUseItem?.(item.useSlot);
  };

  return (
    <div id="inventory-modal" className="inventory-dock">
      <div
        className="wuxia-modal inventory-panel metal-card"
        role="dialog"
        aria-modal="false"
        aria-label="Hành trang"
        onMouseMove={handlePanelMouseMove}
        onMouseLeave={() => setHovered(null)}
      >
        <div className="inv-titlebar">
          <span className="inv-title">Hành trang</span>
          <div className="inv-titlebar-actions">
            <button
              className="inv-icon-btn"
              title="Trợ giúp túi đồ"
              onClick={() => setShowHint((v) => !v)}
            >
              ?
            </button>
            <button
              className="inv-icon-btn close"
              title="Đóng (Esc)"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>

        {showHint && (
          <div className="inv-hint">
            Nhấp vào dược phẩm hoặc phù chú để sử dụng. Di chuột lên vật phẩm
            để xem mô tả. Hạ gục dã thú để nhặt thêm chiến lợi phẩm.
          </div>
        )}

        {/* Top equip / quick-access belt */}
        <div className="inv-quickrow">
          {QUICK_ITEMS.map((item) => (
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
          ))}
          <span className="inv-slot locked" aria-hidden="true">
            <span className="inv-lock-icon" />
          </span>
          <span className="inv-slot locked" aria-hidden="true">
            <span className="inv-lock-icon" />
          </span>
        </div>

        <div
          className="inv-grid"
          style={{ gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)` }}
        >
          {INVENTORY_ITEMS.map((item, index) => {
            if (!item) {
              return (
                <div
                  className="inv-slot empty"
                  key={`empty-${index}`}
                  aria-hidden="true"
                />
              );
            }

            const usable = item.useSlot != null;
            return (
              <button
                type="button"
                key={item.id}
                className={`inv-slot${usable ? " usable" : ""}`}
                title={item.name}
                onMouseEnter={(event) => handleSlotEnter(item, event)}
                onClick={() => handleSlotClick(item)}
              >
                <span className={`inv-icon ${item.icon}`} />
                {typeof item.qty === "number" && (
                  <span className="inv-qty">x{item.qty}</span>
                )}
                {usable && <span className="inv-use-tag">Dùng</span>}
              </button>
            );
          })}
        </div>

        <div className="inv-footer">
          <div className="inv-weight">
            <span className="inv-weight-label">Sức nặng</span>
            <div className="inv-weight-bar">
              <div
                className="inv-weight-fill"
                style={{ width: `${usedRatio}%` }}
              />
            </div>
            <span className="inv-weight-value">
              {INVENTORY_CAPACITY.used}/{INVENTORY_CAPACITY.total}
            </span>
          </div>

          <div className="inv-currency-row">
            <div className="inv-currency bac" title="Bạc">
              <span className="inv-coin-icon" />
              <span className="inv-currency-value">{coins}</span>
            </div>
            <div className="inv-currency kim" title="Kim Nguyên Bảo">
              <span className="inv-coin-icon kim" />
              <span className="inv-currency-value">
                {INVENTORY_TREASURY.kimNguyenBao}
              </span>
            </div>
            <div className="inv-currency tien" title="Tiên Ngọc">
              <span className="inv-coin-icon tien" />
              <span className="inv-currency-value">
                {INVENTORY_TREASURY.tienNgoc}
              </span>
            </div>
          </div>

          <div className="inv-kim-phieu">
            Kim phiếu: <b>{INVENTORY_TREASURY.kimPhieu}</b>
          </div>
          <div className="inv-tab-label">[ Ngự các ]</div>
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
            <div className="inv-tooltip-qty">Số lượng: {hovered.qty}</div>
          )}
          <div className="inv-tooltip-desc">{hovered.desc}</div>
          {hovered.useSlot != null && (
            <div className="inv-tooltip-use">Nhấp để sử dụng</div>
          )}
        </div>
      )}
    </div>
  );
}
