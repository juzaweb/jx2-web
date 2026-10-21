import { bridge, EVENTS } from "./bridge.js";
import { applyQuantities, getQuantities } from "./items.js";
import {
  MARKET_BOUNDS,
  MARKET_BUILDINGS,
  MARKET_LANTERNS,
  MARKET_TREES
} from "./marketLayout.js";

export class UIBridgeAdapter {
  constructor() {
    this.questRewarded = false;
    this.minimapCanvas = null;
    this.minimapCtx = null;
    this.cityMapCanvas = null;
    this.cityMapCtx = null;
    this.coordsElement = null;

    // Listen for canvas attachment from React Minimap component
    this.unsubMinimap = bridge.on(EVENTS.ACTION_REGISTER_MINIMAP, (registration) => {
      this.attachMinimap(registration);
    });

    // The full-city map modal mounts independently of the scene.
    this.unsubCityMap = bridge.on(EVENTS.ACTION_REGISTER_CITY_MAP, (registration) => {
      this.attachCityMap(registration);
    });

    // React effects run before Phaser's first frame, so the panels may have
    // already fired their one-shot registration before this adapter existed and
    // the event was dropped. Ask any mounted panel to (re)send its canvas.
    bridge.emit(EVENTS.ACTION_REQUEST_MINIMAP);
    bridge.emit(EVENTS.ACTION_REQUEST_CITY_MAP);
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

  /**
   * Bind the full-city map modal canvas.
   * @param {{canvas?: HTMLCanvasElement}|null} registration
   */
  attachCityMap(registration) {
    const canvas = registration?.canvas;
    this.cityMapCanvas = canvas || null;
    this.cityMapCtx = canvas ? canvas.getContext("2d") : null;
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
    const { quickItems, inventoryItems, capacity } = applyQuantities(
      quantities || getQuantities()
    );
    bridge.emit(EVENTS.INVENTORY_UPDATED, { quickItems, inventoryItems, capacity });
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

    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    // The market map is small, so the minimap shows the whole playable area
    // (the yellow dirt rectangle) instead of a cropped local radar.
    const city = worldConfig.cityBounds || {
      x0: 0,
      y0: 0,
      x1: worldConfig.width,
      y1: worldConfig.height
    };
    const view = { x0: city.x0, y0: city.y0, x1: city.x1, y1: city.y1 };

    this.drawMap(this.minimapCtx, this.minimapCanvas, {
      view,
      city,
      player,
      enemies,
      remotePlayers
    });

    // Direct DOM text update for 60fps performance without triggering React re-renders
    if (this.coordsElement) {
      this.coordsElement.textContent = `${Math.floor(player.x)} / ${Math.floor(player.y)}`;
    }
  }

  /**
   * Draw the entire walled city (the M shortcut map) into the modal canvas.
   * @param {object} player
   * @param {Array<object>} [enemies]
   * @param {{cityBounds?: object}} worldConfig
   * @param {Array<object>} [remotePlayers]
   */
  drawCityMap(player, enemies, worldConfig, remotePlayers = []) {
    if (!this.cityMapCtx || !player || !worldConfig?.cityBounds) return;

    const city = worldConfig.cityBounds;
    const padX = (city.x1 - city.x0) * 0.02;
    const padY = (city.y1 - city.y0) * 0.02;
    const view = {
      x0: city.x0 - padX,
      y0: city.y0 - padY,
      x1: city.x1 + padX,
      y1: city.y1 + padY
    };

    this.drawMap(this.cityMapCtx, this.cityMapCanvas, {
      view,
      city,
      player,
      enemies,
      remotePlayers
    });
  }

  /**
   * Render one map view (terrain, walls, buildings, blips) into a canvas.
   * Shared by the local radar and the full-city modal.
   * @param {CanvasRenderingContext2D} ctx
   * @param {HTMLCanvasElement} canvas
   * @param {{view: object, city: object, player: object, enemies: Array<object>, remotePlayers: Array<object>}} frame
   */
  drawMap(ctx, canvas, { view, city, player, enemies, remotePlayers }) {
    const w = canvas.width;
    const h = canvas.height;
    const scaleX = w / (view.x1 - view.x0);
    const scaleY = h / (view.y1 - view.y0);
    const mapX = (gx) => (gx - view.x0) * scaleX;
    const mapY = (gy) => (gy - view.y0) * scaleY;
    const mark = Math.max(1, w / 220);

    // Grass backdrop outside the playable dirt map.
    ctx.fillStyle = "#3f4d35";
    ctx.fillRect(0, 0, w, h);

    // Brick-paved map (same bounds as the physics world).
    const bx = mapX(MARKET_BOUNDS.x0);
    const by = mapY(MARKET_BOUNDS.y0);
    const bw = (MARKET_BOUNDS.x1 - MARKET_BOUNDS.x0) * scaleX;
    const bh = (MARKET_BOUNDS.y1 - MARKET_BOUNDS.y0) * scaleY;
    ctx.fillStyle = "#b3a992";
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = "#5f5340";
    ctx.lineWidth = Math.max(1, 0.7 * mark);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + bw, by);
    ctx.lineTo(bx + bw, by + bh);
    ctx.lineTo(bx, by + bh);
    ctx.closePath();
    ctx.stroke();

    // Landmarks: shops, gate, notice board and market stalls.
    MARKET_BUILDINGS.forEach((def) => {
      ctx.fillStyle =
        def.kind === "gate"
          ? "#a9362f"
          : def.kind === "stall"
            ? "#7f8b90"
            : def.kind === "board"
              ? "#8d2c26"
              : "#4a3320";
      ctx.fillRect(
        mapX(def.x - def.w / 2),
        mapY(def.y - def.d / 2),
        Math.max(2, def.w * scaleX),
        Math.max(2, def.d * scaleY)
      );
    });

    // Trees and stone lanterns.
    ctx.fillStyle = "#3c7347";
    MARKET_TREES.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(mapX(x), mapY(y), 1.8 * mark, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#d8c47a";
    MARKET_LANTERNS.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(mapX(x), mapY(y), 1.2 * mark, 0, Math.PI * 2);
      ctx.fill();
    });

    // Enemies (red blips).
    if (enemies && enemies.length) {
      enemies.forEach((wolf) => {
        if (!wolf.active || wolf.isDead) return;
        ctx.fillStyle = "#ff4d4f";
        ctx.beginPath();
        ctx.arc(mapX(wolf.x), mapY(wolf.y), 2.5 * mark, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Remote players (cyan blips).
    if (remotePlayers && remotePlayers.length) {
      remotePlayers.forEach((rp) => {
        if (!rp.container || !rp.container.active) return;
        const rx = mapX(rp.x);
        const ry = mapY(rp.y);
        ctx.fillStyle = "rgba(0, 210, 211, 0.25)";
        ctx.beginPath();
        ctx.arc(rx, ry, 6 * mark, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#00d2d3";
        ctx.beginPath();
        ctx.arc(rx, ry, 3 * mark, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Local player beacon.
    const lx = mapX(player.x);
    const ly = mapY(player.y);
    ctx.fillStyle = "rgba(255, 215, 0, 0.18)";
    ctx.beginPath();
    ctx.arc(lx, ly, 10 * mark, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffdd59";
    ctx.beginPath();
    ctx.arc(lx, ly, 3.5 * mark, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1, 0.5 * mark);
    ctx.stroke();
  }

  destroy() {
    if (this.unsubMinimap) {
      this.unsubMinimap();
    }
    if (this.unsubCityMap) {
      this.unsubCityMap();
    }
  }
}
