import React from "react";
import { useI18n } from "../../i18n/I18nProvider.jsx";

/**
 * Top-center Target Vitals HUD frame showing the active combat target's name,
 * level, HP percentage bar, and kind (Monster / Boss / Duelist).
 *
 * @param {{
 *   target: {
 *     id: number|string,
 *     name: string,
 *     level?: number,
 *     hp: number,
 *     maxHp: number,
 *     kind?: "monster"|"player",
 *     isBoss?: boolean
 *   }|null,
 *   onClear?: () => void
 * }} props
 */
export function TargetVitals({ target, onClear }) {
  const { t } = useI18n();

  if (!target) return null;

  const maxHp = Math.max(1, Number(target.maxHp) || 100);
  const hp = Math.max(0, Math.min(maxHp, Number(target.hp) ?? maxHp));
  const hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));

  const kindLabel = target.isBoss
    ? t("hud.targetBoss")
    : target.kind === "player"
      ? t("hud.targetDuel")
      : t("hud.targetMonster");

  return (
    <section className="top-center-panel" id="target-hud" aria-label={t("hud.targetTitle")}>
      <div
        className={`target-bracket metal-card${target.isBoss ? " is-boss" : ""}${
          target.kind === "player" ? " is-pvp" : ""
        }`}
      >
        <div className="target-level-box" title={t("hud.levelTitle")}>
          {target.level || 1}
        </div>
        <div className="target-info-col">
          <div className="target-meta-row">
            <span className="target-name" title={target.name}>
              {target.name}
            </span>
            <span className="target-kind-badge">{kindLabel}</span>
            <button
              type="button"
              className="target-close-btn"
              title={t("hud.targetDeselect")}
              aria-label={t("hud.targetDeselect")}
              onClick={onClear}
            >
              ×
            </button>
          </div>
          <div className="vital-bar-wrap target-hp-wrap" title={t("hud.hpTitle")}>
            <div className="vital-bar hp target-hp">
              <i id="target-hp-bar" style={{ width: `${hpPercent}%` }}></i>
            </div>
            <span className="bar-caption" id="target-hp-text">
              {hp} / {maxHp} ({hpPercent.toFixed(0)}%)
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

