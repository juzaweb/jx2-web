import React, { useEffect, useRef } from "react";
import { bridge, EVENTS } from "../../game/bridge.js";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { LanguageSwitcher } from "../LanguageSwitcher.jsx";

export function MinimapPanel({ audioEnabled, onToggleAudio, onOpenHelp, quest, zoomed = false }) {
  const { t } = useI18n();
  const canvasRef = useRef(null);
  const coordsRef = useRef(null);

  useEffect(() => {
    // Register on mount, and again whenever the game asks (the Phaser scene may
    // have been created after this panel mounted, so its initial registration was
    // emitted before anyone was listening). Re-register on zoom so the radar can
    // switch between the local view and the whole-city view.
    const registerMinimap = () => {
      if (canvasRef.current) {
        bridge.emit(EVENTS.ACTION_REGISTER_MINIMAP, {
          canvas: canvasRef.current,
          coordsEl: coordsRef.current,
          zoomed
        });
      }
    };

    registerMinimap();
    return bridge.on(EVENTS.ACTION_REQUEST_MINIMAP, registerMinimap);
  }, [zoomed]);

  return (
    <section className={`top-right-panel${zoomed ? " is-zoomed" : ""}`} id="minimap-panel">
      <div className={`minimap-frame metal-card${zoomed ? " is-zoomed" : ""}`}>
        <div className="minimap-header">
          <div className="region-title" title={t("minimap.mapTitle")}>
            <span className="realm-channel">{t("minimap.region")}</span>
          </div>
          <div className="minimap-actions">
            <LanguageSwitcher variant="hud" />
            <button
              id="map-help-btn"
              className="mini-btn gold"
              title={t("minimap.helpTitle")}
              onClick={onOpenHelp}
            >
              ?
            </button>
          </div>
        </div>

        <div className="minimap-subinfo">
          <span className="subzone-name">{t("minimap.subzone")}</span>
          <span className="coords" id="coords-text" ref={coordsRef}>
            6400 / 6200
          </span>
        </div>

        <div className="minimap-view" title={t("minimap.zoomTitle")}>
          <canvas
            id="minimap-canvas"
            ref={canvasRef}
            width={zoomed ? 1100 : 220}
            height={zoomed ? 750 : 150}
          ></canvas>
          <div className="minimap-radar-sweep"></div>
        </div>

        {/* Pinned Quest Objective */}
        <div className="quest-tracker" id="quest-tracker">
          <div className="quest-head">{t("minimap.questHead")}</div>
          <div className="quest-body" id="quest-text">
            {quest?.completed ? t("minimap.questDone") : t("minimap.questTodo")}
          </div>
          <div className="quest-progress" id="quest-progress">
            {t("minimap.questSafe")}
          </div>
        </div>
      </div>
    </section>
  );
}
