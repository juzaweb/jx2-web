import React from "react";
import { npcDialogView } from "../../game/questView.js";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import "./quests.css";

/** Pick the dialogue line for the current state without a nested ternary. */
function dialogLineKey(view) {
  if (view.targetLineKey) return view.targetLineKey;
  if (view.available) return view.available.introKey;
  if (view.turnIn) return view.turnIn.turnInKey;
  if (view.isTurnInNpc && view.active) return view.active.progressKey;
  return "quests.dialog.idle";
}

/**
 * Dialog shown when the hero talks to a NPC. The server owns every quest
 * transition; this panel only offers the actions that are currently legal and
 * lets the player pick one.
 */
export function NpcDialogModal({
  isOpen,
  npc,
  state,
  level = 1,
  onAccept,
  onTalk,
  onTurnIn,
  onOpenShop,
  onClose
}) {
  const { t } = useI18n();
  if (!isOpen || !npc) return null;

  const view = npcDialogView(state || {}, level, npc.id);
  const quest = view.targetLineKey ? view.active : view.available || view.turnIn;
  const line = t(dialogLineKey(view), undefined, t("quests.dialog.idle"));

  return (
    <div className="overlay quest-overlay" id="npc-dialog-modal" onClick={onClose}>
      <div
        className="wuxia-modal metal-card npc-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={npc.name}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close-x" onClick={onClose} title={t("common.close")} autoFocus>
          ×
        </button>

        <div className="modal-eyebrow">{t("quests.dialog.eyebrow")}</div>
        <h2>{npc.name}</h2>
        <p className="npc-dialog-line">{line}</p>

        {quest?.titleKey && (
          <div className="npc-dialog-quest">
            <span className="npc-dialog-quest-title">{t(quest.titleKey)}</span>
            {view.available && (
              <span className="npc-dialog-quest-meta">
                {t("quests.ui.levelReq", { level: quest.minLevel })}
              </span>
            )}
          </div>
        )}

        <div className="npc-dialog-actions">
          {view.available && (
            <button
              type="button"
              className="wuxia-btn-primary"
              onClick={() => onAccept?.(view.available.id)}
            >
              {t("quests.ui.accept")}
            </button>
          )}
          {view.targetLineKey && (
            <button
              type="button"
              className="wuxia-btn-primary"
              onClick={() => onTalk?.(npc.id)}
            >
              {t("quests.ui.heard")}
            </button>
          )}
          {view.turnIn && (
            <button
              type="button"
              className="wuxia-btn-primary"
              onClick={() => onTurnIn?.(view.turnIn.id)}
            >
              {t("quests.ui.turnIn")}
            </button>
          )}
          {npc.shop && (
            <button type="button" className="wuxia-btn-secondary" onClick={() => onOpenShop?.()}>
              {t("quests.ui.openShop")}
            </button>
          )}
          <button type="button" className="wuxia-btn-secondary" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
