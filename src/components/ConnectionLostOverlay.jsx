import React, { useEffect, useRef } from "react";
import { SERVER_NAME } from "../game/serverConfig.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import "./connection.css";

/**
 * Hard connection gate. The Phaser scene freezes itself while the socket is
 * down, and this dialog covers the HUD so no panel, shortcut or click can be
 * mistaken for live gameplay. There is deliberately no dismiss action: the only
 * way out is a reconnect.
 * @param {{visible: boolean}} props
 */
export function ConnectionLostOverlay({ visible }) {
  const { t } = useI18n();
  const dialogRef = useRef(null);

  // There is no action to offer, so park the keyboard focus here. Without this,
  // Tab walks into the HUD behind the overlay and Enter presses its buttons.
  useEffect(() => {
    if (visible) dialogRef.current?.focus();
  }, [visible]);

  if (!visible) return null;

  const holdFocus = (event) => {
    if (event.key === "Tab") event.preventDefault();
  };

  return (
    <div
      className="connection-overlay"
      id="connection-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="connection-title"
      aria-describedby="connection-desc"
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={holdFocus}
    >
      <div className="connection-card">
        <div className="connection-seal" aria-hidden="true">
          斷
        </div>
        <p className="connection-eyebrow">{t("connection.eyebrow")}</p>
        <h2 className="connection-title" id="connection-title">
          {t("connection.title")}
        </h2>
        <p className="connection-desc" id="connection-desc">
          {t("connection.desc", { server: SERVER_NAME })}
        </p>
        <div className="connection-spinner" aria-hidden="true" />
        <p className="connection-hint">{t("connection.hint")}</p>
      </div>
    </div>
  );
}
