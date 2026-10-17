import React from "react";

export function StartModal({ isOpen, onStart, level = 1, isSaved = false }) {
  if (!isOpen) return null;

  const btnText = isSaved
    ? `TIẾP TỤC HÀNH TẨU (CẤP ${level})`
    : "BƯỚC CHÂN VÀO GIANG HỒ";

  return (
    <div id="overlay" className="overlay">
      <div className="wuxia-modal metal-card">
        <div className="modal-seal">武</div>
        <p className="modal-eyebrow">THẾ GIỚI KIẾM HIỆP TRUYỀN KỲ</p>
        <h1 className="modal-title">GIANG HỒ 2</h1>
        <p className="modal-subtitle">
          Một bước vào giang hồ, vạn bước chẳng quay đầu.
        </p>
        <div className="feature-pills">
          <span>⚔ Vô Cực Kiếm Pháp</span>
          <span>✦ Tu Luyện Cấp Độ</span>
          <span>◆ Bí Tịch Kiếm Khí</span>
        </div>
        <button id="start-btn" className="wuxia-btn-primary" onClick={onStart}>
          {btnText} <span>→</span>
        </button>
        <small className="modal-foot">
          React & Phaser • Phỏng theo giao diện kinh điển Võ Lâm 2 Origin
        </small>
      </div>
    </div>
  );
}
