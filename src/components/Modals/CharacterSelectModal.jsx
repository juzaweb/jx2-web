import React, { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "../../game/apiClient.js";
import "../../styles/character-select.css";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { LanguageSwitcher } from "../LanguageSwitcher.jsx";
import { LobbyScene } from "../LobbyScene.jsx";
import { SERVER_NAME } from "../../game/serverConfig.js";
import { readSession } from "../../game/session.js";
import { DEFAULT_FACTION, FACTIONS, FACTION_IDS, normalizeFaction } from "../../game/factions.js";

const NAME_MIN = 2;
const NAME_MAX = 16;

/**
 * Character creation choices: a name and a gender. Sects are gone; every hero
 * starts with a sword and the Kiếm Khí skill, then learns other weapon skills
 * from books dropped by monsters.
 */
const GENDERS = [
  { key: "male", labelKey: "characterSelect.genderMale", glyph: "男" },
  { key: "female", labelKey: "characterSelect.genderFemale", glyph: "女" }
];

const GENDER_BY_KEY = Object.fromEntries(GENDERS.map((gender) => [gender.key, gender]));
const DEFAULT_GENDER = GENDERS[0];

/** Faction choices, in catalog order. */
const FACTION_LIST = FACTION_IDS.map((id) => FACTIONS[id]);

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

export function CharacterSelectModal({ isOpen, user, onStart, onLogout }) {
  const { t, language } = useI18n();
  const tRef = useRef(t);
  const [characters, setCharacters] = useState([]);
  const [maxSlots, setMaxSlots] = useState(3);
  const [selectedId, setSelectedId] = useState("");
  const [mode, setMode] = useState("select"); // "select" | "create"
  const [nameInput, setNameInput] = useState("");
  const [genderKey, setGenderKey] = useState(DEFAULT_GENDER.key);
  const [factionKey, setFactionKey] = useState(DEFAULT_FACTION);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
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
    setLoadError(null);
    const data = await apiClient.listCharacters(user.id, user?.token || readSession()?.token);
    applyData(data);
    return data;
  }, [user?.id, applyData]);

  useEffect(() => {
    if (!isOpen || !user?.id) return;
    let isMounted = true;

    setLoading(true);
    setError("");
    setLoadError(null);
    reload()
      .catch((err) => {
        console.error("Failed to load character list:", err);
        const errObj = {
          message: err.message || tRef.current("characterSelect.errors.load"),
          status: err.status
        };
        if (isMounted) {
          setLoadError(errObj);
          setError(errObj.message);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, user?.id, reload]);

  const selected = characters.find((c) => c.id === selectedId) || null;
  const activeGender = GENDER_BY_KEY[genderKey] || DEFAULT_GENDER;
  const activeFaction = FACTIONS[normalizeFaction(factionKey)] || FACTIONS[DEFAULT_FACTION];
  const selectedGender = selected ? GENDER_BY_KEY[selected.gender] || DEFAULT_GENDER : null;
  const selectedFaction = selected
    ? FACTIONS[normalizeFaction(selected.faction)] || FACTIONS[DEFAULT_FACTION]
    : null;

  const handleOpenCreate = () => {
    setMode("create");
    setNameInput("");
    setGenderKey(DEFAULT_GENDER.key);
    setFactionKey(DEFAULT_FACTION);
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
        activeGender.key,
        user?.token || readSession()?.token,
        factionKey
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
      await apiClient.deleteCharacter(user.id, selected.id, user?.token || readSession()?.token);
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
    onStart(selected);
  };

  const slots = Array.from({ length: maxSlots }, (_, i) => characters[i] || null);

  if (!isOpen) return null;

  return (
    <div className="jx2-login-overlay" id="jx2-character-overlay">
      <LobbyScene />
      <LanguageSwitcher variant="character" />

      {/* Top status bar: account + server, mirroring the in-game header */}
      <div className="jx2-cs-topbar">
        <span className="jx2-cs-topbar-user">{t("characterSelect.account")}: {user?.username}</span>
        <span className="jx2-cs-topbar-server">{t("characterSelect.server")}: {SERVER_NAME}</span>
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
                <div className={`jx2-cs-portrait gender-${activeGender.key}`}>
                  <span className="jx2-cs-portrait-glyph">{activeGender.glyph}</span>
                </div>
                <div className="jx2-cs-stage-name">
                  {nameInput.trim() || t("characterSelect.newCharacter")}
                </div>
                <div className="jx2-cs-stage-meta">
                  {t(activeGender.labelKey)} · {t(`characterSelect.factions.${activeFaction.id}`)}
                </div>
              </>
            ) : (
              <>
                <div className={`jx2-cs-portrait ${selectedGender ? `gender-${selectedGender.key}` : ""}`}>
                  {selectedGender ? (
                    <span className="jx2-cs-portrait-glyph">{selectedGender.glyph}</span>
                  ) : (
                    <span className="jx2-cs-portrait-glyph empty">?</span>
                  )}
                </div>
                <div className="jx2-cs-stage-name">
                  {selected
                    ? selected.name
                    : loading
                    ? t("characterSelect.loading")
                    : loadError
                    ? t("characterSelect.errors.load")
                    : t("characterSelect.noCharacters")}
                </div>
                {selected && (
                  <div className="jx2-cs-stage-meta">
                    {t((GENDER_BY_KEY[selected.gender] || DEFAULT_GENDER).labelKey)} ·{" "}
                    {selectedFaction ? t(`characterSelect.factions.${selectedFaction.id}`) : ""} ·{" "}
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
                  {GENDERS.map((gender) => (
                    <button
                      key={gender.key}
                      type="button"
                      className={`jx2-cs-portrait-tile gender-${gender.key} ${
                        gender.key === genderKey ? "selected" : ""
                      }`}
                      onClick={() => setGenderKey(gender.key)}
                      title={t(gender.labelKey)}
                    >
                      <span className="jx2-cs-portrait-tile-glyph">{gender.glyph}</span>
                      <span className="jx2-cs-portrait-tile-label">{t(gender.labelKey)}</span>
                    </button>
                  ))}
                </div>

                <label className="jx2-form-label">{t("characterSelect.factionLabel")}</label>
                <div className="jx2-cs-factions">
                  {FACTION_LIST.map((faction) => (
                    <button
                      key={faction.id}
                      type="button"
                      className={`jx2-cs-faction-tile faction-${faction.id} ${
                        faction.id === activeFaction.id ? "selected" : ""
                      }`}
                      onClick={() => setFactionKey(faction.id)}
                      title={t(`characterSelect.factions.${faction.id}`)}
                    >
                      <span className="jx2-cs-faction-glyph">{faction.glyph}</span>
                      <span className="jx2-cs-faction-label">
                        {t(`characterSelect.factions.${faction.id}`)}
                      </span>
                      <span className="jx2-cs-faction-city">
                        {t(`maps.${faction.homeMapId}`, undefined, faction.cityName)}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="jx2-cs-create-hint">{t("characterSelect.factionHint")}</div>

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
                {loadError ? (
                  <div className="jx2-cs-load-error">
                    <p className="jx2-cs-error-text">
                      {loadError.status === 401
                        ? t("characterSelect.errors.sessionExpired")
                        : loadError.message || t("characterSelect.errors.loadRetry")}
                    </p>
                    {loadError.status === 401 ? (
                      <button
                        type="button"
                        className="jx2-btn-action"
                        onClick={onLogout}
                      >
                        {t("characterSelect.relogin")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="jx2-btn-action"
                        onClick={() => {
                          setLoading(true);
                          setError("");
                          setLoadError(null);
                          reload()
                            .catch((err) => {
                              const errObj = {
                                message: err.message || tRef.current("characterSelect.errors.load"),
                                status: err.status
                              };
                              setLoadError(errObj);
                              setError(errObj.message);
                            })
                            .finally(() => setLoading(false));
                        }}
                      >
                        {t("characterSelect.retry")}
                      </button>
                    )}
                  </div>
                ) : (
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
                              {t((GENDER_BY_KEY[char.gender] || DEFAULT_GENDER).labelKey)} ·{" "}
                              {t(`characterSelect.factions.${normalizeFaction(char.faction)}`)} ·{" "}
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
                )}

                <div className="jx2-cs-actions">
                  <button
                    type="button"
                    className="jx2-btn-action"
                    onClick={handleOpenCreate}
                    disabled={busy || !!loadError || characters.length >= maxSlots}
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
