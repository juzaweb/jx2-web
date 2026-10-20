import { toIso, isoDepth } from "./isoProjection.js";
import { NPC_DATA, getNpcName, localizeNpc } from "./npcData.js";
import { LANGUAGE_CHANGED_EVENT } from "../i18n/translator.js";
import { WORLD_SCALE } from "./worldConfig.js";
import { createGate, createNoticeBoard, createShop, createStall } from "./marketBuildings.js";
import { createNpc } from "./marketNpcs.js";
import { createBasket, createBarrel, createCrates, createJars, createPine, createSacks, createStoneLantern, createTree } from "./marketProps.js";
import {
  MARKET_BOUNDS,
  MARKET_BUILDINGS,
  MARKET_LANTERNS,
  MARKET_MEDALLIONS,
  MARKET_PLAZA,
  MARKET_PROPS,
  MARKET_TREES
} from "./marketLayout.js";

const S = WORLD_SCALE;
const GROUND_DEPTH = -100000;

/**
 * Renders the compact Biện Kinh market square from the reference screenshot.
 * Same public surface as the previous WorldManager: create(), getObstacles(),
 * getNPCs(), plus the overhead-name language refresh hook.
 */
export class WorldManager {
  /** @param {import("phaser").Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.obstacles = null;
    this.npcs = NPC_DATA;
    this.npcLabels = null;
  }

  create() {
    this.obstacles = this.scene.physics.add.staticGroup();
    this.drawGround();
    this.drawLanterns();
    this.drawBuildings();
    this.drawProps();
    this.drawTrees();
    this.drawNPCs();
    this.drawWorldBorder();
  }

  addBody(cx, cy, w, d) {
    if (!this.obstacles) return null;
    const col = this.obstacles.create(cx, cy, "entity-dot");
    col.setSize(w, d);
    col.setVisible(false);
    col.refreshBody();
    return col;
  }

  drawGround() {
    const g = this.scene.add.graphics().setDepth(GROUND_DEPTH);
    const B = MARKET_BOUNDS;
    const PAD = 320;

    // Grass rim just outside the playable dirt, so camera bounds never show
    // the page background.
    g.fillStyle(0x53603f, 1);
    g.fillRect(B.x0 - PAD, B.y0 - PAD, B.x1 - B.x0 + PAD * 2, B.y1 - B.y0 + PAD * 2);

    // Dry dirt playable area: exactly the map bounds, no larger grass apron.
    g.fillStyle(0x87765a, 1);
    g.fillRect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0);
    g.fillStyle(0x948061, 1);
    g.fillRect(B.x0 + 70, B.y0 + 70, B.x1 - B.x0 - 140, B.y1 - B.y0 - 140);

    const rng = (seed) => {
      const v = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
      return v - Math.floor(v);
    };

    // Dirt mottling and sparse grass inside the playable area.
    for (let i = 0; i < 320; i++) {
      const gx = B.x0 + rng(i * 3.7) * (B.x1 - B.x0);
      const gy = B.y0 + rng(i * 7.1 + 2) * (B.y1 - B.y0);
      if (this.isInsidePlaza(gx, gy, 90)) continue;
      if (i % 4 === 0) {
        g.fillStyle(0x66754a, 0.5);
        g.fillEllipse(gx, gy, 34 + (i % 5) * 8, 16 + (i % 3) * 5);
      } else {
        g.fillStyle(i % 3 ? 0xa18c68 : 0x7c6a4e, 0.45);
        g.fillEllipse(gx, gy, 30 + (i % 4) * 9, 12 + (i % 3) * 4);
      }
    }

    // A few stone chips / pebbles on the dirt.
    for (let i = 0; i < 60; i++) {
      const gx = B.x0 + rng(i * 5.3 + 9) * (B.x1 - B.x0);
      const gy = B.y0 + rng(i * 9.1 + 3) * (B.y1 - B.y0);
      if (this.isInsidePlaza(gx, gy, 60)) continue;
      g.fillStyle(i % 2 ? 0x8e887b : 0x6f695e, 0.85);
      g.fillEllipse(gx, gy, 14 + (i % 4) * 5, 7 + (i % 3) * 3);
    }

    this.drawStonePlaza();
  }

  isInsidePlaza(gx, gy, pad = 0) {
    return (
      gx > MARKET_PLAZA.x - pad &&
      gx < MARKET_PLAZA.x + MARKET_PLAZA.w + pad &&
      gy > MARKET_PLAZA.y - pad &&
      gy < MARKET_PLAZA.y + MARKET_PLAZA.d + pad
    );
  }

  /**
   * Screen-aligned stone paving exactly like the reference: large rectangular
   * bricks in staggered courses, a dark grout base and a raised stone curb.
   */
  drawStonePlaza() {
    const g = this.scene.add.graphics().setDepth(GROUND_DEPTH + 10);
    const { x, y, w, d } = MARKET_PLAZA;

    // Raised stone curb with a dark contact shadow.
    g.fillStyle(0x4f4b41, 1);
    g.fillRect(x - 118, y - 112, w + 236, d + 230);
    g.fillStyle(0x6f695c, 1);
    g.fillRect(x - 92, y - 92, w + 184, d + 184);
    g.fillStyle(0x928b7c, 1);
    g.fillRect(x - 58, y - 58, w + 116, d + 116);
    g.fillStyle(0xa9a292, 1);
    g.fillRect(x - 34, y - 34, w + 68, d + 68);

    // Grout base.
    g.fillStyle(0x928c7e, 1);
    g.fillRect(x, y, w, d);

    const BRICK_W = 140;
    const BRICK_H = 70;
    const palette = [0xc0baab, 0xc7c1b2, 0xb9b3a4, 0xccc6b7, 0xb4ae9f, 0xc2bcad];
    const rng = (seed) => {
      const v = Math.sin(seed * 91.733) * 43758.5453;
      return v - Math.floor(v);
    };

    const rows = Math.ceil(d / BRICK_H);
    for (let row = 0; row <= rows; row++) {
      const by = y + row * BRICK_H;
      const offset = row % 2 ? -BRICK_W / 2 : 0;
      for (let col = -1; col <= Math.ceil(w / BRICK_W); col++) {
        const bx = x + offset + col * BRICK_W;
        const v = rng(row * 71 + col * 131);
        if (v < 0.08) continue;
        // Clip the offset courses to the plaza so bricks never paint over the curb.
        const left = Math.max(bx + 2, x);
        const top = Math.max(by + 2, y);
        const right = Math.min(bx + BRICK_W - 2, x + w);
        const bottom = Math.min(by + BRICK_H - 2, y + d);
        if (right <= left || bottom <= top) continue;
        const bw = right - left;
        const bh = bottom - top;
        g.fillStyle(palette[Math.floor(v * 97) % palette.length], 1);
        g.fillRect(left, top, bw, bh);
        // Subtle bevel: lit top edge, shaded bottom edge.
        g.fillStyle(0xffffff, 0.12);
        g.fillRect(left, top, bw, Math.min(2, bh));
        g.fillStyle(0x4f4b42, 0.13);
        g.fillRect(left, bottom - 2, bw, 2);
        if (v > 0.78) {
          g.fillStyle(0x8e887b, 0.35);
          g.fillRect(left + 8, top + 12, Math.min(24 + v * 30, bw - 10), 3);
        }
      }
    }

    // Large stone medallion / drain in the middle of the square.
    MARKET_MEDALLIONS.forEach(({ x: mx, y: my, r }, index) => {
      g.lineStyle(5, 0x8f897b, 0.65);
      g.strokeCircle(mx, my, r);
      g.lineStyle(3, 0x9f998b, 0.55);
      g.strokeCircle(mx, my, r * 0.72);
      g.lineStyle(2, 0xb5af9f, 0.5);
      g.strokeCircle(mx, my, r * 0.44);
      if (index === 0) {
        // Small stone grate at the centre.
        g.fillStyle(0x6f6a5e, 1);
        g.fillRect(mx - 38, my - 26, 76, 52);
        g.fillStyle(0x413d35, 1);
        g.fillRect(mx - 30, my - 18, 60, 36);
        g.fillStyle(0x8d8779, 1);
        for (let i = 0; i < 4; i++) g.fillRect(mx - 26 + i * 16, my - 15, 5, 30);
      }
    });

    // Occasional crack across a brick.
    g.lineStyle(2, 0x777163, 0.35);
    for (let i = 0; i < 34; i++) {
      const cx = x + 120 + rng(i * 1.7) * (w - 240);
      const cy = y + 120 + rng(i * 2.9 + 4) * (d - 240);
      g.lineBetween(cx, cy, cx + 18 + rng(i) * 38, cy + 4 + rng(i + 5) * 10);
    }
  }

