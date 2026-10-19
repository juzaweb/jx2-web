import React from "react";
import { useI18n } from "../../i18n/I18nProvider.jsx";

export function PlayerVitals({ stats, playerName, onLogout }) {
  const { t } = useI18n();
  const hpPercent = Math.max(0, Math.min(100, (stats.hp / stats.maxHp) * 100));
  const mpPercent = Math.max(0, Math.min(100, (stats.mp / stats.maxMp) * 100));
  const staPercent = Math.max(0, Math.min(100, ((stats.sta || 100) / (stats.maxSta || 100)) * 100));
  const expPercentNum = ((stats.exp / stats.nextExp) * 100);
  const expPercent = Math.max(0, Math.min(100, expPercentNum)).toFixed(2);

  return (
    <section className="top-left-panel" id="player-hud">
      {playerName && (
        <div
          className="player-meta-info"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "4px",
            background: "rgba(10, 20, 18, 0.75)",
            padding: "2px 8px",
            borderRadius: "3px",
            border: "1px solid rgba(110, 231, 183, 0.25)",
            width: "fit-content"
          }}
        >
          <span
            className="player-name"
            style={{
              color: "#ffd84d",
              fontWeight: "700",
              fontSize: "12px",
              textShadow: "0 1px 2px #000"
            }}
          >
            ⚔ {playerName}
          </span>
        </div>
      )}
      <div className="status-bracket">
        <div className="level-box" id="level-badge" title={t("hud.levelTitle")}>
          {stats.level}
        </div>
        <div className="bars-container">
          {/* EXP Bar (Thin top bar) */}
          <div className="vital-bar-wrap exp-wrap" title={t("hud.expTitle")}>
            <div className="vital-bar exp">
              <i id="exp-bar" style={{ width: `${expPercent}%` }}></i>
            </div>
            <span className="bar-caption" id="exp-text">
              {stats.exp} / {stats.nextExp} ({expPercent}%)
            </span>
          </div>

          {/* HP Bar (Major red bar) */}
          <div className="vital-bar-wrap hp-wrap" title={t("hud.hpTitle")}>
            <div className="vital-bar hp">
              <i id="hp-bar" style={{ width: `${hpPercent}%` }}></i>
            </div>
            <span className="bar-caption" id="hp-text">
              {stats.hp} / {stats.maxHp}
            </span>
          </div>

          {/* Sub Bars: MP (Nội lực) & Stamina (Thể lực) */}
          <div className="sub-bars-row">
            <div className="vital-bar-wrap mp-wrap" title={t("hud.mpTitle")}>
              <div className="vital-bar mp">
                <i id="mp-bar" style={{ width: `${mpPercent}%` }}></i>
              </div>
              <span className="bar-caption" id="mp-text">
                {stats.mp} / {stats.maxMp}
              </span>
            </div>
            <div className="vital-bar-wrap sta-wrap" title={t("hud.staTitle")}>
              <div className="vital-bar sta">
                <i id="sta-bar" style={{ width: `${staPercent}%` }}></i>
              </div>
              <span className="bar-caption" id="sta-text">
                {stats.sta || 100} / {stats.maxSta || 100}
              </span>
            </div>
          </div>
        </div>

        {/* Buff / Martial Aura Slot */}
        <div
          className="buff-slot"
          id="buff-slot"
          title={t("hud.buffTitle")}
        >
          <div className="buff-icon">氣</div>
          <span className="buff-timer">2-28</span>
        </div>
      </div>
    </section>
  );
}
