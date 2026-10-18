import React, { useState } from "react";
import { deriveCharacterSheet } from "../../game/characterStats.js";
import "../../styles/character.css";

/** Paper-doll slots. Presentation only — equipment is not simulated yet. */
const EQUIPMENT_SLOTS = {
  left: [
    { key: "helm", label: "Mũ" },
    { key: "armor", label: "Áo giáp" },
    { key: "belt", label: "Đai lưng" },
    { key: "gloves", label: "Găng tay" },
    { key: "bracers", label: "Hộ uyển" },
    { key: "weapon", label: "Vũ khí" }
  ],
  right: [
    { key: "necklace", label: "Dây chuyền" },
    { key: "ring1", label: "Nhẫn" },
    { key: "ring2", label: "Nhẫn" },
    { key: "jade", label: "Ngọc bội" },
    { key: "amulet", label: "Bùa hộ mệnh" },
    { key: "boots", label: "Giày" }
  ]
};

const TABS = [
  { key: "equip", label: "Trang bị", enabled: true },
  { key: "news", label: "Tin tức", enabled: false },
  { key: "pet", label: "Thủ nuôi", enabled: false }
];

export function CharacterModal({ isOpen, onClose, stats, playerName = "" }) {
  const [showHint, setShowHint] = useState(false);

  if (!isOpen) return null;

  const sheet = deriveCharacterSheet(stats);

  const renderSlot = (slot) => (
    <div className="equip-slot" key={slot.key} title={`${slot.label} (chưa trang bị)`} />
  );

  return (
    <div className="char-modal-overlay" id="character-modal">
      <div
        className="wuxia-modal char-panel metal-card"
        role="dialog"
        aria-modal="false"
        aria-label="Nhân vật"
      >
        <div className="char-titlebar">
          <span className="char-title">Nhân vật</span>
          <div className="char-titlebar-actions">
            <button
              className="char-icon-btn"
              title="Trợ giúp"
              onClick={() => setShowHint((v) => !v)}
            >
              ?
            </button>
            <button
              className="char-icon-btn close"
              title="Đóng (F3 / Esc)"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>

        {showHint && (
          <div className="char-hint">
            Các chỉ số chiến đấu được suy ra từ đẳng cấp nhân vật. Hệ thống trang bị và
            điểm tiềm năng sẽ được mở ở giai đoạn sau.
          </div>
        )}

        <div className="char-body">
          <div className="char-main">
            <div className="char-tabs" role="tablist">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={tab.enabled}
                  className={`char-tab${tab.enabled ? " active" : ""}`}
                  disabled={!tab.enabled}
                  title={tab.enabled ? tab.label : `${tab.label} (chưa mở)`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="char-equip">
              <div className="equip-col left">{EQUIPMENT_SLOTS.left.map(renderSlot)}</div>

              <div className="char-model">
                <img src="/hero_portrait.png" alt={playerName || "Nhân vật"} />
                {playerName && <div className="char-model-name">{playerName}</div>}
              </div>

              <div className="equip-col right">{EQUIPMENT_SLOTS.right.map(renderSlot)}</div>
            </div>
          </div>

          <div className="char-side">
            <div className="char-stats">
              {sheet.vitals.map((row) => (
                <div className="stat-row vital" key={row.key}>
                  <span className="stat-label">{row.label}</span>
                  <span className="stat-value">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="char-stats">
              {sheet.combat.map((row) => (
                <div className="stat-row" key={row.key}>
                  <span className="stat-label">{row.label}</span>
                  <span className="stat-value">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="char-stats">
              {sheet.attributes.map((row) => (
                <div className="stat-row attr" key={row.key}>
                  <span className="stat-label">{row.label}</span>
                  <span className="stat-value">
                    {row.base}
                    <span className="attr-bonus">+{row.bonus}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="char-potential">
              <span className="stat-label">Tiềm năng</span>
              <span className="stat-value">{sheet.footer.potential}</span>
            </div>
          </div>
        </div>

        <div className="char-footer">
          <span>
            Điểm: <b>{sheet.footer.points}</b>
          </span>
          <span>
            Tăng cấp: <b>{sheet.footer.nextLevelExp}</b>
          </span>
        </div>
      </div>
    </div>
  );
}