  drawLanterns() {
    MARKET_LANTERNS.forEach(([gx, gy]) => this.placeProp(createStoneLantern(this.scene), gx, gy));
  }

  placeProp(obj, gx, gy, depthBias = 0) {
    const p = toIso(gx, gy);
    obj.setPosition(p.x, p.y);
    obj.setDepth(isoDepth(gx, gy) + depthBias);
    if (typeof obj.setScale === "function") obj.setScale(S);
    return obj;
  }

  drawBuildings() {
    MARKET_BUILDINGS.forEach((def) => {
      let obj;
      if (def.kind === "shop") obj = createShop(this.scene, def);
      else if (def.kind === "gate") obj = createGate(this.scene, def);
      else if (def.kind === "board") obj = createNoticeBoard(this.scene, def);
      else obj = createStall(this.scene, def);

      // def.x / def.y is the ground contact point at the centre of the facade.
      this.placeProp(obj, def.x, def.y);
      if (def.kind === "shop") obj.setScale(S * 0.68);
      else if (def.kind === "gate") obj.setScale(S * 0.66);
      else if (def.kind === "board") obj.setScale(S * 0.62);

      if (def.kind === "shop") {
        this.addBody(def.x, def.y - 110, def.w * 0.9, 220);
      } else if (def.kind === "gate") {
        this.addBody(def.x - 80, def.y - 40, 90, 160);
        this.addBody(def.x + 80, def.y - 40, 90, 160);
      } else if (def.kind === "board") {
        this.addBody(def.x, def.y - 50, 120, 100);
      } else {
        this.addBody(def.x, def.y - 70, def.w * 0.7, 160);
      }
    });
  }

