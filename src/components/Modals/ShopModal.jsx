import React, { useEffect, useState } from "react";
import { PHARMACY_STOCK, getShopItem } from "../../game/shop.js";
import { getItemById } from "../../game/items.js";
import { localizeItem } from "../../i18n/localize.js";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import "./shop.css";

/**
 * Counter panel for the Dược Sư (herb-shop) NPC. React renders the stock and
 * asks the scene to buy; the scene (online: the server) validates silver and
 * adds the item to the character's bag.
 */
export function ShopModal({ isOpen, npcName, coins = 0, result = null, onBuy, onClose }) {
  const { t } = useI18n();
  const [pendingId, setPendingId] = useState(null);

  useEffect(() => {
    if (!isOpen) setPendingId(null);
  }, [isOpen]);

  useEffect(() => {
    setPendingId(null);
  }, [result]);

  if (!isOpen) return null;

  const rows = PHARMACY_STOCK.map((entry) => {
    const item = localizeItem(getItemById(entry.id), t);
    return { ...entry, item };
  });

  const resultMessage = result
    ? result.ok
      ? t("shop.result.ok", { qty: result.qty ?? 1 })
      : t(`shop.result.${result.reason || "unknown"}`, undefined, t("shop.result.unknown"))
    : "";

  return (
    <div className="overlay shop-overlay" id="shop-modal" onClick={onClose}>
      <div
        className="wuxia-modal metal-card shop-box"
        role="dialog"
        aria-modal="true"
        aria-label={t("shop.title")}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close-x" onClick={onClose} title={t("common.close")} autoFocus>
          ×
        </button>

        <div className="modal-eyebrow">{t("shop.eyebrow")}</div>
        <h2>{npcName || t("shop.title")}</h2>
        <p className="shop-greeting">{t("shop.greeting")}</p>

        <div className="shop-balance">
          <span>{t("shop.balance")}</span>
          <b>{coins}</b>
          <span>{t("inventory.silver")}</span>
        </div>

        <div className="shop-list">
          {rows.map(({ id, price, item }) => {
            const affordable = coins >= price;
            const pending = pendingId === id;
            return (
              <div key={id} className="shop-row">
                <span className={`item-icon shop-icon ${item.icon}`} aria-hidden="true" />
                <div className="shop-info">
                  <span className="shop-name">{item.name}</span>
                  <span className="shop-desc">{item.desc}</span>
                </div>
                <div className="shop-action">
                  <span className={`shop-price ${affordable ? "" : "insufficient"}`}>
                    {price} {t("inventory.silver")}
                  </span>
                  <button
                    type="button"
                    className="shop-buy-btn"
                    disabled={!affordable || pending}
                    onClick={() => {
                      setPendingId(id);
                      onBuy?.(id);
                    }}
                  >
                    {pending ? t("common.wait") : t("shop.buy")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {resultMessage && (
          <div className={`shop-result ${result.ok ? "ok" : "error"}`}>{resultMessage}</div>
        )}

        <button type="button" className="wuxia-btn-primary" onClick={onClose}>
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}
