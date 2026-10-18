import React, { useState, useEffect, useRef } from "react";
import { apiClient } from "../../game/apiClient.js";
import "../../styles/login.css";

const SERVERS = [
  { id: "s1", name: "Youtube: PYTA Gaming", tag: "Đề Cử", tagClass: "recommended" },
  { id: "s2", name: "Biện Kinh", tag: "Mới", tagClass: "normal" },
  { id: "s3", name: "Thành Đô", tag: "Đông", tagClass: "crowded" },
  { id: "s4", name: "Tương Dương", tag: "Đông", tagClass: "crowded" },
  { id: "s5", name: "Trường An", tag: "Bình Thường", tagClass: "normal" },
];

const VK_NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const VK_ROW1 = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
const VK_ROW2 = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
const VK_ROW3 = ["z", "x", "c", "v", "b", "n", "m", "_"];

export function LoginModal({ isOpen, onLoginSuccess, onClose }) {
  if (!isOpen) return null;

  const [mode, setMode] = useState("login"); // "login" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [rememberAccount, setRememberAccount] = useState(true);
  const [showVK, setShowVK] = useState(false);
  const [activeInput, setActiveInput] = useState("username");
  const [selectedServer, setSelectedServer] = useState(SERVERS[0]);
  const [isServerListOpen, setIsServerListOpen] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [canGuestLogin, setCanGuestLogin] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGuestLogin = () => {
    const cleanUser = username.trim() || "HiepKhach";
    const session = {
      user: {
        id: `guest_${Date.now()}`,
        username: cleanUser.toLowerCase(),
        displayName: displayName.trim() || cleanUser
      },
      token: "offline-guest-token",
      server: selectedServer.name,
      loggedInAt: Date.now()
    };
    localStorage.setItem("jx2_user_session", JSON.stringify(session));
    setSuccessMsg("Đang vào giang hồ ở chế độ Cục Bộ...");
    setTimeout(() => {
      onLoginSuccess(session);
    }, 400);
  };

  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const displayNameRef = useRef(null);

  useEffect(() => {
    // Load remembered account if present
    const saved = localStorage.getItem("jx2_saved_username");
    if (saved) {
      setUsername(saved);
      setRememberAccount(true);
      if (passwordRef.current) {
        passwordRef.current.focus();
        setActiveInput("password");
      }
    } else if (usernameRef.current) {
      usernameRef.current.focus();
    }
  }, []);

  const handleVirtualKey = (key) => {
    setError("");
    if (activeInput === "username") {
      setUsername((prev) => prev + key);
    } else if (activeInput === "password") {
      setPassword((prev) => prev + key);
    } else if (activeInput === "displayName") {
      setDisplayName((prev) => prev + key);
    }
  };

  const handleVirtualBackspace = () => {
    if (activeInput === "username") {
      setUsername((prev) => prev.slice(0, -1));
    } else if (activeInput === "password") {
      setPassword((prev) => prev.slice(0, -1));
    } else if (activeInput === "displayName") {
      setDisplayName((prev) => prev.slice(0, -1));
    }
  };

  const handleVirtualClear = () => {
    if (activeInput === "username") setUsername("");
    else if (activeInput === "password") setPassword("");
    else if (activeInput === "displayName") setDisplayName("");
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setSuccessMsg("");

    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError("Vui lòng điền đầy đủ tài khoản và mật khẩu.");
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUser)) {
      setError("Tài khoản phải gồm 3-30 ký tự chữ cái, số hoặc dấu gạch dưới.");
      return;
    }

    if (password.length < 6) {
      setError("Mật khẩu phải có độ dài tối thiểu 6 ký tự.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const data = await apiClient.login(username.trim(), password);
        if (rememberAccount) {
          localStorage.setItem("jx2_saved_username", username.trim());
        } else {
          localStorage.removeItem("jx2_saved_username");
        }

        const session = {
          user: data.user,
          token: data.token,
          server: selectedServer.name,
          loggedInAt: Date.now()
        };
        localStorage.setItem("jx2_user_session", JSON.stringify(session));

        setSuccessMsg("Đăng nhập thành công! Đang chuyển vào thế giới Giang Hồ...");
        setTimeout(() => {
          onLoginSuccess(session);
        }, 600);
      } else {
        const data = await apiClient.register(
          username.trim(),
          password,
          displayName.trim() || username.trim()
        );

        if (rememberAccount) {
          localStorage.setItem("jx2_saved_username", username.trim());
        }

        const session = {
          user: data.user,
          token: data.token,
          server: selectedServer.name,
          loggedInAt: Date.now()
        };
        localStorage.setItem("jx2_user_session", JSON.stringify(session));

        setSuccessMsg("Đăng ký tài khoản thành công! Đang chuẩn bị hành trang...");
        setTimeout(() => {
          onLoginSuccess(session);
        }, 600);
      }
    } catch (err) {
      const msg = err.message || "Không thể kết nối đến máy chủ. Vui lòng thử lại!";
      setError(msg);
      if (
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("fetch failed") ||
        err.name === "TypeError"
      ) {
        setCanGuestLogin(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPassword("");
    setDisplayName("");
    setError("");
    setSuccessMsg("");
    if (!rememberAccount) {
      setUsername("");
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="jx2-login-overlay" id="jx2-login-overlay">
      {/* Top-Right Official Emblem */}
      <div className="jx2-login-logo">
        <div className="jx2-logo-title-wrap">
          <svg className="jx2-logo-sword-icon" viewBox="0 0 64 64" fill="none">
            <path d="M10 54 L32 32 M32 32 L46 18 M46 18 L54 10 L50 6 L42 14 L28 28" stroke="#ff4500" strokeWidth="4" strokeLinecap="round" />
            <path d="M26 38 L38 26" stroke="#fcd34d" strokeWidth="3" />
            <circle cx="10" cy="54" r="4" fill="#ef4444" />
          </svg>
          <span className="jx2-logo-text">Võ Lâm Truyền Kỳ II</span>
        </div>
        <div className="jx2-logo-subtitle">HẢO KIỆT LÔI TRANH</div>
        <div className="jx2-logo-domain">volam2.zing.vn</div>
      </div>

      {/* Main Login Box */}
      <div className="jx2-login-box">
        {/* Ornate Corner Accents */}
        <div className="jx2-corner top-left"></div>
        <div className="jx2-corner top-right"></div>
        <div className="jx2-corner bottom-left"></div>
        <div className="jx2-corner bottom-right"></div>

        {/* Header Plaque */}
        <div className="jx2-box-header">
          <div className="jx2-box-title">Máy chủ đã đăng nhập</div>
        </div>

        {/* Server Preview Card */}
        <div className="jx2-server-card">
          <div className="jx2-server-badge">
            <span className="jx2-server-diamond">◆</span>
            <span className="jx2-server-name">{selectedServer.name}</span>
            <span className="jx2-server-diamond">◆</span>
          </div>

          <div className="jx2-server-artwork" />

          <button
            type="button"
            className="jx2-btn-server-select"
            onClick={() => setIsServerListOpen(!isServerListOpen)}
          >
            {isServerListOpen ? "Đóng danh sách" : "Chọn lại máy chủ"}
          </button>

          {/* Server Switcher Dropdown */}
          {isServerListOpen && (
            <div className="jx2-server-list">
              {SERVERS.map((srv) => (
                <div
                  key={srv.id}
                  className={`jx2-server-item ${srv.id === selectedServer.id ? "active" : ""}`}
                  onClick={() => {
                    setSelectedServer(srv);
                    setIsServerListOpen(false);
                  }}
                >
                  <span className="jx2-server-item-name">{srv.name}</span>
                  <span className={`jx2-server-item-tag ${srv.tagClass}`}>{srv.tag}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mode Tabs */}
        <div className="jx2-auth-tabs">
          <button
            type="button"
            className={`jx2-auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => {
              setMode("login");
              setError("");
              setSuccessMsg("");
            }}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            className={`jx2-auth-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => {
              setMode("register");
              setError("");
              setSuccessMsg("");
            }}
          >
            Đăng ký tài khoản
          </button>
        </div>

        {/* Error / Success Alerts */}
        {error && (
          <div className="jx2-alert-banner error">
            <div>{error}</div>
            {canGuestLogin && (
              <button
                type="button"
                onClick={handleGuestLogin}
                style={{
                  marginTop: "6px",
                  background: "rgba(234, 179, 8, 0.2)",
                  border: "1px dashed #facc15",
                  color: "#fef08a",
                  padding: "4px 8px",
                  fontSize: "11px",
                  borderRadius: "2px",
                  cursor: "pointer",
                  width: "100%",
                  fontWeight: 600
                }}
              >
                ⚡ Vào game chế độ Khách (Offline)
              </button>
            )}
          </div>
        )}
        {successMsg && <div className="jx2-alert-banner success">{successMsg}</div>}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {/* Username */}
          <div className="jx2-form-group">
            <label className="jx2-form-label" htmlFor="jx2-username">
              Tài khoản:
            </label>
            <input
              id="jx2-username"
              ref={usernameRef}
              type="text"
              className="jx2-form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={() => setActiveInput("username")}
              placeholder="Nhập tài khoản"
              autoComplete="username"
              maxLength={30}
              required
            />
          </div>

          {/* Password */}
          <div className="jx2-form-group">
            <label className="jx2-form-label" htmlFor="jx2-password">
              Mật khẩu:
            </label>
            <input
              id="jx2-password"
              ref={passwordRef}
              type="password"
              className="jx2-form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setActiveInput("password")}
              placeholder="Nhập mật khẩu"
              autoComplete="current-password"
              required
            />
          </div>

          {/* Display Name (Only in register mode) */}
          {mode === "register" && (
            <div className="jx2-form-group">
              <label className="jx2-form-label" htmlFor="jx2-displayname">
                Tên hiển thị:
              </label>
              <input
                id="jx2-displayname"
                ref={displayNameRef}
                type="text"
                className="jx2-form-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onFocus={() => setActiveInput("displayName")}
                placeholder="Tên nhân vật giang hồ"
                maxLength={50}
              />
            </div>
          )}

          {/* Checkboxes Row */}
          <div className="jx2-options-row">
            <label className="jx2-checkbox-label">
              <input
                type="checkbox"
                className="jx2-checkbox"
                checked={rememberAccount}
                onChange={(e) => setRememberAccount(e.target.checked)}
              />
              <span>Nhớ</span>
            </label>

            <label className="jx2-checkbox-label">
              <input
                type="checkbox"
                className="jx2-checkbox"
                checked={showVK}
                onChange={(e) => setShowVK(e.target.checked)}
              />
              <span>Bàn phím ảo</span>
            </label>
          </div>

          {/* Virtual Keyboard */}
          {showVK && (
            <div className="jx2-vk-container">
              <div className="jx2-vk-header">
                <span className="jx2-vk-title">Bàn Phím Ảo (Chống Keylogger)</span>
                <button type="button" className="jx2-vk-close" onClick={() => setShowVK(false)}>
                  ✕
                </button>
              </div>

              {/* Number Row */}
              <div className="jx2-vk-row">
                {VK_NUMBERS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="jx2-vk-key"
                    onClick={() => handleVirtualKey(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {/* Row 1 */}
              <div className="jx2-vk-row">
                {VK_ROW1.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="jx2-vk-key"
                    onClick={() => handleVirtualKey(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>

              {/* Row 2 */}
              <div className="jx2-vk-row">
                {VK_ROW2.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="jx2-vk-key"
                    onClick={() => handleVirtualKey(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>

              {/* Row 3 */}
              <div className="jx2-vk-row">
                {VK_ROW3.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="jx2-vk-key"
                    onClick={() => handleVirtualKey(k)}
                  >
                    {k}
                  </button>
                ))}
                <button
                  type="button"
                  className="jx2-vk-key special"
                  onClick={handleVirtualBackspace}
                >
                  Xóa
                </button>
                <button
                  type="button"
                  className="jx2-vk-key special"
                  onClick={handleVirtualClear}
                >
                  Hết
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons: Đồng ý & Trở lại */}
          <div className="jx2-dialog-actions">
            <button
              type="submit"
              className="jx2-btn-action"
              disabled={loading}
            >
              {loading ? "Chờ..." : "Đồng ý"}
            </button>
            <button
              type="button"
              className="jx2-btn-action secondary"
              onClick={handleReset}
              disabled={loading}
            >
              Trở lại
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
