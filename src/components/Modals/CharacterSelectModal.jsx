import React, { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "../../game/apiClient.js";
import "../../styles/character-select.css";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { LanguageSwitcher } from "../LanguageSwitcher.jsx";
import { requestLandscapeFullscreen } from "../../game/orientation.js";

const NAME_MIN = 2;
const NAME_MAX = 16;

/**
 * Character creation choices: the four playable sects. Only Nga My admits
 * female characters; the other sects are male.
 */
const SECTS = [
  { key: "thieu-lam", labelKey: "characterSelect.sectThieuLam", glyph: "少" },
  { key: "nga-my", labelKey: "characterSelect.sectNgaMy", glyph: "峨" },
  { key: "vo-dang", labelKey: "characterSelect.sectVoDang", glyph: "武" },
  { key: "ngu-doc", labelKey: "characterSelect.sectNguDoc", glyph: "毒" }
];

const SECT_BY_KEY = Object.fromEntries(SECTS.map((sect) => [sect.key, sect]));
const DEFAULT_SECT = SECTS[0];

const DATE_LOCALES = { vi: "vi-VN", en: "en-GB", zh: "zh-CN" };

/**
 * Format an epoch millisecond timestamp into a short localized date-time.
 * @param {number} ts
 * @param {string} language
 * @returns {string}
 */
const formatDateTime = (ts, language = "vi") => {
  if (!ts || typeof ts !== "number") return "";
  try {
    const d = new Date(ts);
    const parts = new Intl.DateTimeFormat(DATE_LOCALES[language] || DATE_LOCALES.vi, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(d);
    const pick = (type) => parts.find((part) => part.type === type)?.value || "";
    return `${pick("day")}/${pick("month")}/${pick("year")} ${pick("hour")}:${pick("minute")}`;
  } catch {
    return "";
  }
};

export function CharacterSelectModal({ isOpen, user, server, onStart, onLogout }) {
  const { t, language } = useI18n();
  const tRef = useRef(t);
  const [characters, setCharacters] = useState([]);
  const [maxSlots, setMaxSlots] = useState(3);
  const [selectedId, setSelectedId] = useState("");
  const [mode, setMode] = useState("select"); // "select" | "create"
  const [nameInput, setNameInput] = useState("");
  const [sectKey, setSectKey] = useState(DEFAULT_SECT.key);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const applyData = useCallback((data) => {
    const list = Array.isArray(data?.characters) ? data.characters : [];
    setCharacters(list);
    if (typeof data?.maxSlots === "number") setMaxSlots(data.maxSlots);
    setSelectedId((prev) => (list.some((c) => c.id === prev) ? prev : list[0]?.id || ""));
  }, []);

  const reload = useCallback(async () => {
    const data = await apiClient.listCharacters(user.id);
    applyData(data);
    return data;
  }, [user?.id, applyData]);

  useEffect(() => {
    if (!isOpen || !user?.id) return;
    let isMounted = true;

    setLoading(true);
    setError("");
    reload()
      .catch((err) => {
        if (isMounted) setError(err.message || tRef.current("characterSelect.errors.load"));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, user?.id, reload]);

  const selected = characters.find((c) => c.id === selectedId) || null;
  const activeSect = SECT_BY_KEY[sectKey] || DEFAULT_SECT;
  const selectedSect = selected ? SECT_BY_KEY[selected.sect] || DEFAULT_SECT : null;

  const handleOpenCreate = () => {
    setMode("create");
    setNameInput("");
    setSectKey(DEFAULT_SECT.key);
    setError("");
    setNotice("");
  };

  const handleCancelCreate = () => {
    setMode("select");
    setNameInput("");
    setError("");
  };

  const handleCreate = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setNotice("");

    const cleanName = nameInput.trim().replace(/\s+/g, " ");
    if (cleanName.length < NAME_MIN || cleanName.length > NAME_MAX) {
      setError(t("characterSelect.errors.nameLength", { min: NAME_MIN, max: NAME_MAX }));
      return;
    }

    setBusy(true);
    try {
      const data = await apiClient.createCharacter(
        user.id,
        cleanName,
        activeSect.key
      );
      const createdId = data?.character?.id;
      await reload();
      if (createdId) setSelectedId(createdId);
      setMode("select");
      setNameInput("");
      setNotice(t("characterSelect.notice.created", { name: data?.character?.name || cleanName }));
    } catch (err) {
      setError(err.message || t("characterSelect.errors.create"));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) {
      setError(t("characterSelect.errors.selectToDelete"));
      return;
    }
    if (!window.confirm(t("characterSelect.errors.confirmDelete", { name: selected.name }))) return;

    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiClient.deleteCharacter(user.id, selected.id);
      await reload();
      setNotice(t("characterSelect.notice.deleted", { name: selected.name }));
    } catch (err) {
      setError(err.message || t("characterSelect.errors.delete"));
    } finally {
      setBusy(false);
    }
  };

  const handleStart = () => {
    if (!selected) {
      setError(t("characterSelect.errors.selectToStart"));
      return;
    }
    requestLandscapeFullscreen();
    onStart(selected);
  };

  const slots = Array.from({ length: maxSlots }, (_, i) => characters[i] || null);

  if (!isOpen) return null;

  return (
    <div className="jx2-login-overlay" id="jx2-character-overlay">
      <LanguageSwitcher variant="character" />

      {/* Top status bar: account + server, mirroring the in-game header */}
      <div className="jx2-cs-topbar">
        <span className="jx2-cs-topbar-user">{t("characterSelect.account")}: {user?.username}</span>
        <span className="jx2-cs-topbar-server">{t("characterSelect.server")}: {server || "Biện Kinh"}</span>
      </div>

      <div className="jx2-cs-box">
        <div className="jx2-cs-title">{mode === "create" ? t("characterSelect.create") : t("characterSelect.select")}</div>

        {error && <div className="jx2-alert-banner error">{error}</div>}
        {notice && <div className="jx2-alert-banner success">{notice}</div>}

        <div className="jx2-cs-body">
          {/* Center stage: selected character / new-character preview */}
          <div className="jx2-cs-stage">
            {mode === "create" ? (
              <>
                <div className={`jx2-cs-portrait sect-${activeSect.key}`}>
                  <span className="jx2-cs-portrait-glyph">{activeSect.glyph}</span>
                </div>
                <div className="jx2-cs-stage-name">
                  {nameInput.trim() || t("characterSelect.newCharacter")}
                </div>
                <div className="jx2-cs-stage-meta">{t("characterSelect.sect")}: {t(activeSect.labelKey)}</div>
              </>
            ) : (
              <>
                <div className={`jx2-cs-portrait ${selectedSect ? `sect-${selectedSect.key}` : ""}`}>
                  {selectedSect ? (
                    <span className="jx2-cs-portrait-glyph">{selectedSect.glyph}</span>
                  ) : (
                    <span className="jx2-cs-portrait-glyph empty">?</span>
                  )}
                </div>
                <div className="jx2-cs-stage-name">
                  {selected ? selected.name : loading ? t("characterSelect.loading") : t("characterSelect.noCharacters")}
                </div>
                {selected && (
                  <div className="jx2-cs-stage-meta">
                    {t((SECT_BY_KEY[selected.sect] || DEFAULT_SECT).labelKey)} ·{" "}
                    {t("common.level")} {selected.level} · {formatDateTime(selected.createdAt, language)}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right panel: character slots, or the "Tạo mới" form */}
          <div className="jx2-cs-panel">
            {mode === "create" ? (
              <form className="jx2-cs-create" onSubmit={handleCreate}>
                <div className="jx2-cs-panel-title">{t("characterSelect.create")}</div>

                <div className="jx2-cs-portraits">
                  {SECTS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      className={`jx2-cs-portrait-tile sect-${p.key} ${
                        p.key === sectKey ? "selected" : ""
                      }`}
                      onClick={() => setSectKey(p.key)}
                      title={t(p.labelKey)}
                    >
                      <span className="jx2-cs-portrait-tile-glyph">{p.glyph}</span>
                      <span className="jx2-cs-portrait-tile-label">{t(p.labelKey)}</span>
                    </button>
                  ))}
                </div>

                <label className="jx2-form-label" htmlFor="jx2-character-name">
                  {t("characterSelect.nameLabel")}
                </label>
                <input
                  id="jx2-character-name"
                  type="text"
                  className="jx2-form-input"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder={t("characterSelect.namePlaceholder")}
                  maxLength={NAME_MAX}
                  autoFocus
                />
                <div className="jx2-cs-create-hint">
                  {t("characterSelect.nameHint", { min: NAME_MIN, max: NAME_MAX })}
                </div>

                <div className="jx2-cs-create-actions">
                  <button type="submit" className="jx2-btn-action" disabled={busy}>
                    {busy ? t("common.wait") : t("characterSelect.agree")}
                  </button>
                  <button
                    type="button"
                    className="jx2-btn-action secondary"
                    onClick={handleCancelCreate}
                    disabled={busy}
                  >
                    {t("common.back")}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="jx2-cs-panel-title">{t("characterSelect.characterList")}</div>
                <div className="jx2-cs-slots">
                  {slots.map((char, index) => (
                    <button
                      key={char ? char.id : `empty-${index}`}
                      type="button"
                      className={`jx2-cs-slot ${char ? "filled" : "empty"} ${
                        char && char.id === selectedId ? "selected" : ""
                      }`}
                      onClick={() => {
                        if (char) {
                          setSelectedId(char.id);
                          setError("");
                        }
                      }}
                      disabled={!char || busy}
                    >
                      {char ? (
                        <>
                          <span className="jx2-cs-slot-name">{char.name}</span>
                          <span className="jx2-cs-slot-info">
                            {t((SECT_BY_KEY[char.sect] || DEFAULT_SECT).labelKey)} ·{" "}
                            {t("common.level")} {char.level}
                          </span>
                          <span className="jx2-cs-slot-date">{formatDateTime(char.createdAt, language)}</span>
                        </>
                      ) : (
                        <span className="jx2-cs-slot-empty">{t("characterSelect.emptySlot")}</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="jx2-cs-actions">
                  <button
                    type="button"
                    className="jx2-btn-action"
                    onClick={handleOpenCreate}
                    disabled={busy || characters.length >= maxSlots}
                  >
                    {t("characterSelect.createCharacter")}
                  </button>
                  <button
                    type="button"
                    className="jx2-btn-action"
                    onClick={handleDelete}
                    disabled={busy || !selected}
                  >
                    {t("characterSelect.deleteCharacter")}
                  </button>
                  <button
                    type="button"
                    className="jx2-btn-action secondary"
                    onClick={onLogout}
                    disabled={busy}
                  >
                    {t("common.back")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {mode !== "create" && (
          <button
            type="button"
            className="jx2-cs-start"
            onClick={handleStart}
            disabled={busy || !selected}
          >
            {t("characterSelect.start")}
          </button>
        )}
      </div>
    </div>
  );
}
