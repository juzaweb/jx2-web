import React, { useEffect, useRef } from "react";
import { SERVER_NAME } from "../game/serverConfig.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import "./connection.css";

/**
 * Hard connection gate. The Phaser scene freezes itself while the socket is
 * down, and this dialog covers the HUD so no panel, shortcut or click can be
 * mistaken for live gameplay.
 *
 * A plain network drop recovers on its own, but a rejected session or a socket
 * taken over by another device never will. Those cases expose an explicit
 * "log in again" action so the gate can never become a permanent dead end.
 * @param {{
 *   visible: boolean,
 *   issue?: "auth"|"character"|"superseded"|null,
 *   onRetry?: () => void,
 *   onRelogin?: () => void
 * }} props
 */
export function ConnectionLostOverlay({ visible, issue = null, onRetry, onRelogin }) {
  const { t } = useI18n();
  const dialogRef = useRef(null);

  // Park the keyboard focus here. Without this, Tab walks into the HUD behind the
  // overlay and Enter presses its buttons.
  // Re-focus when the actions change (e.g. retry disappears for a terminal
  // issue), otherwise focus falls back to the document body.
  useEffect(() => {
    if (visible) dialogRef.current?.focus();
  }, [visible, issue]);

  if (!visible) return null;

  // A terminal issue (invalid session, character gone, another device took over)
  // cannot be fixed by reconnecting with the same credentials.
  const isTerminal = Boolean(issue);
  const networkDescription = t("connection.desc", { server: SERVER_NAME });
  const description = isTerminal
    ? t(`connection.reasons.${issue}`, undefined, networkDescription)
    : networkDescription;

  // Keep Tab inside the dialog while still allowing it to reach the actions.
  const handleKeyDown = (event) => {
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll("button:not([disabled])");
    if (!focusable || focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
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
      onKeyDown={handleKeyDown}
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
          {description}
        </p>
        {isTerminal ? null : <div className="connection-spinner" aria-hidden="true" />}
        {isTerminal ? null : <p className="connection-hint">{t("connection.hint")}</p>}
        <div className="connection-actions">
          {isTerminal ? null : (
            <button
              type="button"
              className="connection-button"
              onClick={onRetry}
              autoFocus
            >
              {t("connection.retry")}
            </button>
          )}
          {onRelogin ? (
            <button
              type="button"
              className={`connection-button${isTerminal ? "" : " connection-button--secondary"}`}
              onClick={onRelogin}
              autoFocus={isTerminal}
            >
              {t("connection.relogin")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
