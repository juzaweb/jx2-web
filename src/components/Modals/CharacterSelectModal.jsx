import React, { useState, useEffect, useCallback } from "react";
import { apiClient } from "../../game/apiClient.js";
import "../../styles/character-select.css";

const NAME_MIN = 2;
const NAME_MAX = 16;

/**
 * Character creation portraits. Each tile maps to a gender; the tile index is
 * stored as the character's appearance so the chosen face can be restored.
 */
const PORTRAITS = [
  { index: 0, gender: "nam", label: "Nam", glyph: "♂" },
  { index: 1, gender: "nam", label: "Nam", glyph: "♂" },
  { index: 2, gender: "nu", label: "Nữ", glyph: "♀" },
  { index: 3, gender: "nu", label: "Nữ", glyph: "♀" }
];

const GENDER_LABEL = { nam: "Nam", nu: "Nữ" };

/**
 * Format an epoch millisecond timestamp into a short Vietnamese date-time.
 * @param {number} ts
 * @returns {string}
 */
const formatDateTime = (ts) => {
  if (!ts || typeof ts !== "number") return "";
  try {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
};

export function CharacterSelectModal({ isOpen, user, server, onStart, onLogout }) {
  if (!isOpen) return null;

  const [characters, setCharacters] = useState([]);
  const [maxSlots, setMaxSlots] = useState(3);
  const [deletedCount, setDeletedCount] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [mode, setMode] = useState("select"); // "select" | "create"
  const [nameInput, setNameInput] = useState("");
  const [portraitIndex, setPortraitIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const applyData = useCallback((data) => {
    const list = Array.isArray(data?.characters) ? data.characters : [];
    setCharacters(list);
    if (typeof data?.maxSlots === "number") setMaxSlots(data.maxSlots);
    setDeletedCount(typeof data?.deletedCount === "number" ? data.deletedCount : 0);
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
        if (isMounted) setError(err.message || "Không tải được danh sách nhân vật.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, user?.id, reload]);

  const selected = characters.find((c) => c.id === selectedId) || null;
  const activePortrait = PORTRAITS.find((p) => p.index === portraitIndex) || PORTRAITS[0];

  const handleOpenCreate = () => {
    setMode("create");
    setNameInput("");
    setPortraitIndex(0);
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
      setError(`Tên nhân vật phải gồm ${NAME_MIN}-${NAME_MAX} ký tự.`);
      return;
    }

    setBusy(true);
    try {
      const data = await apiClient.createCharacter(
        user.id,
        cleanName,
        activePortrait.gender,
        activePortrait.index
      );
      const createdId = data?.character?.id;
      await reload();
      if (createdId) setSelectedId(createdId);
      setMode("select");
      setNameInput("");
      setNotice(`Đã tạo nhân vật "${data?.character?.name || cleanName}".`);
    } catch (err) {
      setError(err.message || "Không thể tạo nhân vật. Vui lòng thử lại!");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) {
      setError("Vui lòng chọn một nhân vật để xoá.");
      return;
    }
    if (!window.confirm(`Bạn có chắc muốn xoá nhân vật "${selected.name}" không?`)) return;

    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiClient.deleteCharacter(user.id, selected.id);
      await reload();
      setNotice(`Đã xoá nhân vật "${selected.name}". Bạn có thể khôi phục lại.`);
    } catch (err) {
      setError(err.message || "Không thể xoá nhân vật.");
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await apiClient.restoreCharacter(user.id);
      await reload();
      if (data?.character?.id) setSelectedId(data.character.id);
      setNotice(`Đã khôi phục nhân vật "${data?.character?.name || ""}".`);
    } catch (err) {
      setError(err.message || "Không có nhân vật để khôi phục.");
    } finally {
      setBusy(false);
    }
  };

  const handleStart = () => {
    if (!selected) {
      setError("Vui lòng chọn hoặc tạo một nhân vật trước khi bắt đầu.");
      return;
    }
    onStart(selected);
  };

  const slots = Array.from({ length: maxSlots }, (_, i) => characters[i] || null);

  return (
    <div className="jx2-login-overlay" id="jx2-character-overlay">
      {/* Top status bar: account + server, mirroring the in-game header */}
      <div className="jx2-cs-topbar">
        <span className="jx2-cs-topbar-user">Tài khoản: {user?.username}</span>
        <span className="jx2-cs-topbar-server">Máy chủ: {server || "Trường An"}</span>
      </div>

      <div className="jx2-cs-box">
        <div className="jx2-cs-title">{mode === "create" ? "Tạo mới" : "Chọn nhân vật"}</div>

        {error && <div className="jx2-alert-banner error">{error}</div>}
        {notice && <div className="jx2-alert-banner success">{notice}</div>}

        <div className="jx2-cs-body">
          {/* Center stage: selected character / new-character preview */}
          <div className="jx2-cs-stage">
            {mode === "create" ? (
              <>
                <div className={`jx2-cs-portrait ${activePortrait.gender}`}>
                  <span className="jx2-cs-portrait-glyph">{activePortrait.glyph}</span>
                </div>
                <div className="jx2-cs-stage-name">
                  {nameInput.trim() || "Nhân vật mới"}
                </div>
                <div className="jx2-cs-stage-meta">Giới tính: {GENDER_LABEL[activePortrait.gender]}</div>
              </>
            ) : (
              <>
                <div className={`jx2-cs-portrait ${selected?.gender || ""}`}>
                  {selected ? (
                    <span className="jx2-cs-portrait-glyph">
                      {selected.gender === "nu" ? "♀" : "♂"}
                    </span>
                  ) : (
                    <span className="jx2-cs-portrait-glyph empty">?</span>
                  )}
                </div>
                <div className="jx2-cs-stage-name">
                  {selected ? selected.name : loading ? "Đang tải..." : "Chưa có nhân vật"}
                </div>
                {selected && (
                  <div className="jx2-cs-stage-meta">
                    {GENDER_LABEL[selected.gender] || "Nam"} · Cấp {selected.level} ·{" "}
                    {formatDateTime(selected.createdAt)}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right panel: character slots, or the "Tạo mới" form */}
          <div className="jx2-cs-panel">
            {mode === "create" ? (
              <form className="jx2-cs-create" onSubmit={handleCreate}>
                <div className="jx2-cs-panel-title">Tạo mới</div>

                <div className="jx2-cs-portraits">
                  {PORTRAITS.map((p) => (
                    <button
                      key={p.index}
                      type="button"
                      className={`jx2-cs-portrait-tile ${p.gender} ${
                        p.index === portraitIndex ? "selected" : ""
                      }`}
                      onClick={() => setPortraitIndex(p.index)}
                      title={`Ngoại hình ${p.label} ${p.index + 1}`}
                    >
                      <span className="jx2-cs-portrait-tile-glyph">{p.glyph}</span>
                      <span className="jx2-cs-portrait-tile-label">{p.label}</span>
                    </button>
                  ))}
                </div>

                <label className="jx2-form-label" htmlFor="jx2-character-name">
                  Tên:
                </label>
                <input
                  id="jx2-character-name"
                  type="text"
                  className="jx2-form-input"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Nhập tên nhân vật"
                  maxLength={NAME_MAX}
                  autoFocus
                />
                <div className="jx2-cs-create-hint">
                  {NAME_MIN}-{NAME_MAX} ký tự chữ, số, khoảng trắng, gạch ngang hoặc gạch dưới.
                </div>

                <div className="jx2-cs-create-actions">
                  <button type="submit" className="jx2-btn-action" disabled={busy}>
                    {busy ? "Chờ..." : "Đồng ý"}
                  </button>
                  <button
                    type="button"
                    className="jx2-btn-action secondary"
                    onClick={handleCancelCreate}
                    disabled={busy}
                  >
                    Trở lại
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="jx2-cs-panel-title">Danh sách nhân vật</div>
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
                            {GENDER_LABEL[char.gender] || "Nam"} · Cấp {char.level}
                          </span>
                          <span className="jx2-cs-slot-date">{formatDateTime(char.createdAt)}</span>
                        </>
                      ) : (
                        <span className="jx2-cs-slot-empty">(Trống)</span>
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
                    Tạo mới nhân vật
                  </button>
                  <button
                    type="button"
                    className="jx2-btn-action"
                    onClick={handleDelete}
                    disabled={busy || !selected}
                  >
                    Xoá nhân vật
                  </button>
                  <button
                    type="button"
                    className="jx2-btn-action"
                    onClick={handleRestore}
                    disabled={busy || deletedCount === 0}
                  >
                    Khôi phục nhân vật
                  </button>
                  <button
                    type="button"
                    className="jx2-btn-action secondary"
                    onClick={onLogout}
                    disabled={busy}
                  >
                    Trở lại
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
            Bắt đầu
          </button>
        )}
      </div>
    </div>
  );
}
