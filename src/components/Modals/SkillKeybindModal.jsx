import React, { useEffect, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { normalizeKey, setSkillBind } from "../../game/keybinds.js";

/**
 * Rebind the six skill-selection keys. A key only assigns its skill to the
 * right-hand slot; the cast itself is the right mouse button.
 */
export function SkillKeybindModal({ isOpen, skills = [], binds = [], onSave, onClose }) {
  const { t } = useI18n();
  const [listeningSlot, setListeningSlot] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setListeningSlot(null);
      setError("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (listeningSlot === null) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const key = normalizeKey(event);
      if (key === "escape") {
        setListeningSlot(null);
        return;
      }
      if (["shift", "control", "alt", "meta"].includes(key)) return;
      const result = setSkillBind(binds, listeningSlot, key);
      if (!result.ok) {
        setError(t(`skills.keybind.error.${result.error}`, undefined, result.error));
        return;
      }
      onSave(result.binds);
      setListeningSlot(null);
      setError("");
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [listeningSlot, binds, onSave, t]);

  if (!isOpen) return null;

  return (
    <div id="skill-keybind-modal" className="overlay">
      <div className="wuxia-modal metal-card skill-keybind-box">
        <button className="modal-close-x" onClick={onClose}>
          ×
        </button>
        <div className="modal-eyebrow">{t("skills.keybind.eyebrow")}</div>
        <h2>{t("skills.keybind.title")}</h2>
        <p className="skill-keybind-hint">{t("skills.keybind.hint")}</p>
        {error && <div className="jx2-alert-banner error">{error}</div>}

        <div className="skill-keybind-list">
          {skills.map((skill) => (
            <div className="skill-keybind-row" key={skill.id}>
              <span className="skill-keybind-glyph">{skill.glyph}</span>
              <span className="skill-keybind-name">{t(skill.nameKey, undefined, skill.id)}</span>
              <button
                type="button"
                className={`skill-keybind-key ${listeningSlot === skill.slot ? "listening" : ""}`}
                onClick={() => {
                  setError("");
                  setListeningSlot(skill.slot);
                }}
              >
                {listeningSlot === skill.slot
                  ? t("skills.keybind.press")
                  : (binds[skill.slot] || "").toUpperCase()}
              </button>
            </div>
          ))}
        </div>

        <button type="button" className="wuxia-btn-primary" onClick={onClose}>
          {t("common.back")}
        </button>
      </div>
    </div>
  );
}
