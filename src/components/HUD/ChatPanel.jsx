import React, { useState, useRef, useEffect } from "react";
import { useI18n } from "../../i18n/I18nProvider.jsx";

const TABS = ["all", "system", "near", "combat"];

export function ChatPanel({ logs, onSendMessage, collapsed = false, onClose }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("all");
  const [inputText, setInputText] = useState("");
  const contentRef = useRef(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [logs]);

  if (collapsed) return null;

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
          <button type="button" className="chat-close" onClick={onClose} title="×">×</button>
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`chat-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {t(`chat.tabs.${tab}`)}
            </button>
          ))}
        </div>

        <div className="chat-content" id="combat-log" ref={contentRef}>
          {filteredLogs.map((log) => (
            <p key={log.id} data-type={log.type}>
              <span className={`tag tag-${log.type}`}>
                [{t(`chat.types.${log.type}`, undefined, t("chat.types.default"))}]
              </span>{" "}
              {log.textKey ? t(log.textKey, log.textParams) : log.text}
            </p>
          ))}
        </div>

        <div className="chat-input-bar">
          <div className="channel-select" id="chat-channel-btn">
            {t("chat.channel")}
          </div>
          <input
            type="text"
            id="chat-input"
            placeholder={t("chat.placeholder")}
            maxLength={60}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button id="chat-send-btn" className="chat-send" onClick={handleSend}>
            {t("chat.send")}
          </button>
        </div>
      </div>
    </section>
  );
}
