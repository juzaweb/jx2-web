import { toIso, isoDepth } from "./isoProjection.js";
import { WORLD_SCALE } from "./worldConfig.js";
import { createGate, createNoticeBoard, createShop, createStall } from "./marketBuildings.js";
import { createBasket, createBarrel, createCrates, createJars, createPine, createSacks, createStoneLantern, createTree } from "./marketProps.js";
import {
  MARKET_BOUNDS,
  MARKET_BUILDINGS,
  MARKET_LANTERNS,
  MARKET_MEDALLIONS,
  MARKET_PROPS,
  MARKET_TREES
} from "./marketLayout.js";

const S = WORLD_SCALE;
const GROUND_DEPTH = -100000;

/**
 * Renders the compact Biện Kinh market square from the reference screenshot.
 * Public surface: create() and getObstacles().
 */
export class WorldManager {
  /** @param {import("phaser").Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.obstacles = null;
  }

  create() {
    this.obstacles = this.scene.physics.add.staticGroup();
    this.drawGround();
    this.drawLanterns();
    this.drawBuildings();
    this.drawProps();
    this.drawTrees();
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

    // Grass rim just outside the playable area, so camera bounds never show
    // the page background.
    g.fillStyle(0x53603f, 1);
    g.fillRect(B.x0 - PAD, B.y0 - PAD, B.x1 - B.x0 + PAD * 2, B.y1 - B.y0 + PAD * 2);

    // Warm base under the brick so the repeated texture reads a little softer.
    g.fillStyle(0x8a8272, 1);
    g.fillRect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0);

    // Brick floor fills the whole playable map, exactly at the map bounds.
    this.scene.add
      .tileSprite(
        B.x0 + (B.x1 - B.x0) / 2,
        B.y0 + (B.y1 - B.y0) / 2,
        B.x1 - B.x0,
        B.y1 - B.y0,
        "ground-bricks"
      )
      .setAlpha(0.94)
      .setDepth(GROUND_DEPTH + 1);

    this.drawGroundStains();

    this.drawGroundDetails();
  }

  /** Broad dirt/lichen patches that break up the tiled brick pattern. */
  drawGroundStains() {
    const g = this.scene.add.graphics().setDepth(GROUND_DEPTH + 2);
    const B = MARKET_BOUNDS;
    const rng = (seed) => {
      const v = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
      return v - Math.floor(v);
    };

    for (let i = 0; i < 48; i++) {
      const x = B.x0 + rng(i * 3.7) * (B.x1 - B.x0);
      const y = B.y0 + rng(i * 7.1 + 2) * (B.y1 - B.y0);
      const w = 260 + rng(i * 5.3) * 520;
      const h = w * (0.35 + rng(i * 9.1) * 0.25);
      g.fillStyle(i % 3 ? 0x6b6354 : 0x5f6b4a, 0.16);
      g.fillEllipse(x, y, w, h);
    }
  }

  /** Medallions and hairline cracks so the brick floor does not feel flat. */
  drawGroundDetails() {
    const g = this.scene.add.graphics().setDepth(GROUND_DEPTH + 3);
    const B = MARKET_BOUNDS;
    const rng = (seed) => {
      const v = Math.sin(seed * 91.733) * 43758.5453;
      return v - Math.floor(v);
    };

    MARKET_MEDALLIONS.forEach(({ x: mx, y: my, r }, index) => {
      g.lineStyle(5, 0x8f897b, 0.55);
      g.strokeCircle(mx, my, r);
      g.lineStyle(3, 0x9f998b, 0.45);
      g.strokeCircle(mx, my, r * 0.72);
      g.lineStyle(2, 0xb5af9f, 0.4);
      g.strokeCircle(mx, my, r * 0.44);
      if (index === 0) {
        // Small stone grate at the centre.
        g.fillStyle(0x6f6a5e, 0.9);
        g.fillRect(mx - 38, my - 26, 76, 52);
        g.fillStyle(0x413d35, 0.9);
        g.fillRect(mx - 30, my - 18, 60, 36);
        g.fillStyle(0x8d8779, 0.9);
        for (let i = 0; i < 4; i++) g.fillRect(mx - 26 + i * 16, my - 15, 5, 30);
      }
    });

    g.lineStyle(2, 0x777163, 0.28);
    for (let i = 0; i < 60; i++) {
      const cx = B.x0 + 120 + rng(i * 1.7) * (B.x1 - B.x0 - 240);
      const cy = B.y0 + 120 + rng(i * 2.9 + 4) * (B.y1 - B.y0 - 240);
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
}

