import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";

export function OrientationPrompt({ forceShow = false, onClose }) {
  const { t } = useI18n();
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerHeight > window.innerWidth;
  });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleCheckOrientation = () => {
      const portrait = window.innerHeight > window.innerWidth;
      setIsPortrait(portrait);
      // Reset dismissed state when returning to landscape then rotating back to portrait
      if (!portrait) {
        setDismissed(false);
      }
    };

    handleCheckOrientation();
    window.addEventListener("resize", handleCheckOrientation);
    window.addEventListener("orientationchange", handleCheckOrientation);

    return () => {
      window.removeEventListener("resize", handleCheckOrientation);
      window.removeEventListener("orientationchange", handleCheckOrientation);
    };
  }, []);

  const handleRotate = useCallback(async () => {
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
      if (window.screen?.orientation?.lock) {
        await window.screen.orientation.lock("landscape").catch(() => {});
      }
    } catch {
      // Ignore orientation lock errors on unsupported browsers
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const shouldShow = (isPortrait || forceShow) && (!dismissed || forceShow);

  if (!shouldShow) return null;

  return (
    <div className="orientation-overlay" id="orientation-overlay" data-testid="orientation-overlay">
      <div className="orientation-card">
        {/* Phone graphic matching screenshot style */}
        <div className="orientation-phone-graphic">
          <svg
            width="64"
            height="40"
            viewBox="0 0 64 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="phone-icon-svg"
          >
            {/* Phone Body */}
            <rect x="2" y="2" width="60" height="36" rx="4" fill="#a4c6f5" stroke="#ffffff" strokeWidth="2.5" />
            {/* Screen */}
            <rect x="7" y="5" width="44" height="30" rx="1" fill="#c3ddff" />
            {/* Front Camera dot */}
            <circle cx="5" cy="20" r="1.5" fill="#1b2838" />
            {/* Home/Dock lines on right */}
            <rect x="54" y="10" width="2" height="4" rx="1" fill="#6d94ca" />
            <rect x="54" y="16" width="2" height="4" rx="1" fill="#6d94ca" />
            <rect x="54" y="22" width="2" height="4" rx="1" fill="#6d94ca" />
            <rect x="54" y="28" width="2" height="4" rx="1" fill="#6d94ca" />
          </svg>
        </div>

        {/* Text content matching screenshot */}
        <h2 className="orientation-title">{t("orientation.title")}</h2>
        <p className="orientation-desc">{t("orientation.desc")}</p>

        {/* Action buttons */}
        <div className="orientation-actions">
          <button
            type="button"
            className="orientation-btn-primary"
            onClick={handleRotate}
            data-testid="orientation-rotate-btn"
          >
            {t("orientation.rotateBtn")}
          </button>
          <button
            type="button"
            className="orientation-btn-secondary"
            onClick={handleDismiss}
            data-testid="orientation-dismiss-btn"
          >
            {t("orientation.dismissBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
