import React from "react";
import { QUICK_ITEMS } from "../../game/items.js";

export function HotbarDock({
  coins = 0,
  audioEnabled,
  onUseItem,
  onAttack,
  onSkill,
  onSave,
  onInventory,
  onCharacter,
  onOpenHelp,
  onToggleAudio,
  onLogout,
  items = QUICK_ITEMS
}) {
  return (
    <section className="bottom-dock" id="bottom-dock">
      <div className="dock-container">
        {/* Left Belt: Numbered Quick Slots (Potions & Scrolls) */}
        <div className="hotbar-slots">
          {items.map((item) => (
            <div
              className="slot-item"
              id={`slot-${item.useSlot}`}
              key={item.id}
              title={`Phím [${item.useSlot}]: ${item.name}`}
              onClick={() => onUseItem(item.useSlot)}
            >
              <span className="slot-key">{item.useSlot}</span>
              <div className={`item-icon ${item.icon}`} />
              <span className="slot-qty" id={`qty-${item.id}`}>
                {item.qty}
              </span>
            </div>
          ))}

          {/* Slot 5 to 7: Martial shortcuts */}
          <div className="slot-item empty">
            <span className="slot-key">5</span>
          </div>
          <div className="slot-item empty">
            <span className="slot-key">6</span>
          </div>
          <div className="slot-item empty">
            <span className="slot-key">7</span>
          </div>

          {/* Slot 8 / Q: Kiếm Khí Skill */}
          <div
            className="slot-item skill-slot"
            id="slot-8"
            title="Phím [8] hoặc [Q]: Tuyệt kỹ Kiếm Khí"
            onClick={onSkill}
          >
            <span className="slot-key">8/Q</span>
            <div className="item-icon icon-sword-aura"></div>
          </div>
        </div>

        {/* Middle: Active Martial Arts Cooldown & Skills Display */}
        <div className="martial-center">
          <div
            className="martial-skill-box l-click"
            id="skill-attack-box"
            title="Chuột Trái / Space: Vô Cực Kiếm Pháp"
            onClick={onAttack}
          >
            <div className="skill-art art-sword"></div>
            <span className="click-badge">Chuột Trái</span>
          </div>
          <div
            className="martial-skill-box r-click"
            id="skill-q-box"
            title="Chuột Phải / Phím Q: Kiếm Khí Bát Hoang"
            onClick={onSkill}
          >
            <div className="skill-art art-aura"></div>
            <span className="click-badge">Chuột Phải [Q]</span>
          </div>
          <div className="martial-text-label">
            <div className="martial-name">Phần Cẩm Chữ Hạc</div>
            <div className="martial-sub">Thiên Hà Mật Tịch</div>
          </div>
        </div>

        {/* Hero Portrait */}
        <div className="hero-portrait" title="Lãng Khách Võ Đang">
          <div className="portrait-avatar">
            <img
              src="/hero_portrait.png"
              alt="Lãng Khách"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center 15%",
                display: "block"
              }}
            />
          </div>
          <div className="portrait-coins" id="coin-label">
            BẠC: {coins}
          </div>
        </div>

        {/* Right Utility: System Icons Tray */}
        <div className="system-icons-tray">
          <button
            className="sys-btn"
            id="save-btn"
            title="Lưu tiến trình vào trình duyệt (localStorage)"
            onClick={onSave}
          >
            <span className="sys-ico">💾</span>
            <span className="sys-lbl">Lưu</span>
          </button>
          <button
            className="sys-btn"
            id="char-btn"
            title="Nhân Vật (F3)"
            onClick={onCharacter}
          >
            <span className="sys-ico">🧍</span>
            <span className="sys-lbl">Nhân Vật</span>
          </button>
          <button
            className="sys-btn"
            id="inv-btn"
            title="Hành Trang / Túi Đồ"
            onClick={onInventory}
          >
            <span className="sys-ico">🎒</span>
            <span className="sys-lbl">Hành Trang</span>
          </button>
          <button
            className="sys-btn"
            id="help-btn"
            title="Cẩm Nang Hướng Dẫn"
            onClick={onOpenHelp}
          >
            <span className="sys-ico">📜</span>
            <span className="sys-lbl">Cẩm Nang</span>
          </button>
          <button
            className="sys-btn"
            id="sound-btn"
            title="Cài đặt âm thanh"
            style={{ opacity: audioEnabled ? 1 : 0.6 }}
            onClick={onToggleAudio}
          >
            <span className="sys-ico">🔊</span>
            <span className="sys-lbl">
              {audioEnabled ? "Âm Thanh" : "Tắt Âm"}
            </span>
          </button>
          <button className="sys-btn pk-mode" title="Trạng thái PK Hòa Bình">
            <span className="sys-ico">⚔️</span>
            <span className="sys-lbl">Hòa Bình</span>
          </button>
          {onLogout && (
            <button
              className="sys-btn"
              id="logout-btn"
              title="Đăng xuất khỏi tài khoản"
              onClick={onLogout}
            >
              <span className="sys-ico">🚪</span>
              <span className="sys-lbl">Đăng Xuất</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
