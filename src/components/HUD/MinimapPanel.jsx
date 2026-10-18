import React, { useEffect, useRef } from "react";
import { bridge, EVENTS } from "../../game/bridge.js";

export function MinimapPanel({ audioEnabled, onToggleAudio, onOpenHelp, quest }) {
  const canvasRef = useRef(null);
  const coordsRef = useRef(null);

  useEffect(() => {
    // Register on mount, and again whenever the game asks (the Phaser scene may
    // have been created after this panel mounted, so its initial registration was
    // emitted before anyone was listening).
    const registerMinimap = () => {
      if (canvasRef.current) {
        bridge.emit(EVENTS.ACTION_REGISTER_MINIMAP, {
          canvas: canvasRef.current,
          coordsEl: coordsRef.current
        });
      }
    };

    registerMinimap();
    return bridge.on(EVENTS.ACTION_REQUEST_MINIMAP, registerMinimap);
  }, []);

  return (
    <section className="top-right-panel" id="minimap-panel">
      <div className="minimap-frame metal-card">
        <div className="minimap-header">
          <div className="region-title">
            <span className="realm-channel">Tàng Long (Máy chủ 1)</span>
          </div>
          <div className="minimap-actions">
            <button
              id="map-help-btn"
              className="mini-btn gold"
              title="Cẩm nang tân thủ"
              onClick={onOpenHelp}
            >
              ?
            </button>
          </div>
        </div>

        <div className="minimap-subinfo">
          <span className="subzone-name">Biện Kinh</span>
          <span className="coords" id="coords-text" ref={coordsRef}>
            640 / 620
          </span>
        </div>

        <div className="minimap-view">
          <canvas
            id="minimap-canvas"
            ref={canvasRef}
            width={168}
            height={116}
          ></canvas>
          <div className="minimap-radar-sweep"></div>
        </div>

        {/* Pinned Quest Objective */}
        <div className="quest-tracker" id="quest-tracker">
          <div className="quest-head">✦ KHÁM PHÁ BIỆN KINH</div>
          <div className="quest-body" id="quest-text">
            {quest?.completed ? "Đã dạo quanh Biện Kinh" : "Thành thị phồn hoa"}
          </div>
          <div className="quest-progress" id="quest-progress">
            Khu an toàn • Không có quái
          </div>
        </div>
      </div>
    </section>
  );
}
