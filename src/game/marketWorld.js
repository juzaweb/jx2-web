import { toIso, isoDepth } from "./isoProjection.js";
import { WORLD_SCALE } from "./worldConfig.js";
import { createShop } from "./marketBuildings.js";
import { createVegetation } from "./marketProps.js";
import {
  MARKET_BOUNDS,
  MARKET_BUILDINGS,
  MARKET_GRASS,
  MARKET_MEDALLIONS,
  MARKET_TREES,
  MARKET_WALKWAY
} from "./marketLayout.js";

const S = WORLD_SCALE;
const GROUND_DEPTH = -100000;
/** Slight diagonal course for the walkway pavers (radians). */
const WALKWAY_ROTATION = -0.13;
/** Thickness of the stone kerb that edges the walkway. */
const KERB = 14;

/**
 * Deterministic 0–1 noise, so ground detail is identical on every reload.
 * @param {number} seed
 * @param {number} salt
 * @param {number} offset
 */
const seeded = (seed, salt = 12.9898, offset = 78.233) => {
  const v = Math.sin(seed * salt + offset) * 43758.5453;
  return v - Math.floor(v);
};

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
    this.drawBuildings();
    this.drawVegetation();
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

    // Packed earth under the brick so the repeated texture reads a little softer.
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

    this.drawWalkway();

    this.drawGroundDetails();
  }

  /**
   * The walkway is laid in a second brick style (smaller, diagonally laid
   * pavers in a warmer tone) with stone kerbs, so the street into the middle of
   * the city stands out from the square it crosses.
   */
  drawWalkway() {
    const W = MARKET_WALKWAY;
    const cx = W.x + W.w / 2;
    const cy = W.y + W.d / 2;

    // The sprite is sized to the rotated rectangle's bounding box, then masked
    // back down to the street.
    const spriteW = W.w * 1.05;
    const spriteH = W.d * 1.8;

    const paving = this.scene.add
      .tileSprite(cx, cy, spriteW, spriteH, "ground-walkway")
      .setRotation(WALKWAY_ROTATION)
      .setTileScale(0.55)
      .setTint(0xb0a288)
      .setAlpha(0.97)
      .setDepth(GROUND_DEPTH + 3);

    const clip = this.scene.make.graphics({ add: false });
    clip.fillStyle(0xffffff, 1);
    clip.fillRect(W.x, W.y, W.w, W.d);
    paving.setMask(clip.createGeometryMask());

    // Faint wear so the road does not read as a flat recoloured strip.
    const grime = this.scene.add.graphics().setDepth(GROUND_DEPTH + 3.5);
    const wear = (seed) => seeded(seed, 53.17, 0);
    for (let i = 0; i < 14; i++) {
      const gx = W.x + wear(i * 2.3) * W.w;
      const gy = W.y + wear(i * 4.7 + 1) * W.d;
      const gw = 220 + wear(i * 6.1) * 420;
      const gh = 90 + wear(i * 8.3) * 140;
      grime.fillStyle(0x4b463c, 0.08);
      grime.fillEllipse(gx, gy, gw, gh);
    }

    // Stone kerbs along both long edges so the paving sits above the square.
    const kerb = this.scene.add.graphics().setDepth(GROUND_DEPTH + 4);
    kerb.fillStyle(0x5d574b, 0.95);
    kerb.fillRect(W.x, W.y - KERB, W.w, KERB);
    kerb.fillRect(W.x, W.y + W.d, W.w, KERB);
    // End cap where the street finishes in the middle of the square.
    kerb.fillRect(W.x + W.w, W.y - KERB, KERB, W.d + KERB * 2);
    kerb.fillStyle(0x8b8474, 0.9);
    kerb.fillRect(W.x, W.y - KERB, W.w, 4);
    kerb.fillRect(W.x, W.y + W.d + KERB - 4, W.w, 4);
    kerb.lineStyle(2, 0x3e3a32, 0.35);
    kerb.lineBetween(W.x, W.y, W.x + W.w, W.y);
    kerb.lineBetween(W.x, W.y + W.d, W.x + W.w, W.y + W.d);
  }

  /** Broad dirt/lichen patches that break up the tiled brick pattern. */
  drawGroundStains() {
    const g = this.scene.add.graphics().setDepth(GROUND_DEPTH + 2);
    const B = MARKET_BOUNDS;

    for (let i = 0; i < 48; i++) {
      const x = B.x0 + seeded(i * 3.7) * (B.x1 - B.x0);
      const y = B.y0 + seeded(i * 7.1 + 2) * (B.y1 - B.y0);
      const w = 260 + seeded(i * 5.3) * 520;
      const h = w * (0.35 + seeded(i * 9.1) * 0.25);
      g.fillStyle(i % 3 ? 0x6b6354 : 0x5f6b4a, 0.16);
      g.fillEllipse(x, y, w, h);
    }
  }

  /** Medallions and hairline cracks so the walkway does not feel flat. */
  drawGroundDetails() {
    const g = this.scene.add.graphics().setDepth(GROUND_DEPTH + 5);
    const W = MARKET_WALKWAY;

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
    const crack = (seed) => seeded(seed, 91.733, 0);
    for (let i = 0; i < 60; i++) {
      const cx = W.x + 100 + crack(i * 1.7) * (W.w - 200);
      const cy = W.y + 40 + crack(i * 2.9 + 4) * (W.d - 80);
      g.lineBetween(cx, cy, cx + 18 + crack(i) * 38, cy + 4 + crack(i + 5) * 10);
    }
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
      const obj = createShop(this.scene, def);

      // def.x / def.y is the ground contact point at the centre of the facade.
      this.placeProp(obj, def.x, def.y);
      if (typeof def.scale === "number" && def.scale > 0) obj.setScale(def.scale);
      else obj.setScale(S * 0.68);

      this.addBody(def.x, def.y - 110, def.w * 0.9, 220);
    });
  }

  drawVegetation() {
    MARKET_TREES.forEach(([gx, gy, scale, kind]) => {
      const obj = createVegetation(this.scene, kind);
      this.placeProp(obj, gx, gy);
      obj.setScale(S * scale);
    });
    MARKET_GRASS.forEach(([gx, gy, scale]) => {
      const obj = createVegetation(this.scene, "grass");
      this.placeProp(obj, gx, gy);
      obj.setScale(S * scale);
    });
  }

  drawWorldBorder() {
    const g = this.scene.add.graphics().setDepth(GROUND_DEPTH + 6);
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

