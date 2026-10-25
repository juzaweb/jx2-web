import React, { useState } from "react";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { bridge, EVENTS } from "../../game/bridge.js";
import { useDraggablePanel } from "./useDraggablePanel.js";
import "../../styles/gm-modal.css";

const TABS = [
  { key: "level", labelKey: "gm.tabs.level" },
  { key: "potions", labelKey: "gm.tabs.potions" },
  { key: "teleport", labelKey: "gm.tabs.teleport" },
  { key: "utility", labelKey: "gm.tabs.utility" }
];

export function GmModal({ isOpen, onClose, stats = {} }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("level");
  const [showHint, setShowHint] = useState(false);
  const [customLevel, setCustomLevel] = useState(stats.level || 1);
  const [isGodMode, setIsGodMode] = useState(false);
  const [isSpeedBoost, setIsSpeedBoost] = useState(false);
  const { panelRef, dragging, panelStyle, dragHandlers } = useDraggablePanel(isOpen);

  if (!isOpen) return null;

  const emitGmAction = (action, data = {}) => {
    bridge.emit(EVENTS.ACTION_GM, { action, ...data });
  };

  const handleSetLevel = (targetLevel) => {
    const lvl = Math.max(1, Math.min(150, Math.floor(Number(targetLevel) || 1)));
    emitGmAction("set_level", { level: lvl });
  };

  const handleAddLevel = (levels) => {
    emitGmAction("add_level", { levels });
  };

  const handleAddExp = (exp) => {
    emitGmAction("add_exp", { exp });
  };

  const handleHealFull = () => {
    emitGmAction("heal_full");
  };

  const handleAddItems = (items) => {
    emitGmAction("add_items", { items });
  };

  const handleAddCoins = (amount) => {
    emitGmAction("add_coins", { amount });
  };

  const handleTeleport = (mapId, spawn = null) => {
    emitGmAction("teleport", { mapId, spawn });
  };

  const handleToggleGodMode = () => {
    const next = !isGodMode;
    setIsGodMode(next);
    emitGmAction("toggle_god_mode", { enabled: next });
  };

  const handleToggleSpeed = () => {
    const next = !isSpeedBoost;
    setIsSpeedBoost(next);
    emitGmAction("toggle_speed", { enabled: next });
  };

  return (
    <div className="gm-modal-overlay" id="gm-modal">
      <div
        className={`gm-panel${dragging ? " is-dragging" : ""}`}
        ref={panelRef}
        style={panelStyle}
        role="dialog"
        aria-modal="false"
        aria-label={t("gm.title")}
      >
        <div className="gm-titlebar" {...dragHandlers}>
          <div className="gm-title-wrap">
            <span className="gm-title-icon icon-gm-token" />
            <span className="gm-title">{t("gm.title")}</span>
          </div>
          <div className="gm-titlebar-actions">
            <button
              className="gm-icon-btn"
              title="Trợ giúp"
              onClick={() => setShowHint((v) => !v)}
            >
              ?
            </button>
            <button
              className="gm-icon-btn close"
              title="Đóng (Esc)"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>

        {showHint && (
          <div className="gm-hint">
            {t("gm.hint")}
          </div>
        )}

        <div className="gm-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`gm-tab${activeTab === tab.key ? " active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        <div className="gm-body">
          {activeTab === "level" && (
            <>
              <div className="gm-section">
                <span className="gm-section-title">{t("gm.level.quickLevel")}</span>
                <div className="gm-btn-grid">
                  <button className="gm-btn gold" onClick={() => handleSetLevel(10)}>Cấp 10</button>
                  <button className="gm-btn gold" onClick={() => handleSetLevel(50)}>Cấp 50</button>
                  <button className="gm-btn gold" onClick={() => handleSetLevel(73)}>Cấp 73 (Bí Kíp)</button>
                  <button className="gm-btn gold" onClick={() => handleSetLevel(99)}>Cấp 99 (Đại Hiệp)</button>
                  <button className="gm-btn primary" onClick={() => handleSetLevel(150)}>Max Cấp (150)</button>
                </div>
              </div>

              <div className="gm-section">
                <span className="gm-section-title">{t("gm.level.addLevel")}</span>
                <div className="gm-btn-grid">
                  <button className="gm-btn" onClick={() => handleAddLevel(1)}>+1 Cấp</button>
                  <button className="gm-btn" onClick={() => handleAddLevel(5)}>+5 Cấp</button>
                  <button className="gm-btn" onClick={() => handleAddLevel(10)}>+10 Cấp</button>
                </div>
              </div>

              <div className="gm-section">
                <span className="gm-section-title">{t("gm.level.addExp")}</span>
                <div className="gm-btn-grid">
                  <button className="gm-btn" onClick={() => handleAddExp(10000)}>+10.000 EXP</button>
                  <button className="gm-btn" onClick={() => handleAddExp(100000)}>+100.000 EXP</button>
                  <button className="gm-btn" onClick={() => handleAddExp(1000000)}>+1.000.000 EXP</button>
                </div>
              </div>

              <div className="gm-section">
                <span className="gm-section-title">{t("gm.level.customLevel")}</span>
                <div className="gm-input-row">
                  <input
                    type="number"
                    min="1"
                    max="150"
                    className="gm-input"
                    value={customLevel}
                    onChange={(e) => setCustomLevel(e.target.value)}
                    placeholder="1 - 150"
                  />
                  <button
                    className="gm-btn primary"
                    onClick={() => handleSetLevel(customLevel)}
                  >
                    {t("gm.level.setLevelBtn")}
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === "potions" && (
            <>
              <div className="gm-section">
                <span className="gm-section-title">Hồi Phục Sinh Lực & Nội Lực</span>
                <button
                  className="gm-btn primary"
                  style={{ padding: "12px", fontSize: "14px" }}
                  onClick={handleHealFull}
                >
                  ✨ {t("gm.potions.healFull")}
                </button>
              </div>

              <div className="gm-section">
                <span className="gm-section-title">Nhận Dược Phẩm (Vật Phẩm Hồi Máu / Mana)</span>
                <div className="gm-btn-grid">
                  <button
                    className="gm-btn"
                    onClick={() => handleAddItems({ "kim-sang-duoc": 99 })}
                  >
                    💊 {t("gm.potions.receiveHp")}
                  </button>
                  <button
                    className="gm-btn"
                    onClick={() => handleAddItems({ "dai-hoan-dan": 99 })}
                  >
                    🔵 {t("gm.potions.receiveMp")}
                  </button>
                  <button
                    className="gm-btn"
                    onClick={() => handleAddItems({ "nu-nhi-hong": 99 })}
                  >
                    🍶 {t("gm.potions.receiveWine")}
                  </button>
                  <button
                    className="gm-btn gold"
                    onClick={() => handleAddItems({
                      "kim-sang-duoc": 99,
                      "dai-hoan-dan": 99,
                      "nu-nhi-hong": 99
                    })}
                  >
                    🎁 {t("gm.potions.receiveAll")}
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === "teleport" && (
            <>
              <div className="gm-section">
                <span className="gm-section-title">Hồi Phù (Hành Trang)</span>
                <button
                  className="gm-btn gold"
                  onClick={() => handleAddItems({ "hoi-thanh-phu": 99 })}
                >
                  📜 {t("gm.teleport.receiveScroll")}
                </button>
              </div>

              <div className="gm-section">
                <span className="gm-section-title">Dịch Chuyển Bản Đồ Tức Thời</span>
                <div className="gm-btn-grid">
                  <button
                    className="gm-btn primary"
                    onClick={() => handleTeleport("market")}
                  >
                    🏯 {t("gm.teleport.toMarket")}
                  </button>
                  <button
                    className="gm-btn primary"
                    onClick={() => handleTeleport("dong-mon-thanh")}
                  >
                    🌲 {t("gm.teleport.toDongMonThanh")}
                  </button>
                </div>
              </div>

              <div className="gm-section">
                <span className="gm-section-title">Hồi Sinh Tại Chỗ</span>
                <button
                  className="gm-btn"
                  onClick={() => handleGmAction("heal_full")}
                >
                  ⚡ Hồi Phục Toàn Diện
                </button>
              </div>
            </>
          )}

          {activeTab === "utility" && (
            <>
              <div className="gm-section">
                <span className="gm-section-title">Nhận Ngân Lượng</span>
                <div className="gm-btn-grid">
                  <button className="gm-btn" onClick={() => handleAddCoins(1000)}>
                    💰 {t("gm.utility.addCoins1k")}
                  </button>
                  <button className="gm-btn gold" onClick={() => handleAddCoins(10000)}>
                    🪙 {t("gm.utility.addCoins10k")}
                  </button>
                  <button className="gm-btn gold" onClick={() => handleAddCoins(100000)}>
                    💎 {t("gm.utility.addCoins100k")}
                  </button>
                </div>
              </div>

              <div className="gm-section">
                <span className="gm-section-title">Đặc Quyền Vô Địch & Tốc Độ</span>
                <div className="gm-btn-grid">
                  <button
                    className={`gm-btn${isGodMode ? " active-toggle" : ""}`}
                    onClick={handleToggleGodMode}
                  >
                    🛡️ {isGodMode ? t("gm.utility.godModeOn") : t("gm.utility.godModeOff")}
                  </button>
                  <button
                    className={`gm-btn${isSpeedBoost ? " active-toggle" : ""}`}
                    onClick={handleToggleSpeed}
                  >
                    ⚡ {isSpeedBoost ? t("gm.utility.speedBuff") : t("gm.utility.speedNormal")}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="gm-footer">
          <span>Cấp hiện tại: <b>{stats.level || 1}</b> | HP: <b>{stats.hp || 100}/{stats.maxHp || 100}</b></span>
          <span className="gm-status-pill online">ONLINE MULTIPLAYER</span>
        </div>
      </div>
    </div>
  );
}

