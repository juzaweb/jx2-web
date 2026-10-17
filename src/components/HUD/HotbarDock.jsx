import React from "react";

export function HotbarDock({
  coins = 0,
  audioEnabled,
  onUseItem,
  onAttack,
  onSkill,
  onSave,
  onInventory,
  onOpenHelp,
  onToggleAudio
}) {
  return (
    <section className="bottom-dock" id="bottom-dock">
      <div className="dock-container">
        {/* Left Belt: Numbered Quick Slots (Potions & Scrolls) */}
        <div className="hotbar-slots">
          {/* Slot 1: Kim Sáng Dược (HP) */}
          <div
            className="slot-item"
            id="slot-1"
            title="Phím [1]: Kim Sáng Dược (+35 HP)"
            onClick={() => onUseItem(1)}
          >
            <span className="slot-key">1</span>
            <div className="item-icon icon-hp-pot"></div>
            <span className="slot-qty" id="qty-pot-hp">
              99
            </span>
          </div>

          {/* Slot 2: Đại Hoàn Đan (MP) */}
          <div
            className="slot-item"
            id="slot-2"
            title="Phím [2]: Đại Hoàn Đan (+25 MP)"
            onClick={() => onUseItem(2)}
          >
            <span className="slot-key">2</span>
            <div className="item-icon icon-mp-pot"></div>
            <span className="slot-qty" id="qty-pot-mp">
              86
            </span>
          </div>

          {/* Slot 3: Nữ Nhi Hồng (Buff) */}
          <div
            className="slot-item"
            id="slot-3"
            title="Phím [3]: Nữ Nhi Hồng (+50 HP, +30 MP)"
            onClick={() => onUseItem(3)}
          >
            <span className="slot-key">3</span>
            <div className="item-icon icon-wine-pot"></div>
            <span className="slot-qty" id="qty-pot-wine">
              50
            </span>
          </div>

          {/* Slot 4: Hồi Thành Phù */}
          <div
            className="slot-item"
            id="slot-4"
            title="Phím [4]: Hồi Thành Phù (Về Trường An)"
            onClick={() => onUseItem(4)}
          >
            <span className="slot-key">4</span>
            <div className="item-icon icon-scroll"></div>
            <span className="slot-qty">10</span>
          </div>

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
        <div className="hero-portrait" title="Lãng Khách Trường An">
          <div className="portrait-avatar">侠</div>
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
        </div>
      </div>
    </section>
  );
}
