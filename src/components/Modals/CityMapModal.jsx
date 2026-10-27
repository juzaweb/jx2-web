import React, { useEffect, useRef, useState } from "react";
import { bridge, EVENTS } from "../../game/bridge.js";
import { useI18n } from "../../i18n/I18nProvider.jsx";

export function CityMapModal({ isOpen, onClose }) {
  const { t } = useI18n();
  const canvasRef = useRef(null);
  // The scene announces the active map on boot and on every portal trip.
  const [mapName, setMapName] = useState("");

  useEffect(() => {
    return bridge.on(EVENTS.MAP_CHANGED, (payload) => {
      setMapName(payload?.name || "");
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Register on mount, and again whenever the game asks (the Phaser scene may
    // have been created after this modal mounted).
    const registerMap = () => {
      if (canvasRef.current) {
        bridge.emit(EVENTS.ACTION_REGISTER_CITY_MAP, { canvas: canvasRef.current });
      }
    };

    registerMap();
    const unsubscribe = bridge.on(EVENTS.ACTION_REQUEST_CITY_MAP, registerMap);

    return () => {
      unsubscribe();
      bridge.emit(EVENTS.ACTION_REGISTER_CITY_MAP, { canvas: null });
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="overlay city-map-overlay" onClick={onClose}>
      <div className="wuxia-modal city-map-box" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close-x" onClick={onClose} title={t("common.close")} autoFocus>
          ×
        </button>
        <div className="modal-eyebrow">{t("cityMap.eyebrow")}</div>
        <h2>{mapName ? t("cityMap.titleWithName", { name: mapName }) : t("cityMap.title")}</h2>

        <div className="city-map-view">
          <canvas ref={canvasRef} width={1000} height={1000} className="city-map-canvas" />
        </div>

        <div className="city-map-legend">
          <span><i className="city-map-dot player" />{t("cityMap.player")}</span>
          <span><i className="city-map-dot enemy" />{t("cityMap.enemy")}</span>
          <span><i className="city-map-dot remote" />{t("cityMap.remote")}</span>
          <span><i className="city-map-dot pavilion" />{t("cityMap.pavilion")}</span>
        </div>

        <div className="city-map-hint">{t("cityMap.hint")}</div>
      </div>
    </div>
  );
}
