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

/** Faint silhouette drawn behind each empty equipment slot. */
const SLOT_ICONS = {
  helm: (
    <>
      <path d="M6 16v-3a6 6 0 0 1 12 0v3" />
      <path d="M4 16h16v3H4z" />
    </>
  ),
  armor: (
    <>
      <path d="M8 5l4 2 4-2 3 3v11H5V8z" />
      <path d="M12 7v12" />
    </>
  ),
  belt: (
    <>
      <rect x="3" y="10" width="18" height="5" rx="1" />
      <rect x="10" y="9" width="4" height="7" rx="1" />
    </>
  ),
  gloves: (
    <path d="M8 20v-8a2 2 0 0 1 4 0V9a2 2 0 0 1 4 0v3a2 2 0 0 1 4 0v8a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z" />
  ),
  bracers: (
    <>
      <rect x="7" y="6" width="10" height="12" rx="2" />
      <path d="M7 12h10" />
    </>
  ),
  weapon: (
    <>
      <path d="M12 2l2 3v11h-4V5z" />
      <path d="M7 16h10" />
      <path d="M12 19v3" />
    </>
  ),
  necklace: (
    <>
      <path d="M6 5a7 7 0 0 0 12 0" />
      <circle cx="12" cy="14" r="2.5" />
    </>
  ),
  ring: (
    <>
      <circle cx="12" cy="14" r="6" />
      <path d="M9 8l3-3 3 3" />
    </>
  ),
  jade: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  amulet: (
    <>
      <path d="M8 4h8v16l-4-3-4 3z" />
      <path d="M10 8h4" />
      <path d="M10 11h4" />
    </>
  ),
  boots: (
    <>
      <path d="M9 3h5v8l4 3v4H9z" />
      <path d="M9 15h9" />
    </>
  )
};

export function CharacterModal({ isOpen, onClose, stats, playerName = "" }) {
  const [showHint, setShowHint] = useState(false);

  if (!isOpen) return null;

  const sheet = deriveCharacterSheet(stats);

  const renderSlot = (slot) => (
    <div className="equip-slot" key={slot.key} title={`${slot.label} (chưa trang bị)`}>
      <svg className="equip-slot-icon" viewBox="0 0 24 24" aria-hidden="true">
        {SLOT_ICONS[slot.key]}
      </svg>
    </div>
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