  drawProps() {
    const factories = {
      "crate-stack": createCrates,
      sacks: createSacks,
      barrel: createBarrel,
      "jar-cluster": createJars,
      basket: createBasket
    };
    MARKET_PROPS.forEach((prop) => {
      const factory = factories[prop.kind] || createBasket;
      const obj = factory(this.scene);
      this.placeProp(obj, prop.x, prop.y);
      obj.setScale(S * (prop.s || 1));
    });
  }

  drawTrees() {
    MARKET_TREES.forEach(([gx, gy, scale, kind]) => {
      const obj = kind === "pine" ? createPine(this.scene) : createTree(this.scene);
      this.placeProp(obj, gx, gy);
      obj.setScale(S * scale);
    });
  }

  drawNPCs() {
    this.npcLabels = new Map();
    this.npcs.forEach((npc) => {
      const container = createNpc(this.scene, npc, this.obstacles);
      const label = container?.getData?.("nameLabel");
      if (label) this.npcLabels.set(npc.id, label);
    });

    if (typeof window !== "undefined" && !this.npcLanguageHandler) {
      const handler = () => this.refreshNpcLabels();
      this.npcLanguageHandler = handler;
      window.addEventListener(LANGUAGE_CHANGED_EVENT, handler);
      this.scene.events.once("shutdown", () => {
        window.removeEventListener(LANGUAGE_CHANGED_EVENT, handler);
        if (this.npcLanguageHandler === handler) this.npcLanguageHandler = null;
        this.npcLabels = null;
      });
    }
  }

  refreshNpcLabels() {
    if (!this.npcLabels) return;
    this.npcs.forEach((npc) => {
      const label = this.npcLabels.get(npc.id);
      if (label?.setText) label.setText(getNpcName(npc));
    });
  }

  drawWorldBorder() {
    const g = this.scene.add.graphics().setDepth(GROUND_DEPTH + 5);
    g.lineStyle(4, 0x71805d, 0.35);
    g.strokePoints(
      [
        toIso(MARKET_BOUNDS.x0, MARKET_BOUNDS.y0),
        toIso(MARKET_BOUNDS.x1, MARKET_BOUNDS.y0),
        toIso(MARKET_BOUNDS.x1, MARKET_BOUNDS.y1),
        toIso(MARKET_BOUNDS.x0, MARKET_BOUNDS.y1)
      ],
      true,
      true
    );
  }

  getObstacles() {
    return this.obstacles;
  }

  getNPCs() {
    if (!this.npcs) return [];
    return this.npcs.map(localizeNpc);
  }
}

