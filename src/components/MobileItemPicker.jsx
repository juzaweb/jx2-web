import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { localizeItem } from "../i18n/localize.js";

/**
 * Mobile-only picker: choose which consumable a mobile HP/MP button uses.
 *
 * Every consumable in the catalog is listed. One the bag has run out of stays
 * visible but disabled — the player can see what to restock instead of the
 * button silently disappearing from the list.
 */
export function MobileItemPicker({
  isOpen,
  slotIndex = 0,
  items = [],
  selectedItemId = null,
  onSelect,
  onClear,
  onClose
}) {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div id="mobile-item-picker" className="overlay">
      <div className="wuxia-modal metal-card mobile-picker-box">
        <button type="button" className="modal-close-x" onClick={onClose}>
          ×
        </button>
        <div className="modal-eyebrow">{t("mobileItems.picker.eyebrow")}</div>
        <h2>{t("mobileItems.picker.title", { index: slotIndex + 1 })}</h2>

        <div className="mobile-picker-list">
          {items.length === 0 ? (
            <p className="mobile-picker-empty">{t("mobileItems.picker.none")}</p>
          ) : (
            items.map((entry) => {
              const item = localizeItem(entry, t);
              const qty = typeof entry.qty === "number" ? entry.qty : 0;
              const stocked = qty > 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`mobile-picker-row${item.id === selectedItemId ? " selected" : ""}${
                    stocked ? "" : " locked"
                  }`}
                  disabled={!stocked}
                  onClick={() => onSelect?.(item.id)}
                >
                  <div className={`item-icon ${item.icon} mobile-picker-glyph`} />
                  <span className="mobile-picker-name">{item.name}</span>
                  <span className="mobile-picker-meta">
                    {stocked ? `×${qty}` : t("mobileItems.picker.outOfStock")}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {selectedItemId && (
          <button type="button" className="mobile-picker-clear" onClick={onClear}>
            {t("mobileItems.picker.clear")}
          </button>
        )}

        <button type="button" className="wuxia-btn-primary" onClick={onClose}>
          {t("common.back")}
        </button>
      </div>
    </div>
  );
}
