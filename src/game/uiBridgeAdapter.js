import { bridge, EVENTS } from "./bridge.js";
import { applyQuantities, getQuantities } from "./items.js";
import { CITY_AVENUES, CITY_BUILDINGS } from "./worldConfig.js";

/** The local radar shows one tenth of the city's area. */
const MINIMAP_SPAN_RATIO = 1 / Math.sqrt(10);

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

    // The minimap is a local radar: it follows the player and only covers about
    // one tenth of the walled city's area, so Biện Kinh feels as large as the
    // classic VLTK2 maps. Without city bounds (tests/other regions) it shows the
    // whole world instead.
    const city = worldConfig.cityBounds || {
      x0: 0,
      y0: 0,
      x1: worldConfig.width,
      y1: worldConfig.height
    };
    let view;
    if (worldConfig.cityBounds) {
      // Equal spans on each axis would be area/10; keeping the city aspect here
      // preserves the proportions of the region on screen.
      const spanX = (city.x1 - city.x0) * MINIMAP_SPAN_RATIO;
      const spanY = (city.y1 - city.y0) * MINIMAP_SPAN_RATIO;
      view = {
        x0: player.x - spanX / 2,
        y0: player.y - spanY / 2,
        x1: player.x + spanX / 2,
        y1: player.y + spanY / 2
      };
    } else {
      view = { x0: 0, y0: 0, x1: worldConfig.width, y1: worldConfig.height };
    }

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
    // Marker sizes track the canvas resolution so the full-city modal stays legible.
    const mark = Math.max(1, w / 220);

    const cityX = mapX(city.x0);
    const cityY = mapY(city.y0);
    const cityW = (city.x1 - city.x0) * scaleX;
    const cityH = (city.y1 - city.y0) * scaleY;

    // 1. Forest ring around the ramparts
    ctx.fillStyle = "#1e3324";
    ctx.fillRect(0, 0, w, h);

    // 2. Inner city stone ground
    ctx.fillStyle = "#4a4237";
    ctx.fillRect(cityX, cityY, cityW, cityH);

    // 3. Paving grid (subtle texture, mirrors the 76-unit floor tiles)
    ctx.strokeStyle = "rgba(184, 176, 161, 0.22)";
    ctx.lineWidth = Math.max(0.5, 0.5 * mark);
    ctx.beginPath();
    for (let gx = city.x0; gx <= city.x1; gx += 152) {
      ctx.moveTo(mapX(gx), cityY);
      ctx.lineTo(mapX(gx), cityY + cityH);
    }
    for (let gy = city.y0; gy <= city.y1; gy += 152) {
      ctx.moveTo(cityX, mapY(gy));
      ctx.lineTo(cityX + cityW, mapY(gy));
    }
    ctx.stroke();

    // 4. Paved avenues
    const avenueH = CITY_AVENUES.horizontal;
    const avenueV = CITY_AVENUES.vertical;
    ctx.fillStyle = "rgba(105, 95, 78, 0.85)";
    ctx.fillRect(mapX(city.x0), mapY(avenueH.y), cityW, avenueH.height * scaleY);
    ctx.fillRect(mapX(avenueV.x), mapY(city.y0), avenueV.width * scaleX, cityH);

    // 5. City walls outline
    ctx.strokeStyle = "#80735a";
    ctx.lineWidth = Math.max(1.5, 0.7 * mark);
    ctx.beginPath();
    ctx.moveTo(cityX, cityY);
    ctx.lineTo(cityX + cityW, cityY);
    ctx.lineTo(cityX + cityW, cityY + cityH);
    ctx.lineTo(cityX, cityY + cityH);
    ctx.closePath();
    ctx.stroke();

    // 6. Building footprints (shared with the Phaser scene)
    ctx.fillStyle = "#33261c";
    CITY_BUILDINGS.forEach(({ x, y, w: bw, d: bh }) => {
      ctx.fillRect(mapX(x), mapY(y), bw * scaleX, bh * scaleY);
    });

    // 7. Vạn Sự Thông Pavilion (green point)
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(mapX(1160), mapY(440), 3.5 * mark, 0, Math.PI * 2);
    ctx.fill();

    // 8. Central plaza around the spawn point
    ctx.fillStyle = "rgba(122, 112, 94, 0.8)";
    ctx.beginPath();
    ctx.arc(mapX(1100), mapY(620), 80 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // Enemies (Red radar blips)
    if (enemies && enemies.length) {
      enemies.forEach((wolf) => {
        if (!wolf.active || wolf.isDead) return;
        ctx.fillStyle = "#ff4d4f";
        ctx.beginPath();
        ctx.arc(mapX(wolf.x), mapY(wolf.y), 2.5 * mark, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Remote Players (Cyan radar blips)
    if (remotePlayers && remotePlayers.length) {
      remotePlayers.forEach((rp) => {
        // A RemotePlayer renders through `container` (it has no physics `sprite`);
        // a destroyed one has already nulled it.
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

    // Player position (Golden yellow glowing beacon)
    const px = mapX(player.x);
    const py = mapY(player.y);

    // Player sight radius
    ctx.fillStyle = "rgba(255, 215, 0, 0.18)";
    ctx.beginPath();
    ctx.arc(px, py, 10 * mark, 0, Math.PI * 2);
    ctx.fill();

    // Player center dot
    ctx.fillStyle = "#ffdd59";
    ctx.beginPath();
    ctx.arc(px, py, 3.5 * mark, 0, Math.PI * 2);
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
