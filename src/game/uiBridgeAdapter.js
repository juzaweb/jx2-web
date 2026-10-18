import { bridge, EVENTS } from "./bridge.js";
import { applyQuantities, getQuantities } from "./items.js";

export class UIBridgeAdapter {
  constructor() {
    this.questRewarded = false;
    this.minimapCanvas = null;
    this.minimapCtx = null;
    this.coordsElement = null;

    // Listen for canvas attachment from React Minimap component
    this.unsubMinimap = bridge.on(EVENTS.ACTION_REGISTER_MINIMAP, (registration) => {
      this.attachMinimap(registration);
    });

    // React effects run before Phaser's first frame, so the MinimapPanel may have
    // already fired its one-shot registration before this adapter existed and the
    // event was dropped. Ask any mounted panel to (re)send its canvas.
    bridge.emit(EVENTS.ACTION_REQUEST_MINIMAP);
  }

  /**
   * Bind the React minimap canvas/coords nodes for drawing.
   * @param {{canvas?: HTMLCanvasElement, coordsEl?: HTMLElement}|null} registration
   */
  attachMinimap(registration) {
    const canvas = registration?.canvas;
    this.minimapCanvas = canvas || null;
    this.minimapCtx = canvas ? canvas.getContext("2d") : null;
    this.coordsElement = registration?.coordsEl || null;
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

  /**
   * Push the current bag to the React HUD so hotbar / inventory quantities stay
   * live after a use or a loot pickup (the HUD otherwise holds a mount snapshot).
   * @param {Record<string, number>} [quantities] - Defaults to the shared store
   */
  updateInventory(quantities) {
    const { quickItems, inventoryItems } = applyQuantities(quantities || getQuantities());
    bridge.emit(EVENTS.INVENTORY_UPDATED, { quickItems, inventoryItems });
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

  drawMinimap(player, enemies, worldConfig, remotePlayers = []) {
    if (!this.minimapCtx || !player || !worldConfig) return;

    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    const scaleX = w / worldConfig.width;
    const scaleY = h / worldConfig.height;

    // 1. Countryside outskirts
    ctx.fillStyle = "#1e3324";
    ctx.fillRect(0, 0, w, h);

    // 2. Moat water surrounding the city
    ctx.fillStyle = "#275560";
    ctx.fillRect(220 * scaleX, 130 * scaleY, 50 * scaleX, 990 * scaleY); // West
    ctx.fillRect(220 * scaleX, 1110 * scaleY, 1750 * scaleX, 50 * scaleY); // South
    ctx.fillRect(1940 * scaleX, 130 * scaleY, 50 * scaleX, 990 * scaleY); // East

    // 3. Inner city stone ground
    ctx.fillStyle = "#4a4237";
    ctx.fillRect(280 * scaleX, 150 * scaleY, 1660 * scaleX, 950 * scaleY);

    // 4. Imperial Palace royal courtyard
    ctx.fillStyle = "#692e24";
    ctx.fillRect(1440 * scaleX, 160 * scaleY, 480 * scaleX, 360 * scaleY);

    // 5. City walls outline
    ctx.strokeStyle = "#80735a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(280 * scaleX, 150 * scaleY);
    ctx.lineTo(1940 * scaleX, 150 * scaleY);
    ctx.lineTo(1940 * scaleX, 1100 * scaleY);
    ctx.lineTo(280 * scaleX, 1100 * scaleY);
    ctx.closePath();
    ctx.stroke();

    // 6. Paved avenues
    ctx.fillStyle = "#695f4e";
    // West-East Main Avenue
    ctx.fillRect(280 * scaleX, 575 * scaleY, 1660 * scaleX, 90 * scaleY);
    // South-North Avenue
    ctx.fillRect(955 * scaleX, 620 * scaleY, 90 * scaleX, 480 * scaleY);
    ctx.fillRect(1040 * scaleX, 260 * scaleY, 90 * scaleX, 360 * scaleY);

    // 7. Central Plaza
    ctx.fillStyle = "#7a705e";
    ctx.beginPath();
    ctx.arc(1100 * scaleX, 620 * scaleY, 80 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // 8. Key building footprints
    ctx.fillStyle = "#33261c";
    // Dược Điếm (Top-left plaza)
    ctx.fillRect(250 * scaleX, 220 * scaleY, 380 * scaleX, 260 * scaleY);
    // Tiền Trang (North-East)
    ctx.fillRect(1520 * scaleX, 260 * scaleY, 260 * scaleX, 140 * scaleY);
    // Tiểu Viễn Lâu (South-West)
    ctx.fillRect(160 * scaleX, 940 * scaleY, 220 * scaleX, 160 * scaleY);
    // Võ Quán (South-East)
    ctx.fillRect(1600 * scaleX, 780 * scaleY, 260 * scaleX, 160 * scaleY);
    // Imperial Palace
    ctx.fillStyle = "#b45309";
    ctx.fillRect(1580 * scaleX, 180 * scaleY, 310 * scaleX, 150 * scaleY); // Hoàng Cung

    // 9. Vạn Sự Thông Pavilion (Green point)
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(1160 * scaleX, 440 * scaleY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // 10. Bridges
    ctx.fillStyle = "#877f72";
    ctx.fillRect(205 * scaleX, 575 * scaleY, 75 * scaleX, 90 * scaleY);
    ctx.fillRect(955 * scaleX, 1105 * scaleY, 90 * scaleX, 55 * scaleY);
    ctx.fillRect(1940 * scaleX, 755 * scaleY, 70 * scaleX, 90 * scaleY);

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

    // Remote Players (Cyan radar blips)
    if (remotePlayers && remotePlayers.length) {
      remotePlayers.forEach((rp) => {
        // A RemotePlayer renders through `container` (it has no physics `sprite`);
        // a destroyed one has already nulled it.
        if (!rp.container || !rp.container.active) return;
        const rx = rp.x * scaleX;
        const ry = rp.y * scaleY;

        ctx.fillStyle = "rgba(0, 210, 211, 0.25)";
        ctx.beginPath();
        ctx.arc(rx, ry, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#00d2d3";
        ctx.beginPath();
        ctx.arc(rx, ry, 3, 0, Math.PI * 2);
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
