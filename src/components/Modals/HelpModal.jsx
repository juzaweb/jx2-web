import React from "react";

export function HelpModal({ isOpen, onClose, onReset }) {
  if (!isOpen) return null;

  return (
    <div id="help-modal" className="overlay">
      <div className="wuxia-modal metal-card help-modal-box">
        <button id="close-help" className="modal-close-x" onClick={onClose}>
          ×
        </button>
        <div className="modal-eyebrow">CẨM NANG HÀNH TẨU</div>
        <h2>Hướng Dẫn Tân Thủ</h2>
        <div className="guide-scroll">
          <p>
            <b>Di chuyển:</b> Dùng cụm phím <b>W, A, S, D</b> hoặc <b>← ↑ ↓ →</b>.
          </p>
          <p>
            <b>Chiến đấu:</b> Nhấn <b>Space</b> hoặc nhấp chuột trái vào bản đồ để xuất chiêu kiếm pháp.
          </p>
          <p>
            <b>Tuyệt kỹ Kiếm Khí:</b> Nhấn phím <b>Q</b> hoặc <b>Phím 8</b>, phát kình khí diện rộng (tiêu hao 15 MP).
          </p>
          <p>
            <b>Dược phẩm cấp tốc:</b>
            <br />• Phím <b>1</b>: Uống Kim Sáng Dược (+35 HP).
            <br />• Phím <b>2</b>: Uống Đại Hoàn Đan (+25 MP).
            <br />• Phím <b>3</b>: Uống Nữ Nhi Hồng (+50 HP & +30 MP).
          </p>
          <p>
            <b>Túi đồ & Tiền bạc:</b> Hạ gục Sói Xám để nhận kinh nghiệm, bạc và nhặt túi ngọc phát sáng.
          </p>
          <p>
            <b>Lưu tiến trình:</b> Bấm nút <b>Lưu</b> ở góc dưới hoặc hệ thống tự động lưu mỗi 15 giây.
          </p>
          <p>
            <b>Tạm dừng:</b> Nhấn <b>Esc</b> hoặc mở bảng Hướng Dẫn để tạm dừng game.
          </p>
        </div>
        <button id="resume-btn" className="wuxia-btn-primary" onClick={onClose}>
          ĐÃ THÔNG SUỐT
        </button>
        <button id="reset-btn" className="wuxia-btn-danger" onClick={onReset}>
          LÀM LẠI TỪ ĐẦU (RESET TIẾN TRÌNH)
        </button>
      </div>
    </div>
  );
}
