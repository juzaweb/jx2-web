import React from "react";
import { questLogRows } from "../../game/questView.js";
import { getItemById } from "../../game/items.js";
import { localizeItem } from "../../i18n/localize.js";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import "./quests.css";

/** One-line reward summary for a quest row. */
function rewardSummary(quest, t) {
  const parts = [];
  if (quest.reward?.exp) parts.push(t("quests.ui.exp", { exp: quest.reward.exp }));
  if (quest.reward?.bac) parts.push(t("quests.ui.bac", { bac: quest.reward.bac }));
  for (const entry of quest.reward?.items || []) {
    const item = localizeItem(getItemById(entry.id), t);
    parts.push(`${item?.name || entry.id} ×${entry.qty}`);
  }
  return parts.join(" • ");
}

/** Status chip label for one chain row. */
function statusLabel(row, t) {
  if (row.status === "done") return t("quests.status.done");
  if (row.status === "ready") return t("quests.status.ready");
  if (row.status === "active") return t("quests.status.active");
  if (row.lockReason === "chain") return t("quests.status.chain");
  if (row.lockReason === "level") {
    return t("quests.status.level", { level: row.quest.minLevel });
  }
  return t("quests.status.available");
}

/**
 * Nhật ký nhiệm vụ (J). Shows the whole newbie chain, the next objective and the
 * reward of every step so the player never has to guess where to go.
 */
export function QuestLogModal({ isOpen, state, level = 1, onClose }) {
  const { t } = useI18n();
  if (!isOpen) return null;

  const rows = questLogRows(state || {}, level);

  return (
    <div className="overlay quest-overlay" id="quest-log-modal" onClick={onClose}>
      <div
        className="wuxia-modal metal-card quest-log"
        role="dialog"
        aria-modal="true"
        aria-label={t("quests.log.title")}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close-x" onClick={onClose} title={t("common.close")} autoFocus>
          ×
        </button>
        <div className="modal-eyebrow">{t("quests.log.eyebrow")}</div>
        <h2>{t("quests.log.title")}</h2>
        <p className="quest-log-hint">{t("quests.log.hint")}</p>

        <div className="quest-log-list">
          {rows.map((row) => (
            <div key={row.quest.id} className={`quest-log-row status-${row.status}`}>
              <div className="quest-log-head">
                <span className="quest-log-index">{row.quest.order}</span>
                <span className="quest-log-title">{t(row.quest.titleKey)}</span>
                <span className={`quest-log-chip chip-${row.status}`}>{statusLabel(row, t)}</span>
              </div>

              <ul className="quest-log-objectives">
                {row.objectives.map((objective) => (
                  <li key={objective.labelKey}>
                    <span>{t(objective.labelKey)}</span>
                    <b>
                      {objective.done}/{objective.total}
                    </b>
                  </li>
                ))}
              </ul>

              <div className="quest-log-reward">{rewardSummary(row.quest, t)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
