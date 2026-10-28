import { bridge, EVENTS } from "./bridge.js";
import { applyQuantities, getQuantities } from "./items.js";

export class UIBridgeAdapter {
  constructor() {
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
   * Push the current active target vitals to the React HUD.
   * @param {{ id: number|string, name: string, level?: number, hp: number, maxHp: number, kind?: string, isBoss?: boolean }|null} target
   */
  updateTarget(target) {
    bridge.emit(EVENTS.TARGET_UPDATED, target ? { ...target } : null);
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
      remotePlayers,
      buildings: worldConfig.buildings || [],
      trees: worldConfig.trees || [],
      walls: worldConfig.walls || [],
      portals: worldConfig.portals || [],
      streets: worldConfig.streets || []
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
      remotePlayers,
      buildings: worldConfig.buildings || [],
      trees: worldConfig.trees || [],
      walls: worldConfig.walls || [],
      portals: worldConfig.portals || [],
      streets: worldConfig.streets || []
    });
  }

  /**
   * Render one map view (terrain, walls, buildings, blips) into a canvas.
   * Shared by the local radar and the full-city modal.
   * @param {CanvasRenderingContext2D} ctx
   * @param {HTMLCanvasElement} canvas
   * @param {{view: object, city: object, player: object, enemies: Array<object>, remotePlayers: Array<object>, buildings?: Array<object>, trees?: Array<Array<number|string>>, walls?: Array<object>, portals?: Array<object>}} frame
   */
  drawMap(
    ctx,
    canvas,
    {
      view,
      city,
      player,
      enemies,
      remotePlayers,
      buildings = [],
      trees = [],
      walls = [],
      portals = [],
      streets = []
    }
  ) {
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
    const bx = mapX(city.x0);
    const by = mapY(city.y0);
    const bw = (city.x1 - city.x0) * scaleX;
    const bh = (city.y1 - city.y0) * scaleY;
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

    // Streets and walkways connecting city gates and areas.
    ctx.fillStyle = "rgba(224, 218, 204, 0.45)";
    streets.forEach((st) => {
      ctx.fillRect(
        mapX(st.x),
        mapY(st.y),
        Math.max(2, (st.w || 0) * scaleX),
        Math.max(2, (st.d || 0) * scaleY)
      );
    });

    // Town walls first, so buildings and blips draw on top of them.
    ctx.fillStyle = "#565b63";
    walls.forEach((wall) => {
      ctx.fillRect(
        mapX(wall.x),
        mapY(wall.y),
        Math.max(1, wall.w * scaleX),
        Math.max(1, wall.h * scaleY)
      );
    });

    // Landmarks: shop buildings and their collision footprint.
    buildings.forEach((def) => {
      ctx.fillStyle = "#4a3320";
      ctx.fillRect(
        mapX(def.x - def.w / 2),
        mapY(def.y - def.d / 2),
        Math.max(2, def.w * scaleX),
        Math.max(2, def.d * scaleY)
      );
    });

    // Trees.
    ctx.fillStyle = "#3c7347";
    trees.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(mapX(x), mapY(y), 1.8 * mark, 0, Math.PI * 2);
      ctx.fill();
    });

    // Travel portals (pale blue) so the player can find the way out.
    ctx.fillStyle = "rgba(159, 232, 255, 0.55)";
    portals.forEach(({ rect }) => {
      if (!rect) return;
      ctx.fillRect(
        mapX(rect.x),
        mapY(rect.y),
        Math.max(2, rect.w * scaleX),
        Math.max(2, rect.h * scaleY)
      );
    });

    // Enemies (red blips; bosses read bigger).
    if (enemies && enemies.length) {
      enemies.forEach((enemy) => {
        if (!enemy.active || enemy.isDead) return;
        ctx.fillStyle = enemy.isBoss ? "#ff9f1a" : "#ff4d4f";
        ctx.beginPath();
        ctx.arc(mapX(enemy.x), mapY(enemy.y), (enemy.isBoss ? 4 : 2.5) * mark, 0, Math.PI * 2);
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
