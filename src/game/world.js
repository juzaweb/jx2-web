import * as Phaser from "phaser";
import { toIso, isoDepth } from "./isoProjection.js";
import { NPC_DATA, getNpcName, localizeNpc } from "./npcData.js";
import { LANGUAGE_CHANGED_EVENT } from "../i18n/translator.js";
import {
  CITY_AVENUES,
  CITY_BOUNDS,
  CITY_BUILDINGS,
  WORLD_CONFIG
} from "./worldConfig.js";

export { CITY_BOUNDS, WORLD_CONFIG };

/** Ground tile size (world units) that renders as one 76x38 iso diamond. */
const FLOOR_TILE = 76;

/** Building footprints indexed by id, used when constructing the scene. */
const BUILDING = Object.fromEntries(CITY_BUILDINGS.map((building) => [building.id, building]));

export class WorldManager {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.width = WORLD_CONFIG.width;
    this.height = WORLD_CONFIG.height;
    this.obstacles = null;
    this.npcs = NPC_DATA;
  }

  create() {
    this.obstacles = this.scene.physics.add.staticGroup();
    this.drawPavedGround();
    this.drawCityWalls();
    this.drawApothecaryShop();
    this.drawBankShop();
    this.drawTavernShop();
    this.drawMartialAcademy();
    this.drawCentralPavilion();
    this.drawDragonBalustrades();
    this.drawNPCs();
    this.drawWorldBorder();
  }

  /**
   * Place a billboard prop (already built in local space) on a ground position,
   * projecting to iso and depth-sorting it.
   */
  placeProp(obj, gx, gy) {
    const p = toIso(gx, gy);
    obj.setPosition(p.x, p.y);
    obj.setDepth(isoDepth(gx, gy));
    return obj;
  }

  isInsideCity(gx, gy) {
    return gx >= CITY_BOUNDS.x0 && gx < CITY_BOUNDS.x1 && gy >= CITY_BOUNDS.y0 && gy < CITY_BOUNDS.y1;
  }

  /**
   * Biện Kinh floor: grass / forest terrain across the whole map, with the warm
   * sandstone plaza paving only inside the city walls.
   */
  drawPavedGround() {
    const g = this.scene.add.graphics();
    const W = this.width;
    const H = this.height;
    const C = CITY_BOUNDS;

    const rng = (seed) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    const diamond = (gx, gy) => [
      toIso(gx, gy),
      toIso(gx + FLOOR_TILE, gy),
      toIso(gx + FLOOR_TILE, gy + FLOOR_TILE),
      toIso(gx, gy + FLOOR_TILE)
    ];

    // 1. Grass terrain base over the whole map.
    g.fillStyle(0x35503a, 1);
    g.fillPoints([toIso(0, 0), toIso(W, 0), toIso(W, H), toIso(0, H)], true);

    // Grass / forest speckles outside the city.
    const grassPalette = [0x2f4a35, 0x28412f, 0x3a5a40, 0x27402c];
    for (let gy = 0; gy < H; gy += FLOOR_TILE) {
      for (let gx = 0; gx < W; gx += FLOOR_TILE) {
        if (this.isInsideCity(gx, gy)) continue;
        const val = rng(gx * 13 + gy * 7);
        if (val > 0.45) {
          g.fillStyle(grassPalette[Math.floor(val * 40) % grassPalette.length], 0.55);
          g.fillPoints(diamond(gx, gy), true);
        }
      }
    }

    // 2. City plaza sandstone paving.
    g.fillStyle(0xd9d3c7, 1);
    g.fillPoints([toIso(C.x0, C.y0), toIso(C.x1, C.y0), toIso(C.x1, C.y1), toIso(C.x0, C.y1)], true);

    // 2b. Main paved avenues crossing the plaza (also shown on the minimap).
    const avenueH = CITY_AVENUES.horizontal;
    const avenueV = CITY_AVENUES.vertical;
    g.fillStyle(0x695f4e, 1);
    g.fillPoints(
      [
        toIso(C.x0, avenueH.y),
        toIso(C.x1, avenueH.y),
        toIso(C.x1, avenueH.y + avenueH.height),
        toIso(C.x0, avenueH.y + avenueH.height)
      ],
      true
    );
    g.fillPoints(
      [
        toIso(avenueV.x, C.y0),
        toIso(avenueV.x + avenueV.width, C.y0),
        toIso(avenueV.x + avenueV.width, C.y1),
        toIso(avenueV.x, C.y1)
      ],
      true
    );

    // 3. Cobblestone / Flagstone foundation for Dược Điếm in the top-left corner.
    const porchPoly = [
      { x: 0, y: 0 },
      { x: 740, y: 0 },
      { x: 740, y: 240 },
      { x: 120, y: 560 },
      { x: 0, y: 560 }
    ].map((p) => toIso(p.x, p.y));
    g.fillStyle(0x756f64, 1);
    g.fillPoints(porchPoly, true);

    // Irregular cobblestone stones inside Dược Điếm porch area
    g.lineStyle(1.5, 0x474239, 0.7);
    for (let py = 20; py < 540; py += 32) {
      for (let px = 20; px < 720; px += 36) {
        if (px < 740 - ((py - 240) * (620 / 320))) {
          const val = rng(px * 17 + py * 43);
          const stoneColor = val > 0.6 ? 0x8a8477 : val > 0.3 ? 0x6e685c : 0x7e786b;
          const w = 26 + val * 8;
          const h = 18 + val * 6;
          const corners = [
            toIso(px - w / 2, py - h / 2),
            toIso(px + w / 2, py - h / 2),
            toIso(px + w / 2, py + h / 2),
            toIso(px - w / 2, py + h / 2)
          ];
          g.fillStyle(stoneColor, 0.85);
          g.fillPoints(corners, true);
          g.strokePoints(corners, true, true);
        }
      }
    }

    // 4. Diagonal stone curb step separating the shop porch from the plaza.
    const curb = [
      { x: 120, y: 560 },
      { x: 740, y: 240 },
      { x: 765, y: 252 },
      { x: 145, y: 572 }
    ].map((p) => toIso(p.x, p.y));
    g.fillStyle(0x8a8477, 1);
    g.fillPoints(curb, true);
    const curbTopA = toIso(120, 560);
    const curbTopB = toIso(740, 240);
    const curbShadowA = toIso(145, 572);
    const curbShadowB = toIso(765, 252);
    g.lineStyle(2, 0xbeb7a9, 0.9);
    g.lineBetween(curbTopA.x, curbTopA.y, curbTopB.x, curbTopB.y);
    g.lineStyle(2, 0x484339, 0.8);
    g.lineBetween(curbShadowA.x, curbShadowA.y, curbShadowB.x, curbShadowB.y);

    const curbSteps = 24;
    for (let i = 0; i <= curbSteps; i++) {
      const t = i / curbSteps;
      const kx1 = 120 + t * (740 - 120);
      const ky1 = 560 + t * (240 - 560);
      const kx2 = 145 + t * (765 - 145);
      const ky2 = 572 + t * (252 - 572);
      const a = toIso(kx1, ky1);
      const b = toIso(kx2, ky2);
      g.lineStyle(1.5, 0x484339, 0.7);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }

    // 5. Isometric diamond paving grid inside the city.
    g.lineStyle(1.2, 0xb8b0a1, 0.7);
    for (let gx = C.x0; gx <= C.x1; gx += FLOOR_TILE) {
      const a = toIso(gx, C.y0);
      const b = toIso(gx, C.y1);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (let gy = C.y0; gy <= C.y1; gy += FLOOR_TILE) {
      const a = toIso(C.x0, gy);
      const b = toIso(C.x1, gy);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }

    // 6. Stone slab lighting & natural variations.
    for (let gy = C.y0; gy < C.y1; gy += FLOOR_TILE) {
      for (let gx = C.x0; gx < C.x1; gx += FLOOR_TILE) {
        // Skip slabs covered by the Dược Điếm foundation or the main avenues.
        const onAvenue =
          (gx < avenueV.x + avenueV.width && gx + FLOOR_TILE > avenueV.x) ||
          (gy < avenueH.y + avenueH.height && gy + FLOOR_TILE > avenueH.y);
        if (
          onAvenue ||
          (gx < 740 && gy < 560 && gx < 740 - ((gy - 240) * (620 / 320)))
        ) {
          continue;
        }

        const val = rng((gy / FLOOR_TILE) * 47 + (gx / FLOOR_TILE) * 93);
        if (val > 0.55) {
          const tint = val > 0.85 ? 0xeae5dc : val > 0.7 ? 0xd0c9bd : 0xe0dad0;
          g.fillStyle(tint, 0.5);
          g.fillPoints(diamond(gx, gy), true);
        }
      }
    }
  }

  /**
   * Projected corners of an isometric box. `b*` are the ground footprint
   * corners, `t*` the same corners lifted by `height`.
   */
  isoCorners(x, y, w, d, height) {
    const bA = toIso(x, y);
    const bB = toIso(x + w, y);
    const bC = toIso(x + w, y + d);
    const bD = toIso(x, y + d);
    const lift = (p, h = height) => ({ x: p.x, y: p.y - h });
    return { bA, bB, bC, bD, tA: lift(bA), tB: lift(bB), tC: lift(bC), tD: lift(bD), lift };
  }

  lerpPoint(p, q, t) {
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
  }

  /** Paint the two camera-facing walls (front-left and front-right) of a box. */
  drawPrismWalls(g, c, leftColor, rightColor) {
    g.fillStyle(leftColor, 1);
    g.fillPoints([c.bD, c.bC, c.tC, c.tD], true);
    g.fillStyle(rightColor, 1);
    g.fillPoints([c.bB, c.bC, c.tC, c.tB], true);
  }

  /** Crenellations along the four top edges of an isometric box. */
  drawMerlons(g, c, merlonHeight, color) {
    const edges = [
      [c.tA, c.tB],
      [c.tB, c.tC],
      [c.tC, c.tD],
      [c.tD, c.tA]
    ];
    g.fillStyle(color, 1);
    for (const [p, q] of edges) {
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      const count = Math.max(2, Math.round(len / 34));
      for (let i = 0; i < count; i++) {
        const a = this.lerpPoint(p, q, i / count);
        const b = this.lerpPoint(p, q, (i + 0.6) / count);
        g.fillPoints([a, b, c.lift(b, merlonHeight), c.lift(a, merlonHeight)], true);
      }
    }
  }

  /**
   * Draw an isometric building prism: a projected ground footprint extruded
   * upward, with an overhanging tiled roof plus a door and signboard on the
   * front face. Returns the (already depth-sorted) container.
   */
  drawIsoBuilding({ x, y, w, d, height, wallLeft, wallRight, roof, roofEdge, label, labelColor = "#ffdf7a" }) {
    const c = this.isoCorners(x, y, w, d, height);
    const g = this.scene.add.graphics();
    this.drawPrismWalls(g, c, wallLeft, wallRight);

    // Door on the front-right wall
    const doorTop = height * 0.58;
    const doorA = this.lerpPoint(c.bC, c.bB, 0.4);
    const doorB = this.lerpPoint(c.bC, c.bB, 0.68);
    g.fillStyle(0x241a12, 1);
    g.fillPoints([doorA, doorB, c.lift(doorB, doorTop), c.lift(doorA, doorTop)], true);
    g.lineStyle(1.5, 0x120b06, 0.9);
    g.strokePoints([doorA, doorB, c.lift(doorB, doorTop), c.lift(doorA, doorTop)], true, true);

    // Overhanging tiled roof (expanded diamond)
    const rcx = (c.tA.x + c.tC.x) / 2;
    const rcy = (c.tA.y + c.tC.y) / 2;
    const expand = (p, k) => ({ x: rcx + (p.x - rcx) * (1 + k), y: rcy + (p.y - rcy) * (1 + k) });
    const rA = expand(c.tA, 0.16);
    const rB = expand(c.tB, 0.16);
    const rC = expand(c.tC, 0.16);
    const rD = expand(c.tD, 0.16);

    // Eave shadow cast on the wall top
    g.fillStyle(0x000000, 0.16);
    g.fillPoints([c.tA, c.tB, c.tC, c.tD], true);

    g.fillStyle(roof, 1);
    g.fillPoints([rA, rB, rC, rD], true);
    g.lineStyle(2, roofEdge, 0.9);
    g.strokePoints([rA, rB, rC, rD], true, true);

    // Roof ridge
    const ridgeA = this.lerpPoint(rA, rB, 0.5);
    const ridgeB = this.lerpPoint(rD, rC, 0.5);
    g.lineStyle(3, roofEdge, 0.75);
    g.lineBetween(ridgeA.x, ridgeA.y, ridgeB.x, ridgeB.y);

    const container = this.scene.add.container(0, 0, [g]);

    if (label) {
      const sy = height * 0.66;
      const sA = this.lerpPoint(c.bC, c.bB, 0.32);
      const sB = this.lerpPoint(c.bC, c.bB, 0.8);
      const plaque = this.scene.add.graphics();
      plaque.fillStyle(0x18140f, 1);
      plaque.fillPoints([sA, sB, c.lift(sB, sy + 22), c.lift(sA, sy + 22)], true);
      plaque.lineStyle(2, 0xd4af37, 1);
      plaque.strokePoints([sA, sB, c.lift(sB, sy + 22), c.lift(sA, sy + 22)], true, true);
      const mid = c.lift(this.lerpPoint(sA, sB, 0.5), sy + 11);
      const text = this.scene.add
        .text(mid.x, mid.y, label, {
          fontFamily: "Arial, Tahoma, sans-serif",
          fontSize: "12px",
          color: labelColor,
          fontStyle: "bold"
        })
        .setOrigin(0.5);
      container.add([plaque, text]);
    }

    container.setDepth(isoDepth(x + w, y + d));
    return container;
  }

  /**
   * A crenellated isometric stone wall segment.
   */
  drawIsoWall({ x, y, w, d, height, top, left, right, merlonHeight = 0 }) {
    const c = this.isoCorners(x, y, w, d, height);
    const g = this.scene.add.graphics();
    this.drawPrismWalls(g, c, left, right);
    g.fillStyle(top, 1);
    g.fillPoints([c.tA, c.tB, c.tC, c.tD], true);
    if (merlonHeight > 0) this.drawMerlons(g, c, merlonHeight, top);

    const container = this.scene.add.container(0, 0, [g]);
    container.setDepth(isoDepth(x + w, y + d));
    return container;
  }

  /**
   * A taller crenellated gate tower with an arched opening on both visible faces.
   */
  drawIsoGate({ x, y, w, d, height, top, left, right }) {
    const c = this.isoCorners(x, y, w, d, height);
    const g = this.scene.add.graphics();
    this.drawPrismWalls(g, c, left, right);
    g.fillStyle(top, 1);
    g.fillPoints([c.tA, c.tB, c.tC, c.tD], true);

    const archHeight = height * 0.72;
    this.drawArch(g, c, c.bD, c.bC, archHeight);
    this.drawArch(g, c, c.bB, c.bC, archHeight);
    this.drawMerlons(g, c, height * 0.14, top);

    const container = this.scene.add.container(0, 0, [g]);
    container.setDepth(isoDepth(x + w, y + d));
    return container;
  }

  /** A dark arched opening on the wall face spanning ground edge p -> q. */
  drawArch(g, c, p, q, archHeight) {
    const a = this.lerpPoint(p, q, 0.4);
    const b = this.lerpPoint(p, q, 0.6);
    g.fillStyle(0x140f0a, 1);
    g.fillPoints([a, b, c.lift(b, archHeight), c.lift(a, archHeight)], true);
    g.fillPoints([c.lift(a, archHeight), c.lift(b, archHeight), c.lift(this.lerpPoint(a, b, 0.5), archHeight + 16)], true);
  }

  /**
   * Biện Kinh city ramparts: four crenellated stone walls enclosing the plaza,
   * with gate towers on each side. Split into segments so each sorts correctly.
   */
  drawCityWalls() {
    const { x0, y0, x1, y1 } = CITY_BOUNDS;
    const t = 40;
    const height = 86;
    const merlon = 20;
    const SEG = 150;

    const top = 0x9a8f78;
    const left = 0x8a7f69;
    const right = 0x6e6353;
    const gateTop = 0x9a8f78;
    const gateLeft = 0x8f8470;
    const gateRight = 0x726757;

    for (let xa = x0; xa < x1; xa += SEG) {
      const w = Math.min(SEG, x1 - xa);
      this.drawIsoWall({ x: xa, y: y0, w, d: t, height, top, left, right, merlonHeight: merlon });
      this.drawIsoWall({ x: xa, y: y1 - t, w, d: t, height, top, left, right, merlonHeight: merlon });
    }
    for (let ya = y0; ya < y1; ya += SEG) {
      const d = Math.min(SEG, y1 - ya);
      this.drawIsoWall({ x: x0, y: ya, w: t, d, height, top, left, right, merlonHeight: merlon });
      this.drawIsoWall({ x: x1 - t, y: ya, w: t, d, height, top, left, right, merlonHeight: merlon });
    }

    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const gw = 180;
    const gh = 150;
    const gate = { w: gw, d: t + 32, height: gh, top: gateTop, left: gateLeft, right: gateRight };
    this.drawIsoGate({ ...gate, x: mx - gw / 2, y: y0 - 16 });
    this.drawIsoGate({ ...gate, x: mx - gw / 2, y: y1 - t - 16 });
    this.drawIsoGate({ ...gate, x: x0 - 16, y: my - gw / 2, w: t + 32, d: gw });
    this.drawIsoGate({ ...gate, x: x1 - t - 16, y: my - gw / 2, w: t + 32, d: gw });

    if (this.obstacles) {
      const body = (cx, cy, bw, bh) => {
        const col = this.obstacles.create(cx, cy, "entity-dot");
        col.setSize(bw, bh);
        col.setVisible(false);
        col.refreshBody();
      };
      body(mx, y0 + t / 2, x1 - x0, t);
      body(mx, y1 - t / 2, x1 - x0, t);
      body(x0 + t / 2, my, t, y1 - y0);
      body(x1 - t / 2, my, t, y1 - y0);
    }
  }

  /**
   * Dược Điếm (Apothecary Shop) — rebuilt as a true isometric prism, with its
   * umbrella, medicine table, baskets, jars and lantern on the forecourt.
   */
  drawApothecaryShop() {
    this.drawIsoBuilding({
      ...BUILDING.apothecary,
      height: 150,
      wallLeft: 0x6b4a2e,
      wallRight: 0x523823,
      roof: 0x33302c,
      roofEdge: 0x9c7747,
      label: "藥 舖 • DƯỢC ĐIẾM"
    });

    // Forecourt props (upright billboards standing on the paved porch).
    this.placeProp(this.createSunshadeUmbrella(0, 0), 250, 470);
    this.placeProp(this.createMedicineTable(), 390, 485);
    this.placeProp(this.createStrawMat(), 300, 525);
    this.placeProp(this.createHerbBasket(0, 0, 0x4d7c0f), 400, 400);
    this.placeProp(this.createHerbBasket(0, 0, 0xd97706), 470, 445);
    this.placeProp(this.createHerbBasket(0, 0, 0x15803d), 520, 410);
    this.placeProp(this.createHerbBasket(0, 0, 0xb91c1c), 565, 455);
    this.placeProp(this.createCeramicJar(0, 0, 0x78350f, 20, 28), 500, 505);
    this.placeProp(this.createCeramicJar(0, 0, 0x92400e, 24, 32), 545, 515);
    this.placeProp(this.createCeramicJar(0, 0, 0xd97706, 18, 24), 335, 505);
    this.placeProp(this.createStonePagodaLantern(0, 0), 375, 565);

    // Static physics collider over the shop footprint (ground coordinates)
    if (this.obstacles) {
      const col = this.obstacles.create(330, 135, "entity-dot");
      col.setSize(380, 210);
      col.setVisible(false);
      col.refreshBody();
    }
  }

  createMedicineTable() {
    const c = this.scene.add.container(0, 0);
    c.add(this.scene.add.ellipse(0, 28, 130, 22, 0x161c16, 0.45));

    const tg = this.scene.add.graphics();
    tg.fillStyle(0x3d2415, 1);
    tg.lineStyle(1.5, 0x24140b, 1);
    tg.fillRect(-52, 6, 10, 20);
    tg.strokeRect(-52, 6, 10, 20);
    tg.fillRect(42, 6, 10, 20);
    tg.strokeRect(42, 6, 10, 20);
    tg.fillRect(-50, 10, 100, 6);

    tg.fillStyle(0x1d4ed8, 1);
    tg.lineStyle(2, 0xd4af37, 1);
    tg.fillRect(-58, -16, 116, 26);
    tg.strokeRect(-58, -16, 116, 26);
    tg.fillPoints([{ x: -58, y: 10 }, { x: 58, y: 10 }, { x: 50, y: 22 }, { x: -50, y: 22 }], true);
    tg.strokePoints([{ x: -58, y: 10 }, { x: 58, y: 10 }, { x: 50, y: 22 }, { x: -50, y: 22 }], true);

    tg.fillStyle(0xfacc15, 0.85);
    tg.fillCircle(-30, -3, 9);
    tg.fillCircle(30, -1, 10);
    tg.fillStyle(0xfef08a, 0.95);
    tg.fillCircle(0, -4, 8);

    const scroll1 = this.scene.add.rectangle(-36, -14, 18, 9, 0xfef3c7).setStrokeStyle(1, 0x78350f);
    const scroll2 = this.scene.add.rectangle(-16, -17, 14, 7, 0xfef3c7).setStrokeStyle(1, 0x78350f);
    const herbJar = this.scene.add.circle(38, -14, 7, 0x059669).setStrokeStyle(1.5, 0xd4af37);

    c.add([tg, scroll1, scroll2, herbJar]);
    return c;
  }

  createStrawMat() {
    const c = this.scene.add.container(0, 0);
    c.add(this.scene.add.rectangle(0, 0, 46, 30, 0xc4b595).setStrokeStyle(1.5, 0x8a7a58));
    c.add(this.scene.add.ellipse(-8, 0, 10, 16, 0x991b1b).setStrokeStyle(1, 0x450a0a));
    c.add(this.scene.add.ellipse(8, 0, 10, 16, 0x991b1b).setStrokeStyle(1, 0x450a0a));
    return c;
  }

  createSunshadeUmbrella(x, y) {
    const c = this.scene.add.container(x, y);
    // Ground shadow
    c.add(this.scene.add.ellipse(15, 60, 95, 30, 0x161c16, 0.4));
    // Wooden pole
    c.add(this.scene.add.rectangle(0, 15, 6, 85, 0x51351c).setStrokeStyle(1.5, 0x2e190b));
    // Plinth base
    c.add(this.scene.add.rectangle(0, 55, 24, 12, 0x78716c).setStrokeStyle(1.5, 0x44403c));
    // Octagonal umbrella canvas
    const umbrellaG = this.scene.add.graphics();
    umbrellaG.fillStyle(0xe8e0d1, 1);
    umbrellaG.lineStyle(2, 0xa39885, 1);
    umbrellaG.fillCircle(0, -32, 46);
    umbrellaG.strokeCircle(0, -32, 46);
    // Spokes
    umbrellaG.lineStyle(1.5, 0x786e5c, 0.8);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      umbrellaG.lineBetween(0, -32, Math.cos(a) * 46, -32 + Math.sin(a) * 46);
    }
    // Finial cap
    umbrellaG.fillStyle(0x451a03, 1);
    umbrellaG.fillCircle(0, -32, 6);
    c.add(umbrellaG);
    return c;
  }

  createHerbBasket(x, y, color) {
    const c = this.scene.add.container(x, y);
    const shadow = this.scene.add.ellipse(0, 16, 46, 16, 0x151b14, 0.38);
    // Woven wicker outer rim
    const rim = this.scene.add.ellipse(0, 0, 44, 30, 0xa17240).setStrokeStyle(2.5, 0x5c3d1e);
    // Herb contents with texture
    const herbs = this.scene.add.ellipse(0, 0, 36, 22, color);
    const flake1 = this.scene.add.circle(-8, -3, 3, 0xfef08a, 0.5);
    const flake2 = this.scene.add.circle(7, 3, 4, 0xfef08a, 0.5);
    c.add([shadow, rim, herbs, flake1, flake2]);
    return c;
  }

  createCeramicJar(x, y, color, w, h) {
    const c = this.scene.add.container(x, y);
    const shadow = this.scene.add.ellipse(0, h / 2 + 2, w + 8, 10, 0x141813, 0.4);
    const body = this.scene.add.ellipse(0, 0, w, h, color).setStrokeStyle(2, 0x2e190b);
    // Ceramic neck & lid tied with cloth
    const neck = this.scene.add.rectangle(0, -h / 2, w * 0.7, 5, 0x451a03);
    const redCloth = this.scene.add.ellipse(0, -h / 2 - 2, w * 0.55, 6, 0xdc2626);
    const cord = this.scene.add.rectangle(0, -h / 2, w * 0.65, 2, 0xfef08a);
    c.add([shadow, body, neck, redCloth, cord]);
    return c;
  }

  createStonePagodaLantern(x, y) {
    const c = this.scene.add.container(x, y);
    // Shadow
    c.add(this.scene.add.ellipse(0, 36, 40, 14, 0x171d17, 0.45));

    const g = this.scene.add.graphics();
    // Warm light glow
    g.fillStyle(0xfacc15, 0.22);
    g.fillCircle(0, -14, 22);

    // Stone base pedestal
    g.fillStyle(0x78716c, 1);
    g.lineStyle(1.5, 0x44403c, 1);
    g.fillRect(-16, 20, 32, 14);
    g.strokeRect(-16, 20, 32, 14);

    // Stone pillar
    g.fillStyle(0x8a8580, 1);
    g.fillRect(-6, 2, 12, 18);
    g.strokeRect(-6, 2, 12, 18);

    // Light chamber platform
    g.fillStyle(0x78716c, 1);
    g.fillRect(-14, -4, 28, 6);
    g.strokeRect(-14, -4, 28, 6);

    // Light chamber (translucent yellow paper window)
    g.fillStyle(0xfef08a, 1);
    g.fillRect(-10, -20, 20, 16);
    g.strokeRect(-10, -20, 20, 16);
    // Window lattice
    g.lineStyle(1, 0x44403c, 0.8);
    g.lineBetween(0, -20, 0, -4);
    g.lineBetween(-10, -12, 10, -12);

    // Flared pagoda roof
    g.fillStyle(0x57534e, 1);
    g.lineStyle(1.5, 0x292524, 1);
    g.beginPath();
    g.moveTo(-24, -20);
    g.lineTo(0, -32);
    g.lineTo(24, -20);
    g.closePath();
    g.fillPath();
    g.strokePath();

    // Lotus finial
    g.fillCircle(0, -35, 4);
    g.strokeCircle(0, -35, 4);

    c.add(g);
    return c;
  }

  /**
   * Tiền Trang (Bank & Treasury) — isometric prism with a red lacquered body.
   */
  drawBankShop() {
    this.drawIsoBuilding({
      ...BUILDING.bank,
      height: 180,
      wallLeft: 0x8a3b34,
      wallRight: 0x6b2e2b,
      roof: 0x262e38,
      roofEdge: 0xd4af37,
      label: "錢 莊 • TIỀN TRANG"
    });

    if (this.obstacles) {
      const col = this.obstacles.create(1650, 300, "entity-dot");
      col.setSize(360, 150);
      col.setVisible(false);
      col.refreshBody();
    }
  }

  /**
   * Tiểu Viễn Lâu (Famous Grand Tavern) — isometric prism with a wine flag.
   */
  drawTavernShop() {
    this.drawIsoBuilding({
      ...BUILDING.tavern,
      height: 200,
      wallLeft: 0x6b432b,
      wallRight: 0x50321f,
      roof: 0x242d38,
      roofEdge: 0x9c7747,
      label: "酒 樓 • TIỂU VIỄN LÂU"
    });

    // Wine flag pole "酒" (Tửu) in front of the tavern
    const flagPole = this.scene.add.container(0, 0);
    flagPole.add(this.scene.add.rectangle(0, 0, 5, 140, 0x4a3420));
    flagPole.add(this.scene.add.rectangle(24, -32, 45, 45, 0xdc2626).setStrokeStyle(2, 0x7f1d1d));
    flagPole.add(
      this.scene.add
        .text(24, -32, "酒", { fontFamily: "serif", fontSize: "24px", color: "#ffffff", fontStyle: "bold" })
        .setOrigin(0.5)
    );
    this.placeProp(flagPole, 470, 1080);

    // Wine casks outside
    this.placeProp(
      this.scene.add.container(0, 0, [this.scene.add.ellipse(0, 0, 36, 26, 0x78350f).setStrokeStyle(1.5, 0x361605)]),
      130,
      1120
    );
    this.placeProp(
      this.scene.add.container(0, 0, [this.scene.add.ellipse(0, 0, 36, 26, 0x6b2f0d).setStrokeStyle(1.5, 0x361605)]),
      175,
      1140
    );

    if (this.obstacles) {
      const col = this.obstacles.create(240, 1010, "entity-dot");
      col.setSize(320, 130);
      col.setVisible(false);
      col.refreshBody();
    }
  }

  /**
   * Võ Quán Biện Kinh (Martial Arts Academy) — isometric prism with training gear.
   */
  drawMartialAcademy() {
    this.drawIsoBuilding({
      ...BUILDING.academy,
      height: 165,
      wallLeft: 0x6b5540,
      wallRight: 0x4d3829,
      roof: 0x2d3748,
      roofEdge: 0x94a3b8,
      label: "武 館 • VÕ QUÁN"
    });

    this.placeProp(this.createTrainingDummy(0, 0), 1650, 1030);
    this.placeProp(this.createTrainingDummy(0, 0), 1720, 1050);
    this.placeProp(this.createHeavyWeaponRack(0, 0), 1870, 1005);

    if (this.obstacles) {
      const col = this.obstacles.create(1760, 820, "entity-dot");
      col.setSize(340, 140);
      col.setVisible(false);
      col.refreshBody();
    }
  }

  createTrainingDummy(x, y) {
    const c = this.scene.add.container(x, y);
    c.add(this.scene.add.rectangle(0, 14, 28, 6, 0x2e1a0d));
    c.add(this.scene.add.rectangle(0, -6, 12, 42, 0x92400e).setStrokeStyle(1.5, 0x451a03));
    c.add(this.scene.add.rectangle(-12, -14, 18, 4, 0xb45309));
    c.add(this.scene.add.rectangle(12, -8, 18, 4, 0xb45309));
    return c;
  }

  createHeavyWeaponRack(x, y) {
    const c = this.scene.add.container(x, y);
    c.add(this.scene.add.rectangle(0, 6, 60, 24, 0x3d2719).setStrokeStyle(1.5, 0x1f1208));
    c.add(this.scene.add.line(0, 0, -20, -28, -20, 12, 0x94a3b8).setLineWidth(2.5));
    c.add(this.scene.add.line(0, 0, -6, -34, -6, 12, 0xd4af37).setLineWidth(3));
    c.add(this.scene.add.line(0, 0, 8, -32, 8, 12, 0x94a3b8).setLineWidth(2.5));
    return c;
  }

  /**
   * Vạn Sự Thông Đình Đài (Central Pavilion) — isometric prism, jade plaque.
   */
  drawCentralPavilion() {
    this.drawIsoBuilding({
      ...BUILDING.pavilion,
      height: 175,
      wallLeft: 0x3b2416,
      wallRight: 0x2c1b10,
      roof: 0x1e2e38,
      roofEdge: 0x10b981,
      label: "萬 事 通 • VẠN SỰ THÔNG",
      labelColor: "#a7f3d0"
    });

    if (this.obstacles) {
      const col = this.obstacles.create(1165, 460, "entity-dot");
      col.setSize(150, 80);
      col.setVisible(false);
      col.refreshBody();
    }
  }

  /**
   * Dragon Balustrade — a low isometric stone platform with the carved dragon
   * head kept as a billboard prop on its step.
   */
  drawDragonBalustrades() {
    this.drawIsoBuilding({
      ...BUILDING.dragon,
      height: 34,
      wallLeft: 0x8a8477,
      wallRight: 0x747066,
      roof: 0x948e82,
      roofEdge: 0x575249,
      label: null
    });

    // Carved stone dragon head sculpture
    const dragon = this.scene.add.container(0, 0);
    const dragonG = this.scene.add.graphics();
    dragonG.fillStyle(0x948e82, 1);
    dragonG.lineStyle(2, 0x4f4a3f, 1);
    dragonG.fillPoints([
      { x: -50, y: 10 },
      { x: 70, y: 35 },
      { x: 70, y: 5 },
      { x: -50, y: -20 }
    ], true);
    dragonG.strokePoints([
      { x: -50, y: 10 },
      { x: 70, y: 35 },
      { x: 70, y: 5 },
      { x: -50, y: -20 }
    ], true);
    dragonG.fillStyle(0xa8a296, 1);
    dragonG.fillCircle(-55, -22, 18);
    dragonG.strokeCircle(-55, -22, 18);
    dragonG.fillStyle(0x6e685c, 1);
    dragonG.fillTriangle(-50, -36, -42, -52, -36, -34);
    dragonG.strokeTriangle(-50, -36, -42, -52, -36, -34);
    dragonG.fillStyle(0xfef08a, 1);
    dragonG.fillCircle(-70, -20, 6);
    dragonG.fillStyle(0x18181b, 1);
    dragonG.fillCircle(-58, -25, 3.5);
    dragon.add(dragonG);
    this.placeProp(dragon, 1130, 960);

    if (this.obstacles) {
      const col = this.obstacles.create(1140, 895, "entity-dot");
      col.setSize(150, 70);
      col.setVisible(false);
      col.refreshBody();
    }
  }

  /**
   * Wuxia NPCs positioned authentically in Biện Kinh Plaza
   * With green overhead names matching the JX2 screenshot
   */
  drawNPCs() {
    this.npcLabels = new Map();
    this.npcs.forEach((npc) => {
      const container = this.createNPC(npc.x, npc.y, getNpcName(npc), npc.type);
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

  /** Re-render the overhead name tags after a language switch. */
  refreshNpcLabels() {
    if (!this.npcLabels) return;
    this.npcs.forEach((npc) => {
      const label = this.npcLabels.get(npc.id);
      if (label?.setText) label.setText(getNpcName(npc));
    });
  }

  /**
   * Build authentic JX2 NPC figure with overhead name
   */
  createNPC(x, y, name, type = "scholar") {
    const npcAnchor = toIso(x, y);
    const c = this.scene.add.container(npcAnchor.x, npcAnchor.y);

    // 1. Ground shadow
    const shadow = this.scene.add.ellipse(0, 24, 34, 12, 0x121712, 0.45);

    // 2. Character body container
    const bodyContainer = this.scene.add.container(0, 0);

    if (type === "herbalist") {
      // Chủ Dược Điếm (Apothecary Master in maroon scholar robe)
      const g = this.scene.add.graphics();
      // Robe body
      g.fillStyle(0x6e2626, 1);
      g.lineStyle(1.5, 0x3d1414, 1);
      g.fillPoints([
        { x: -14, y: -16 },
        { x: 14, y: -16 },
        { x: 18, y: 22 },
        { x: -18, y: 22 }
      ], true);
      g.strokePoints([
        { x: -14, y: -16 },
        { x: 14, y: -16 },
        { x: 18, y: 22 },
        { x: -18, y: 22 }
      ], true);
      // White inner collar crossover (V-neck)
      g.fillStyle(0xf8fafc, 1);
      g.fillTriangle(-8, -16, 0, -4, 0, -16);
      g.fillTriangle(8, -16, 0, -4, 0, -16);
      // Lapels
      g.lineStyle(1.5, 0x3d1414, 1);
      g.lineBetween(-8, -16, 2, -2);
      g.lineBetween(8, -16, -2, -2);
      // Dark sash with hanging ribbon
      g.fillStyle(0x2d1717, 1);
      g.fillRect(-15, -4, 30, 6);
      g.fillRect(-3, 2, 6, 14);
      // Wide sleeves folded in front
      g.fillStyle(0x561e1e, 1);
      g.lineStyle(1.2, 0x2e0e0e, 1);
      g.fillRoundedRect(-17, -8, 34, 14, 6);
      g.strokeRoundedRect(-17, -8, 34, 14, 6);
      // Face
      g.fillStyle(0xfcd34d, 1);
      g.lineStyle(1, 0xd97706, 1);
      g.fillCircle(0, -25, 8);
      g.strokeCircle(0, -25, 8);
      // Hair bun & pin
      g.fillStyle(0x18181b, 1);
      g.fillCircle(0, -33, 4.5);
      g.lineStyle(2, 0xd4af37, 1);
      g.lineBetween(-6, -33, 6, -33);
      bodyContainer.add(g);

    } else if (type === "scholar") {
      // Bạch Tiên Sinh (White Taoist robe, long white beard, wooden staff with golden gourd)
      const g = this.scene.add.graphics();
      // Flowing White Robe with Crimson Border
      g.fillStyle(0xf8fafc, 1);
      g.lineStyle(1.5, 0x94a3b8, 1);
      g.fillPoints([
        { x: -14, y: -16 },
        { x: 14, y: -16 },
        { x: 19, y: 23 },
        { x: -19, y: 23 }
      ], true);
      g.strokePoints([
        { x: -14, y: -16 },
        { x: 14, y: -16 },
        { x: 19, y: 23 },
        { x: -19, y: 23 }
      ], true);
      // Crimson border hem
      g.fillStyle(0xb91c1c, 1);
      g.fillRect(-19, 20, 38, 4);
      // Crimson lapels & sash
      g.lineStyle(1.5, 0xb91c1c, 1);
      g.lineBetween(-8, -16, 2, -3);
      g.lineBetween(8, -16, -2, -3);
      g.fillRect(-15, -4, 30, 6);
      g.fillRect(-3, 2, 6, 14);
      // Sleeves
      g.fillStyle(0xf1f5f9, 1);
      g.lineStyle(1.2, 0xb91c1c, 1);
      g.fillRoundedRect(-18, -8, 36, 14, 6);
      g.strokeRoundedRect(-18, -8, 36, 14, 6);
      // Majestic long white beard!
      g.fillStyle(0xffffff, 1);
      g.lineStyle(1, 0xe2e8f0, 1);
      g.fillTriangle(-6, -18, 0, 16, 6, -18);
      g.strokeTriangle(-6, -18, 0, 16, 6, -18);
      // Face
      g.fillStyle(0xfde68a, 1);
      g.lineStyle(1, 0xd97706, 1);
      g.fillCircle(0, -25, 8);
      g.strokeCircle(0, -25, 8);
      // White Taoist hair bun
      g.fillStyle(0xffffff, 1);
      g.lineStyle(1, 0x94a3b8, 1);
      g.fillCircle(0, -33, 4.5);
      g.strokeCircle(0, -33, 4.5);
      // Wooden staff with golden gourd & red ribbon
      g.fillStyle(0x78350f, 1);
      g.lineStyle(1, 0x451a03, 1);
      g.fillRect(-18, -14, 3.5, 48);
      g.strokeRect(-18, -14, 3.5, 48);
      g.fillStyle(0xfacc15, 1);
      g.lineStyle(1, 0xb45309, 1);
      g.fillCircle(-16, -20, 5.5);
      g.strokeCircle(-16, -20, 5.5);
      g.fillStyle(0xdc2626, 1);
      g.fillRect(-14, -18, 3, 10);
      bodyContainer.add(g);

    } else if (type === "merchant") {
      // Thương Nhân Bảo Rương (Stout merchant in purple & emerald robe with Treasure Chest)
      const g = this.scene.add.graphics();
      // Opulent royal purple robe
      g.fillStyle(0x3b1464, 1);
      g.lineStyle(1.5, 0x1e0b36, 1);
      g.fillPoints([
        { x: -16, y: -16 },
        { x: 16, y: -16 },
        { x: 21, y: 23 },
        { x: -21, y: 23 }
      ], true);
      g.strokePoints([
        { x: -16, y: -16 },
        { x: 16, y: -16 },
        { x: 21, y: 23 },
        { x: -21, y: 23 }
      ], true);
      // Gold hem trim
      g.fillStyle(0xd4af37, 1);
      g.fillRect(-21, 20, 42, 4);
      // Emerald green silk sash
      g.fillStyle(0x047857, 1);
      g.fillRect(-17, -4, 34, 7);
      // Rotund belly with hands tucked in sleeves
      g.fillStyle(0x2e1050, 1);
      g.lineStyle(1.5, 0x047857, 1);
      g.fillRoundedRect(-19, -8, 38, 16, 7);
      g.strokeRoundedRect(-19, -8, 38, 16, 7);
      // Face
      g.fillStyle(0xfcd34d, 1);
      g.lineStyle(1, 0xd97706, 1);
      g.fillCircle(0, -25, 9);
      g.strokeCircle(0, -25, 9);
      // Black skullcap with ruby medallion
      g.fillStyle(0x18181b, 1);
      g.fillPoints([
        { x: -8, y: -28 },
        { x: 8, y: -28 },
        { x: 6, y: -35 },
        { x: -6, y: -35 }
      ], true);
      g.fillStyle(0xdc2626, 1);
      g.fillCircle(0, -30, 2.5);

      // Golden Treasure Chest on ground next to merchant
      g.fillStyle(0x78350f, 1);
      g.lineStyle(2, 0xd4af37, 1);
      g.fillRect(20, 4, 26, 18);
      g.strokeRect(20, 4, 26, 18);
      // Gold corner brackets & center latch
      g.fillStyle(0xfacc15, 1);
      g.fillRect(19, 4, 4, 18);
      g.fillRect(43, 4, 4, 18);
      g.fillRect(31, 10, 4, 7);
      bodyContainer.add(g);

    } else if (type === "ambassador") {
      // Đại Sứ Hoạt Động (Imperial ambassador in white/royal blue armor robes with silver pauldrons)
      const g = this.scene.add.graphics();
      // White & Royal Blue Martial Robe
      g.fillStyle(0xffffff, 1);
      g.lineStyle(1.5, 0x1e40af, 1);
      g.fillPoints([
        { x: -14, y: -16 },
        { x: 14, y: -16 },
        { x: 18, y: 23 },
        { x: -18, y: 23 }
      ], true);
      g.strokePoints([
        { x: -14, y: -16 },
        { x: 14, y: -16 },
        { x: 18, y: 23 },
        { x: -18, y: 23 }
      ], true);
      // Royal blue chest armor vestment
      g.fillStyle(0x1e40af, 1);
      g.fillRect(-11, -16, 22, 16);
      // Gold dragon war belt
      g.fillStyle(0xd4af37, 1);
      g.fillRect(-15, -4, 30, 6);
      // Silver shoulder pauldrons
      g.fillStyle(0x94a3b8, 1);
      g.lineStyle(1, 0x475569, 1);
      g.fillRect(-18, -18, 7, 14);
      g.strokeRect(-18, -18, 7, 14);
      g.fillRect(11, -18, 7, 14);
      g.strokeRect(11, -18, 7, 14);
      // Face
      g.fillStyle(0xfcd34d, 1);
      g.lineStyle(1, 0xd97706, 1);
      g.fillCircle(0, -25, 8);
      g.strokeCircle(0, -25, 8);
      // High martial crown
      g.fillStyle(0x1e293b, 1);
      g.lineStyle(1.5, 0xd4af37, 1);
      g.fillRect(-6, -37, 12, 8);
      g.strokeRect(-6, -37, 12, 8);
      bodyContainer.add(g);

    } else if (type === "martial") {
      // Chân Tử Đơn (Kung Fu Martial Artist)
      const g = this.scene.add.graphics();
      g.fillStyle(0x18181b, 1);
      g.lineStyle(1.5, 0xdc2626, 1);
      g.fillPoints([
        { x: -12, y: -16 },
        { x: 12, y: -16 },
        { x: 16, y: 22 },
        { x: -16, y: 22 }
      ], true);
      g.strokePoints([
        { x: -12, y: -16 },
        { x: 12, y: -16 },
        { x: 16, y: 22 },
        { x: -16, y: 22 }
      ], true);
      g.fillStyle(0xdc2626, 1);
      g.fillRect(-14, -4, 28, 6);
      g.fillStyle(0xfcd34d, 1);
      g.lineStyle(1, 0xd97706, 1);
      g.fillCircle(0, -25, 8);
      g.strokeCircle(0, -25, 8);
      g.fillStyle(0xffffff, 1);
      g.fillRect(-9, -29, 18, 3);
      g.fillStyle(0x000000, 1);
      g.fillCircle(0, -33, 4);
      bodyContainer.add(g);

    } else {
      // Vạn Sự Thông (All-Knowing Sage in forest green & gold robes)
      const g = this.scene.add.graphics();
      g.fillStyle(0x14532d, 1);
      g.lineStyle(1.5, 0xd4af37, 1);
      g.fillPoints([
        { x: -13, y: -16 },
        { x: 13, y: -16 },
        { x: 17, y: 22 },
        { x: -17, y: 22 }
      ], true);
      g.strokePoints([
        { x: -13, y: -16 },
        { x: 13, y: -16 },
        { x: 17, y: 22 },
        { x: -17, y: 22 }
      ], true);
      g.fillStyle(0xd4af37, 1);
      g.fillRect(-14, -4, 28, 6);
      // Wispy beard
      g.fillStyle(0xd1d5db, 1);
      g.fillTriangle(-5, -18, 0, 8, 5, -18);
      g.fillStyle(0xfde68a, 1);
      g.lineStyle(1, 0xd97706, 1);
      g.fillCircle(0, -25, 8);
      g.strokeCircle(0, -25, 8);
      g.fillStyle(0x064e3b, 1);
      g.lineStyle(1, 0xd4af37, 1);
      g.fillRect(-7, -35, 14, 6);
      g.strokeRect(-7, -35, 14, 6);
      // Feather fan
      g.fillStyle(0xffffff, 1);
      g.lineStyle(1, 0x94a3b8, 1);
      g.fillPoints([
        { x: -20, y: -18 },
        { x: -8, y: -18 },
        { x: -14, y: 0 }
      ], true);
      g.strokePoints([
        { x: -20, y: -18 },
        { x: -8, y: -18 },
        { x: -14, y: 0 }
      ], true);
      bodyContainer.add(g);
    }

    // 3. Authentic JX2 overhead green name tag (Chữ xanh lá cây viền đen đậm)
    const nameLabel = this.scene.add.text(0, -48, name, {
      fontFamily: "Arial, Tahoma, sans-serif",
      fontSize: "12px",
      color: "#22c55e",
      stroke: "#051307",
      strokeThickness: 3.5,
      fontStyle: "bold"
    }).setOrigin(0.5);

    c.add([shadow, bodyContainer, nameLabel]);
    c.setData("nameLabel", nameLabel);
    c.setDepth(isoDepth(x, y));

    // Obstacle collider so players can't walk inside NPCs
    if (this.obstacles) {
      const col = this.obstacles.create(x, y + 8, "entity-dot");
      col.setSize(28, 18);
      col.setVisible(false);
      col.refreshBody();
    }

    return c;
  }

  drawWorldBorder() {
    const g = this.scene.add.graphics();
    g.lineStyle(4, 0x9a8657, 0.5);
    g.strokePoints(
      [toIso(6, 6), toIso(this.width - 6, 6), toIso(this.width - 6, this.height - 6), toIso(6, this.height - 6)],
      true,
      true
    );
  }

  /**
   * Get static physics group containing world obstacles
   * @returns {Phaser.Physics.Arcade.StaticGroup}
   */
  getObstacles() {
    return this.obstacles;
  }

  /**
   * Get list of world NPCs for dialogue and interaction
   * @returns {Array<object>}
   */
  getNPCs() {
    if (!this.npcs) return [];
    return this.npcs.map(localizeNpc);
  }
}
