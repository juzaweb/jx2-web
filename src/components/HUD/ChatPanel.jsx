import React, { useState, useRef, useEffect } from "react";

const TAB_LABELS = {
  all: "Tổng hợp",
  system: "Hệ thống",
  near: "Cận",
  combat: "Chiến đấu"
};

const TYPE_NAMES = {
  system: "Hệ thống",
  near: "Cận",
  combat: "Chiến đấu",
  guide: "Cẩm nang"
};

export function ChatPanel({ logs, onSendMessage }) {
  const [activeTab, setActiveTab] = useState("all");
  const [inputText, setInputText] = useState("");
  const contentRef = useRef(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    onSendMessage(text);
    setInputText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (activeTab === "all") return true;
    if (activeTab === "system") return log.type === "system" || log.type === "guide";
    if (activeTab === "near") return log.type === "near";
    if (activeTab === "combat") return log.type === "combat";
    return true;
  });

  return (
    <section className="bottom-left-panel" id="chat-panel">
      <div className="chat-box metal-card">
        <div className="chat-tabs">
          {["all", "system", "near", "combat"].map((tab) => (
            <button
              key={tab}
              className={`chat-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        <div className="chat-content" id="combat-log" ref={contentRef}>
          {filteredLogs.map((log) => (
            <p key={log.id} data-type={log.type}>
              <span className={`tag tag-${log.type}`}>
                [{TYPE_NAMES[log.type] || "Giang hồ"}]
              </span>{" "}
              {log.text}
            </p>
          ))}
        </div>

        <div className="chat-input-bar">
          <div className="channel-select" id="chat-channel-btn">
            [ Cận ] ▼
          </div>
          <input
            type="text"
            id="chat-input"
            placeholder="Nhấn Enter để gửi lời vào giang hồ..."
            maxLength={60}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button id="chat-send-btn" className="chat-send" onClick={handleSend}>
            GỬI
          </button>
        </div>
      </div>
    </section>
  );
}
