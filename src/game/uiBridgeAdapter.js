import { bridge, EVENTS } from "./bridge.js";

export class UIBridgeAdapter {
  constructor() {
    this.questRewarded = false;
    this.minimapCanvas = null;
    this.minimapCtx = null;
    this.coordsElement = null;

    // Listen for canvas attachment from React Minimap component
    this.unsubMinimap = bridge.on(EVENTS.ACTION_REGISTER_MINIMAP, ({ canvas, coordsEl }) => {
      this.minimapCanvas = canvas;
      this.minimapCtx = canvas ? canvas.getContext("2d") : null;
      this.coordsElement = coordsEl;
    });
  }

  setQuestRewarded(rewarded) {
    this.questRewarded = !!rewarded;
  }

  addLog(message, type = "combat") {
    bridge.emit(EVENTS.LOG_ADDED, {
      id: `${Date.now()}-${Math.random()}`,
      text: message,
      type
    });
  }

  updateHud(stats) {
    if (!stats) return;
    bridge.emit(EVENTS.STATS_UPDATED, { ...stats });
  }

  updateQuest(stats, onQuestComplete) {
    if (!stats) return;
    const progress = Math.min(stats.kills, 3);
    const completed = progress >= 3;

    bridge.emit(EVENTS.QUEST_UPDATED, {
      progress,
      total: 3,
      completed
    });

    if (completed && !this.questRewarded) {
      this.questRewarded = true;
      if (typeof onQuestComplete === "function") {
        onQuestComplete();
      }
    }
  }

  updateSoundButton(isEnabled) {
    bridge.emit(EVENTS.AUDIO_CHANGED, isEnabled);
  }

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

    // Direct DOM text update for 60fps performance without triggering React re-renders
    if (this.coordsElement) {
      this.coordsElement.textContent = `${Math.floor(player.x)} / ${Math.floor(player.y)}`;
    }
  }

  destroy() {
    if (this.unsubMinimap) {
      this.unsubMinimap();
    }
  }
}
