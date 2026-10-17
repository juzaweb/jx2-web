export class UIManager {
  constructor() {
    this.combatLog = document.getElementById("combat-log");
    this.overlay = document.getElementById("overlay");
    this.helpModal = document.getElementById("help-modal");
    this.minimapCanvas = document.getElementById("minimap-canvas");
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext("2d") : null;
    this.coordsText = document.getElementById("coords-text");
    this.questRewarded = false;
    this.currentChatTab = "all";
  }

  /**
   * Set up UI buttons, hotbar slots, minimap, mobile pad, and modals
   * @param {Object} handlers
   * @param {Function} handlers.onStart
   * @param {Function} handlers.onSoundToggle
   * @param {Function} handlers.onMove
   * @param {Function} handlers.onAttack
   * @param {Function} handlers.onSkill
   * @param {Function} handlers.onUseItem
   * @param {Function} [handlers.onPauseChange]
   * @param {Function} [handlers.onSave]
   * @param {Function} [handlers.onReset]
   */
  initControls({
    onStart,
    onSoundToggle,
    onMove,
    onAttack,
    onSkill,
    onUseItem,
    onPauseChange,
    onSave,
    onReset
  }) {
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
    const triggerHelp = () => {
      this.showHelp();
      if (typeof this.onPauseChange === "function") this.onPauseChange(true);
    };

    const dismissHelp = () => {
      this.hideHelp();
      if (typeof this.onPauseChange === "function") this.onPauseChange(false);
    };

    const helpBtn = document.getElementById("help-btn");
    if (helpBtn) helpBtn.addEventListener("click", triggerHelp);

    const mapHelpBtn = document.getElementById("map-help-btn");
    if (mapHelpBtn) mapHelpBtn.addEventListener("click", triggerHelp);

    const closeHelpBtn = document.getElementById("close-help");
    if (closeHelpBtn) closeHelpBtn.addEventListener("click", dismissHelp);

    const resumeBtn = document.getElementById("resume-btn");
    if (resumeBtn) resumeBtn.addEventListener("click", dismissHelp);

    // Save button
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

    // Sound toggle buttons (both top-right minimap and bottom tray)
    const handleSoundToggle = () => {
      if (typeof onSoundToggle === "function") {
        const isEnabled = onSoundToggle();
        this.updateSoundButton(isEnabled);
      }
    };

    const soundBtn = document.getElementById("sound-btn");
    if (soundBtn) soundBtn.addEventListener("click", handleSoundToggle);

    const mapSoundBtn = document.getElementById("map-sound-btn");
    if (mapSoundBtn) mapSoundBtn.addEventListener("click", handleSoundToggle);

    // Inventory button
    const invBtn = document.getElementById("inv-btn");
    if (invBtn) {
      invBtn.addEventListener("click", () => {
        this.addLog("Hành trang: Đang mang theo Kim Sáng Dược, Đại Hoàn Đan và Ngân Lượng.", "system");
      });
    }

    // Hotbar Quick Slots (Potions)
    [1, 2, 3, 4].forEach((slotIndex) => {
      const slotEl = document.getElementById(`slot-${slotIndex}`);
      if (slotEl) {
        slotEl.addEventListener("click", () => {
          if (typeof onUseItem === "function") onUseItem(slotIndex);
        });
      }
    });

    // Hotbar Skill Slot (Slot 8 / Q)
    const slot8 = document.getElementById("slot-8");
    if (slot8) {
      slot8.addEventListener("click", () => {
        if (typeof onSkill === "function") onSkill();
      });
    }

    // Active Martial Arts Boxes (Click to attack / cast)
    const skillAtk = document.getElementById("skill-attack-box");
    if (skillAtk) {
      skillAtk.addEventListener("click", () => {
        if (typeof onAttack === "function") onAttack();
      });
    }

    const skillQ = document.getElementById("skill-q-box");
    if (skillQ) {
      skillQ.addEventListener("click", () => {
        if (typeof onSkill === "function") onSkill();
      });
    }

    // Chat tabs
    document.querySelectorAll(".chat-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".chat-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        this.currentChatTab = tab.dataset.tab;
        this.filterChatMessages(this.currentChatTab);
      });
    });

    // Chat input bar
    const chatInput = document.getElementById("chat-input");
    const sendChatMsg = () => {
      if (!chatInput) return;
      const text = chatInput.value.trim();
      if (!text) return;
      this.addLog(`Lãng Khách: ${text}`, "near");
      chatInput.value = "";
    };

    const chatSendBtn = document.getElementById("chat-send-btn");
    if (chatSendBtn) chatSendBtn.addEventListener("click", sendChatMsg);

    if (chatInput) {
      chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          sendChatMsg();
        }
      });
    }

    // Keyboard ESC shortcut to toggle Help / Pause
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.isHelpOpen()) {
          dismissHelp();
        } else if (!this.isOverlayOpen()) {
          triggerHelp();
        }
      }
    });

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

    // Mobile combat buttons
    const mobileAttack = document.getElementById("mobile-attack");
    if (mobileAttack) {
      mobileAttack.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (typeof onAttack === "function") onAttack();
      });
    }

    const mobileSkill = document.getElementById("mobile-skill");
    if (mobileSkill) {
      mobileSkill.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (typeof onSkill === "function") onSkill();
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

  updateSoundButton(isEnabled) {
    const soundBtn = document.getElementById("sound-btn");
    if (soundBtn) {
      const lbl = soundBtn.querySelector(".sys-lbl");
      if (lbl) lbl.textContent = isEnabled ? "Âm Thanh" : "Tắt Âm";
      soundBtn.style.opacity = isEnabled ? "1" : "0.6";
    }
    const mapSoundBtn = document.getElementById("map-sound-btn");
    if (mapSoundBtn) {
      mapSoundBtn.style.color = isEnabled ? "#ffd43b" : "#888";
    }
  }

  setQuestRewarded(rewarded) {
    this.questRewarded = !!rewarded;
  }

  /**
   * Append a line to the combat / chat feed
   * @param {string} message
   * @param {"system"|"near"|"combat"|"guide"} [type="combat"]
   */
  addLog(message, type = "combat") {
    if (!this.combatLog) return;
    const el = document.createElement("p");
    el.dataset.type = type;

    let tagHtml = `<span class="tag tag-${type}">[${this.getTypeLabel(type)}]</span>`;
    // If message already starts with a tag like [Hệ thống], avoid duplication
    if (message.startsWith("<span class=\"tag")) {
      el.innerHTML = message;
    } else {
      el.innerHTML = `${tagHtml} ${message}`;
    }

    this.combatLog.appendChild(el);
    while (this.combatLog.children.length > 20) {
      this.combatLog.removeChild(this.combatLog.children[0]);
    }
    this.combatLog.scrollTop = this.combatLog.scrollHeight;
  }

  getTypeLabel(type) {
    switch (type) {
      case "system": return "Hệ thống";
      case "near": return "Cận";
      case "combat": return "Chiến đấu";
      case "guide": return "Cẩm nang";
      default: return "Giang hồ";
    }
  }

  filterChatMessages(tab) {
    if (!this.combatLog) return;
    const children = this.combatLog.querySelectorAll("p");
    children.forEach((p) => {
      const pType = p.dataset.type || "combat";
      if (tab === "all") {
        p.style.display = "block";
      } else if (tab === "system" && (pType === "system" || pType === "guide")) {
        p.style.display = "block";
      } else if (tab === "near" && pType === "near") {
        p.style.display = "block";
      } else if (tab === "combat" && pType === "combat") {
        p.style.display = "block";
      } else {
        p.style.display = "none";
      }
    });
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

    // Level Badge (Yellow bold digits)
    setText("level-badge", stats.level);

    // HP Bar
    setText("hp-text", `${stats.hp} / ${stats.maxHp}`);
    setBar("hp-bar", stats.hp / stats.maxHp);

    // MP Bar
    setText("mp-text", `${stats.mp} / ${stats.maxMp}`);
    setBar("mp-bar", stats.mp / stats.maxMp);

    // EXP Bar
    const expPercent = ((stats.exp / stats.nextExp) * 100).toFixed(2);
    setText("exp-text", `${stats.exp} / ${stats.nextExp} (${expPercent}%)`);
    setBar("exp-bar", stats.exp / stats.nextExp);

    // Coins
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

  /**
   * Render real-time minimap radar showing landscape, player, enemies, and coordinates
   * @param {import("./player.js").Player} player
   * @param {Array<import("./enemy.js").Wolf>} enemies
   * @param {{ width: number, height: number }} worldConfig
   */
  drawMinimap(player, enemies, worldConfig) {
    if (!this.minimapCtx || !player || !worldConfig) return;

    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    const scaleX = w / worldConfig.width;
    const scaleY = h / worldConfig.height;

    // Background terrain (Dark ancient earth)
    ctx.fillStyle = "#1e3324";
    ctx.fillRect(0, 0, w, h);

    // Stone road (Central crossway)
    ctx.fillStyle = "#5c5344";
    ctx.fillRect(0, 510 * scaleY, w, 210 * scaleY);

    // River stream
    ctx.fillStyle = "#2c5b66";
    ctx.beginPath();
    ctx.moveTo(0, 925 * scaleY);
    ctx.lineTo(w * 0.3, 910 * scaleY);
    ctx.lineTo(w * 0.6, 950 * scaleY);
    ctx.lineTo(w, 960 * scaleY);
    ctx.lineTo(w, 1080 * scaleY);
    ctx.lineTo(0, 1080 * scaleY);
    ctx.closePath();
    ctx.fill();

    // Buildings footprint (Brown rectangles)
    ctx.fillStyle = "#4a3c2e";
    // Inn (Khách Sạn)
    ctx.fillRect(260 * scaleX, 280 * scaleY, 220 * scaleX, 150 * scaleY);
    // Martial Academy (Võ Quán)
    ctx.fillRect(1510 * scaleX, 260 * scaleY, 230 * scaleX, 160 * scaleY);
    // Apothecary (Dược Điếm)
    ctx.fillRect(900 * scaleX, 220 * scaleY, 180 * scaleX, 130 * scaleY);

    // Enemies (Red radar blips)
    if (enemies && enemies.length) {
      enemies.forEach((wolf) => {
        if (!wolf.active || wolf.isDead) return;
        const ex = wolf.x * scaleX;
        const ey = wolf.y * scaleY;

        ctx.fillStyle = "#ff4d4f";
        ctx.beginPath();
        ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Player position (Golden yellow glowing beacon)
    const px = player.x * scaleX;
    const py = player.y * scaleY;

    // Player sight radius
    ctx.fillStyle = "rgba(255, 215, 0, 0.18)";
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.fill();

    // Player center dot
    ctx.fillStyle = "#ffdd59";
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Update coordinates display (e.g. 640 / 620)
    if (this.coordsText) {
      this.coordsText.textContent = `${Math.floor(player.x)} / ${Math.floor(player.y)}`;
    }
  }
}
