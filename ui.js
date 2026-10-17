export class UIManager {
  constructor() {
    this.combatLog = document.getElementById("combat-log");
    this.overlay = document.getElementById("overlay");
    this.helpModal = document.getElementById("help-modal");
    this.questRewarded = false;
  }

  /**
   * Set up UI buttons, mobile pad, and modals
   * @param {Object} handlers
   * @param {Function} handlers.onStart
   * @param {Function} handlers.onSoundToggle
   * @param {Function} handlers.onMove
   * @param {Function} handlers.onAttack
   * @param {Function} [handlers.onPauseChange]
   * @param {Function} [handlers.onSave]
   * @param {Function} [handlers.onReset]
   */
  initControls({ onStart, onSoundToggle, onMove, onAttack, onPauseChange, onSave, onReset }) {
    this.onPauseChange = onPauseChange;

    // Start Game button
    const startBtn = document.getElementById("start-btn");
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        this.hideOverlay();
        if (typeof onStart === "function") onStart();
      });
    }

    // Help modal buttons
    const helpBtn = document.getElementById("help-btn");
    if (helpBtn) {
      helpBtn.addEventListener("click", () => {
        this.showHelp();
        if (typeof this.onPauseChange === "function") this.onPauseChange(true);
      });
    }

    const closeHelpBtn = document.getElementById("close-help");
    if (closeHelpBtn) {
      closeHelpBtn.addEventListener("click", () => {
        this.hideHelp();
        if (typeof this.onPauseChange === "function") this.onPauseChange(false);
      });
    }

    const resumeBtn = document.getElementById("resume-btn");
    if (resumeBtn) {
      resumeBtn.addEventListener("click", () => {
        this.hideHelp();
        if (typeof this.onPauseChange === "function") this.onPauseChange(false);
      });
    }

    // Manual Save button
    const saveBtn = document.getElementById("save-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        if (typeof onSave === "function") onSave();
      });
    }

    // Reset button
    const resetBtn = document.getElementById("reset-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (typeof onReset === "function") onReset();
      });
    }

    // Keyboard ESC shortcut to toggle Help / Pause
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.isHelpOpen()) {
          this.hideHelp();
          if (typeof this.onPauseChange === "function") this.onPauseChange(false);
        } else if (!this.isOverlayOpen()) {
          this.showHelp();
          if (typeof this.onPauseChange === "function") this.onPauseChange(true);
        }
      }
    });

    // Sound toggle button
    const soundBtn = document.getElementById("sound-btn");
    if (soundBtn) {
      soundBtn.addEventListener("click", (event) => {
        if (typeof onSoundToggle === "function") {
          const isEnabled = onSoundToggle();
          event.currentTarget.innerHTML = `ÂM THANH: <span>${isEnabled ? "ON" : "OFF"}</span>`;
        }
      });
    }

    // Mobile movement buttons
    document.querySelectorAll("[data-move]").forEach((button) => {
      button.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (typeof onMove === "function") onMove(button.dataset.move);
      });

      ["pointerup", "pointerleave", "pointercancel"].forEach((name) => {
        button.addEventListener(name, () => {
          if (typeof onMove === "function") onMove(null);
        });
      });
    });

    // Mobile attack button
    const mobileAttack = document.getElementById("mobile-attack");
    if (mobileAttack) {
      mobileAttack.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (typeof onAttack === "function") onAttack();
      });
    }
  }

  isHelpOpen() {
    return this.helpModal && !this.helpModal.classList.contains("hidden");
  }

  isOverlayOpen() {
    return this.overlay && !this.overlay.classList.contains("hidden");
  }

  hideOverlay() {
    if (this.overlay) {
      this.overlay.classList.add("hidden");
    }
  }

  showHelp() {
    if (this.helpModal) {
      this.helpModal.classList.remove("hidden");
    }
  }

  hideHelp() {
    if (this.helpModal) {
      this.helpModal.classList.add("hidden");
    }
  }

  updateStartButton(text) {
    const startBtn = document.getElementById("start-btn");
    if (startBtn) {
      startBtn.innerHTML = `${text} <span>→</span>`;
    }
  }

  setQuestRewarded(rewarded) {
    this.questRewarded = !!rewarded;
  }

  /**
   * Append a line to the combat feed
   * @param {string} message
   */
  addLog(message) {
    if (!this.combatLog) return;
    const el = document.createElement("p");
    el.textContent = message;
    this.combatLog.appendChild(el);
    while (this.combatLog.children.length > 5) {
      this.combatLog.removeChild(this.combatLog.children[1]);
    }
    this.combatLog.scrollTop = this.combatLog.scrollHeight;
  }

  /**
   * Update HUD elements based on player stats
   * @param {Object} stats
   */
  updateHud(stats) {
    if (!stats) return;

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    const setBar = (id, ratio) => {
      const el = document.getElementById(id);
      if (el) {
        const clamped = Math.max(0, Math.min(1, ratio));
        el.style.width = `${clamped * 100}%`;
      }
    };

    setText("level-label", `Cấp ${stats.level}`);
    setText("hp-text", `${stats.hp} / ${stats.maxHp}`);
    setBar("hp-bar", stats.hp / stats.maxHp);

    setText("mp-text", `${stats.mp} / ${stats.maxMp}`);
    setBar("mp-bar", stats.mp / stats.maxMp);

    setText("exp-text", `${stats.exp} / ${stats.nextExp}`);
    setBar("exp-bar", stats.exp / stats.nextExp);

    setText("coin-label", `BẠC: ${stats.coins}`);

    this.updateQuest(stats);
  }

  /**
   * Update quest information and trigger reward on complete
   * @param {Object} stats
   * @param {Function} [onQuestComplete]
   */
  updateQuest(stats, onQuestComplete) {
    if (!stats) return;

    const progress = Math.min(stats.kills, 3);
    const progressEl = document.getElementById("quest-progress");
    if (progressEl) {
      progressEl.textContent =
        progress >= 3
          ? "Hoàn thành! +50 EXP thưởng"
          : `Tiến độ: ${progress} / 3`;
    }

    const questTextEl = document.getElementById("quest-text");
    if (questTextEl) {
      questTextEl.textContent =
        progress >= 3 ? "Đã hoàn thành nhiệm vụ" : "Tiêu diệt 3 Sói Xám";
    }

    if (progress >= 3 && !this.questRewarded) {
      this.questRewarded = true;
      if (typeof onQuestComplete === "function") {
        onQuestComplete();
      }
    }
  }
}
