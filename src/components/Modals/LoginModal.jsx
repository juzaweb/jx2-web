import React, { useState, useEffect, useRef } from "react";
import { apiClient } from "../../game/apiClient.js";
import { writeSession } from "../../game/session.js";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { LanguageSwitcher } from "../LanguageSwitcher.jsx";
import { LobbyScene } from "../LobbyScene.jsx";
import { SERVER_NAME } from "../../game/serverConfig.js";
import "../../styles/login.css";

const VK_NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const VK_ROW1 = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
const VK_ROW2 = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
const VK_ROW3 = ["z", "x", "c", "v", "b", "n", "m", "_"];

export function LoginModal({ isOpen, onLoginSuccess, onClose }) {
  const { t } = useI18n();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberAccount, setRememberAccount] = useState(true);
  const [showVK, setShowVK] = useState(false);
  const [activeInput, setActiveInput] = useState("username");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [usernameFeedback, setUsernameFeedback] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    if (mode !== "register") {
      setUsernameFeedback(null);
      return;
    }

    const clean = username.trim();
    if (!clean) {
      setUsernameFeedback(null);
      return;
    }

    if (clean.length < 3) {
      setUsernameFeedback({ available: false, reason: t("login.errors.usernameMin") });
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(clean)) {
      setUsernameFeedback({ available: false, reason: t("login.errors.usernameChars") });
      return;
    }

    // Clear any previous (now stale) feedback while the availability check runs.
    setUsernameFeedback(null);

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.checkUsername(clean);
        if (isMounted) {
          setUsernameFeedback(res);
        }
      } catch {
        // Silently skip real-time check when offline or server unreachable,
        // so a stale error never blocks registration.
        if (isMounted) {
          setUsernameFeedback(null);
        }
      }
    }, 350);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, username, mode, t]);

  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  const handleVirtualKey = (key) => {
    setError("");
    if (activeInput === "username") {
      setUsername((prev) => prev + key);
    } else if (activeInput === "password") {
      setPassword((prev) => prev + key);
    }
  };

  const handleVirtualBackspace = () => {
    if (activeInput === "username") {
      setUsername((prev) => prev.slice(0, -1));
    } else if (activeInput === "password") {
      setPassword((prev) => prev.slice(0, -1));
    }
  };

  const handleVirtualClear = () => {
    if (activeInput === "username") setUsername("");
    else if (activeInput === "password") setPassword("");
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setSuccessMsg("");

    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError(t("login.errors.required"));
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUser)) {
      setError(t("login.errors.usernamePattern"));
      return;
    }

    if (password.length < 6) {
      setError(t("login.errors.passwordLength"));
      return;
    }

    if (mode === "register" && usernameFeedback && !usernameFeedback.available) {
      setError(usernameFeedback.reason || t("login.errors.usernameTaken"));
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
          server: SERVER_NAME,
          loggedInAt: Date.now()
        };
        writeSession(session);

        setSuccessMsg(t("login.success.login"));
        setTimeout(() => {
          onLoginSuccess(session);
        }, 600);
      } else {
        const data = await apiClient.register(
          username.trim(),
          password
        );

        if (rememberAccount) {
          localStorage.setItem("jx2_saved_username", username.trim());
        }

        const session = {
          user: data.user,
          token: data.token,
          server: SERVER_NAME,
          loggedInAt: Date.now()
        };
        writeSession(session);

        setSuccessMsg(t("login.success.register"));
        setTimeout(() => {
          onLoginSuccess(session);
        }, 600);
      }
    } catch (err) {
      const isNetworkError =
        err.name === "TypeError" ||
        err.message?.includes("Failed to fetch") ||
        err.message?.includes("NetworkError") ||
        err.message?.includes("fetch failed");

      if (isNetworkError) {
        setError(t("login.errors.network"));
      } else {
        setError(err.message || t("login.errors.generic"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPassword("");
    setError("");
    setSuccessMsg("");
    if (mode === "register") {
      setMode("login");
      return;
    }
    if (!rememberAccount) {
      setUsername("");
    }
    if (onClose) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="jx2-login-overlay" id="jx2-login-overlay">
      <LobbyScene />
      <LanguageSwitcher variant="login" />

      {/* Top-Right Title Emblem */}
      <div className="jx2-login-logo">
        <div className="jx2-logo-title-wrap">
          <svg className="jx2-logo-sword-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <circle cx="32" cy="32" r="28" stroke="rgba(227, 194, 124, 0.62)" strokeWidth="1.3" />
            <circle cx="32" cy="32" r="23" stroke="rgba(227, 194, 124, 0.25)" strokeWidth="1" />
            <path d="M32 11 L36.5 29 L32 36 L27.5 29 Z" fill="#e9d3a0" />
            <path d="M32 36 V50" stroke="#c9a961" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M23 43 H41" stroke="#c9a961" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <span className="jx2-logo-text">{t("login.brandTitle")}</span>
        </div>
        <div className="jx2-logo-subtitle">{t("login.brandSubtitle")}</div>
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
          <div className="jx2-box-title">{t("login.serverLoggedIn")}</div>
        </div>

        {/* Server Card — the game runs one fixed server */}
        <div className="jx2-server-card">
          <div className="jx2-server-badge">
            <span className="jx2-server-diamond">◆</span>
            <span className="jx2-server-name">{SERVER_NAME}</span>
            <span className="jx2-server-diamond">◆</span>
          </div>

          <div className="jx2-server-artwork" />
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
            {t("login.loginTab")}
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
            {t("login.registerTab")}
          </button>
        </div>

        {/* Error / Success Alerts */}
        {error && (
          <div className="jx2-alert-banner error">
            <div>{error}</div>
          </div>
        )}
        {successMsg && <div className="jx2-alert-banner success">{successMsg}</div>}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => e.stopPropagation()}
          style={{ display: "flex", flexDirection: "column", gap: "8px" }}
        >
          {/* Username */}
          <div className="jx2-form-group">
            <label className="jx2-form-label" htmlFor="jx2-username">
              {t("login.usernameLabel")}
            </label>
            <input
              id="jx2-username"
              ref={usernameRef}
              type="text"
              className="jx2-form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={() => setActiveInput("username")}
              placeholder={t("login.usernamePlaceholder")}
              autoComplete="username"
              maxLength={30}
              required
            />
            {mode === "register" && usernameFeedback && (
              <div
                style={{
                  fontSize: "11px",
                  marginTop: "3px",
                  color: usernameFeedback.available ? "#4ade80" : "#f87171",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontWeight: 500,
                  textShadow: "0 1px 2px rgba(0,0,0,0.8)"
                }}
              >
                <span>{usernameFeedback.available ? "✓" : "⚠"}</span>
                <span>{usernameFeedback.reason}</span>
              </div>
            )}
          </div>

          {/* Password */}
          <div className="jx2-form-group">
            <label className="jx2-form-label" htmlFor="jx2-password">
              {t("login.passwordLabel")}
            </label>
            <input
              id="jx2-password"
              ref={passwordRef}
              type="password"
              className="jx2-form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setActiveInput("password")}
              placeholder={t("login.passwordPlaceholder")}
              autoComplete="current-password"
              required
            />
          </div>

          {/* Checkboxes Row */}
          <div className="jx2-options-row">
            <label className="jx2-checkbox-label">
              <input
                type="checkbox"
                className="jx2-checkbox"
                checked={rememberAccount}
                onChange={(e) => setRememberAccount(e.target.checked)}
              />
              <span>{t("login.remember")}</span>
            </label>

            <label className="jx2-checkbox-label">
              <input
                type="checkbox"
                className="jx2-checkbox"
                checked={showVK}
                onChange={(e) => setShowVK(e.target.checked)}
              />
              <span>{t("login.virtualKeyboard")}</span>
            </label>
          </div>

          {/* Virtual Keyboard */}
          {showVK && (
            <div className="jx2-vk-container">
              <div className="jx2-vk-header">
                <span className="jx2-vk-title">{t("login.vkTitle")}</span>
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
                  {t("login.deleteKey")}
                </button>
                <button
                  type="button"
                  className="jx2-vk-key special"
                  onClick={handleVirtualClear}
                >
                  {t("login.clearKey")}
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons: Đăng nhập/Đăng ký & Trở lại */}
          <div className="jx2-dialog-actions">
            <button
              type="submit"
              className="jx2-btn-action"
              disabled={loading || (mode === "register" && usernameFeedback?.available === false)}
            >
              {loading ? t("common.wait") : (mode === "register" ? t("login.registerButton") : t("login.loginButton"))}
            </button>
            <button
              type="button"
              className="jx2-btn-action secondary"
              onClick={handleReset}
              disabled={loading}
            >
              {t("common.back")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
