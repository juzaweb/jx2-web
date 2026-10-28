import React, { useEffect, useRef, useState } from "react";
import { bridge, EVENTS } from "../../game/bridge.js";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { LanguageSwitcher } from "../LanguageSwitcher.jsx";

export function MinimapPanel({ onOpenHelp, onOpenQuestLog, quest, zoomed = false, collapsed = false, onClose, onOpen }) {
  const { t } = useI18n();
  const canvasRef = useRef(null);
  const coordsRef = useRef(null);
  // The scene announces the active map on boot and on every portal trip. Keep the
  // id so a language switch re-renders the localized name instead of freezing the
  // Vietnamese fallback the payload carried.
  const [mapId, setMapId] = useState("");
  const [mapName, setMapName] = useState("");

  useEffect(() => {
    return bridge.on(EVENTS.MAP_CHANGED, (payload) => {
      setMapId(payload?.mapId || "");
      setMapName(payload?.name || "");
    });
  }, []);

  useEffect(() => {
    if (collapsed) return undefined;
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
  }, [zoomed, collapsed]);

  // Minimized state keeps a small tab on screen so the map can be reopened.
  if (collapsed) {
    return (
      <section className="top-right-panel" id="minimap-restore-panel">
        <button
          type="button"
          id="minimap-restore-btn"
          className="panel-restore-btn"
          title={t("minimap.restore")}
          aria-label={t("minimap.restore")}
          onClick={onOpen}
        >
          🗺
        </button>
        <button
          type="button"
          id="minimap-quest-restore-btn"
          className="panel-restore-btn"
          title={t("minimap.questLogTitle")}
          aria-label={t("minimap.questLogTitle")}
          onClick={onOpenQuestLog}
        >
          📜
        </button>
      </section>
    );
  }

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
              id="map-minimize-btn"
              className="mini-btn"
              title={t("minimap.minimize")}
              aria-label={t("minimap.minimize")}
              onClick={onClose}
            >
              –
            </button>
            <button
              id="map-help-btn"
              className="mini-btn gold"
              title={t("minimap.helpTitle")}
              onClick={onOpenHelp}
            >
              ?
            </button>
            <button
              id="map-quest-btn"
              className="mini-btn"
              title={t("minimap.questLogTitle")}
              aria-label={t("minimap.questLogTitle")}
              onClick={onOpenQuestLog}
            >
              📜
            </button>
          </div>
        </div>

        <div className="minimap-subinfo">
          <span className="subzone-name">
            {mapId ? t(`maps.${mapId}`, undefined, mapName) : t("minimap.subzone")}
          </span>
          <span className="coords" id="coords-text" ref={coordsRef}>
            6400 / 6200
          </span>
        </div>

        <div className="minimap-view" title={t("minimap.zoomTitle")}>
          <canvas
            id="minimap-canvas"
            ref={canvasRef}
            width={zoomed ? 1000 : 220}
            height={zoomed ? 682 : 150}
          ></canvas>
          <div className="minimap-radar-sweep"></div>
        </div>

        {/* Pinned quest objective. It follows the active newbie quest on every
            map, so a hunting ground shows the same step the city does. */}
        <div className="quest-tracker" id="quest-tracker">
          <div className="quest-head">
            {quest?.titleKey ? t(quest.titleKey) : t("minimap.questHead")}
          </div>
          <div className="quest-body" id="quest-text">
            {quest?.labelKey
              ? `${t(quest.labelKey)} (${quest.done}/${quest.total})`
              : t("minimap.questIdle")}
          </div>
          <div className="quest-progress" id="quest-progress">
            {quest?.ready ? t("minimap.questReady") : t("minimap.questHint")}
            {mapId === "market" && ` • ${t("minimap.questSafe")}`}
          </div>
        </div>
      </div>
    </section>
  );
}
