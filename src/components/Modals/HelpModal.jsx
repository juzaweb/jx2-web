import React from "react";
import { useI18n } from "../../i18n/I18nProvider.jsx";

export function HelpModal({ isOpen, onClose }) {
  const { t } = useI18n();
  if (!isOpen) return null;

  const potionLines = t("help.potions").split("\n");

  return (
    <div id="help-modal" className="overlay">
      <div className="wuxia-modal metal-card help-modal-box">
        <button id="close-help" className="modal-close-x" onClick={onClose}>
          ×
        </button>
        <div className="modal-eyebrow">{t("help.eyebrow")}</div>
        <h2>{t("help.title")}</h2>
        <div className="guide-scroll">
          <p>{t("help.move")}</p>
          <p>{t("help.combat")}</p>
          <p>{t("help.skill")}</p>
          <p>
            {potionLines.map((line, index) => (
              <React.Fragment key={index}>
                {line}
                {index < potionLines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
          <p>{t("help.loot")}</p>
          <p>{t("help.save")}</p>
          <p>{t("help.map")}</p>
          <p>{t("help.pause")}</p>
        </div>
        <button id="resume-btn" className="wuxia-btn-primary" onClick={onClose}>
          {t("help.resume")}
        </button>
      </div>
    </div>
  );
}
