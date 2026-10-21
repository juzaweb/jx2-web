import { WORLD_SCALE } from "./worldConfig.js";

const S = WORLD_SCALE;

export const PHARMACY_BUILDING = {
  textureKey: "building-duoc-diem",
  url: "/duoc-diem.png",
  width: 714,
  height: 422,
  scale: 2.8
};

export const GROCERY_BUILDING = {
  textureKey: "building-tap-hoa",
  url: "/tap-hoa.png",
  width: 727,
  height: 432,
  scale: 2.8
};

export const SHOP_BUILDINGS = [PHARMACY_BUILDING, GROCERY_BUILDING];

const SHOP_SPRITE_REGISTRY = {
  "duoc-diem": PHARMACY_BUILDING,
  herb: PHARMACY_BUILDING,
  "tap-hoa": GROCERY_BUILDING,
  wood: GROCERY_BUILDING
};

/** Front-facing 2.5D shop, gate, notice board and stall painters. */

export function createShop(scene, def) {
    const c = scene.add.container(0, 0);

    const spriteBuilding =
      SHOP_SPRITE_REGISTRY[def?.id] ||
      SHOP_SPRITE_REGISTRY[def?.palette] ||
      null;

    // Sprite-based shop when runtime texture is available.
    if (
      spriteBuilding &&
      typeof scene.textures?.exists === "function" &&
      scene.textures.exists(spriteBuilding.textureKey)
    ) {
      const g = scene.add.graphics();
      g.fillStyle(0x12170f, 0.32);
      g.fillEllipse(0, 4, 680, 36);
      c.add(g);

      const img = scene.add.image(0, 0, spriteBuilding.textureKey).setOrigin(0.5, 1);
      c.add(img);
      return c;
    }

    const herb = def.palette === "herb";
    const wall = herb ? 0x8a6741 : 0x91633d;
    const wallDark = herb ? 0x64482c : 0x6d472b;
    const wallLight = herb ? 0xa98255 : 0xa97a4c;
    const roof = herb ? 0x2f4b4f : 0x303a44;
    const roofLight = herb ? 0x40646a : 0x445260;
    const signBg = def.signColor === "green" ? 0x1f5f43 : 0x9d2a25;
    const signEdge = def.signColor === "green" ? 0xd8c47a : 0xe4bc6d;

    const g = scene.add.graphics();
    // Shadow + stone foundation.
    g.fillStyle(0x12170f, 0.35);
    g.fillEllipse(0, 12, 292, 44);
    g.fillStyle(0x8d8473, 1);
    g.fillRect(-130, -10, 260, 16);
    g.fillStyle(0x6d6557, 1);
    g.fillRect(-130, 2, 260, 8);

    // Side wall (right) gives the facade depth.
    g.fillStyle(wallDark, 1);
    g.fillPoints(
      [
        { x: 118, y: -14 },
        { x: 146, y: -32 },
        { x: 146, y: -158 },
        { x: 118, y: -138 }
      ],
      true
    );
    g.fillStyle(0x3d2a1a, 1);
    g.fillPoints(
      [
        { x: 126, y: -38 },
        { x: 140, y: -44 },
        { x: 140, y: -118 },
        { x: 126, y: -110 }
      ],
      true
    );

    // Main timber front wall.
    g.fillStyle(wall, 1);
    g.fillRect(-122, -146, 244, 136);
    g.fillStyle(wallLight, 1);
    g.fillRect(-122, -146, 244, 10);
    for (let px = -110; px <= 110; px += 22) {
      g.lineStyle(1.4, wallDark, 0.75);
      g.lineBetween(px, -138, px, -16);
    }
    // Dark structural beams.
    g.fillStyle(0x412a19, 1);
    g.fillRect(-124, -152, 248, 10);
    g.fillRect(-124, -64, 248, 8);
    g.fillRect(-124, -20, 248, 10);
    g.fillRect(-124, -152, 10, 138);
    g.fillRect(114, -152, 10, 138);

    // Open shop front with three shelves.
    g.fillStyle(0x2b1c11, 1);
    g.fillRect(-106, -136, 212, 74);
    for (let row = 0; row < 3; row++) {
      const sy = -128 + row * 24;
      g.fillStyle(0x5b3b22, 1);
      g.fillRect(-106, sy + 16, 212, 5);
      g.lineStyle(1, 0x8d6236, 0.8);
      g.strokeRect(-106, sy + 16, 212, 5);
      for (let i = 0; i < 9; i++) {
        const gx = -98 + i * 23;
        const colors = herb
          ? [0x4f7a33, 0x7fa54a, 0x9c4b2e, 0xd1a343, 0x5f8f6b]
          : [0x9b372a, 0x2e6a7a, 0xc28b3c, 0x6e4b7d, 0x3f7a4b];
        g.fillStyle(colors[(i + row * 2) % colors.length], 1);
        g.fillRoundedRect(gx, sy + 3, 10, 14, 3);
        g.fillStyle(0xf4e6c8, 0.5);
        g.fillRect(gx + 2, sy + 5, 3, 4);
      }
    }
    // Counter.
    g.fillStyle(0x5a3820, 1);
    g.fillRect(-112, -62, 224, 16);
    g.fillStyle(0x3c2414, 1);
    g.fillRect(-112, -48, 224, 6);
    g.fillStyle(0xd2a75b, 0.9);
    for (let i = 0; i < 5; i++) g.fillRect(-98 + i * 44, -74, 18, 12);

    // Hanging cloth banner on the left.
    g.fillStyle(herb ? 0x24634a : 0x8f2723, 1);
    g.fillPoints(
      [
        { x: -134, y: -142 },
        { x: -112, y: -142 },
        { x: -112, y: -84 },
        { x: -123, y: -92 },
        { x: -134, y: -84 }
      ],
      true
    );

    // Tiled roof with upturned eaves.
    g.fillStyle(0x1d262b, 1);
    g.fillPoints(
      [
        { x: -150, y: -150 },
        { x: 150, y: -150 },
        { x: 132, y: -178 },
        { x: -132, y: -178 }
      ],
      true
    );
    g.fillStyle(roof, 1);
    g.fillPoints(
      [
        { x: -146, y: -152 },
        { x: 146, y: -152 },
        { x: 122, y: -184 },
        { x: -122, y: -184 }
      ],
      true
    );
    g.fillStyle(roofLight, 1);
    g.fillPoints(
      [
        { x: -122, y: -184 },
        { x: 122, y: -184 },
        { x: 98, y: -196 },
        { x: -98, y: -196 }
      ],
      true
    );
    // Ridge + tile courses.
    g.fillStyle(0x182126, 1);
    g.fillRect(-100, -199, 200, 7);
    for (let i = 0; i < 5; i++) {
      const yy = -156 - i * 8;
      g.lineStyle(1, 0x71828a, 0.5);
      g.lineBetween(-140 + i * 5, yy, 140 - i * 5, yy);
    }
    // Upturned eave tips.
    g.fillStyle(roof, 1);
    g.fillTriangle(-158, -150, -146, -152, -160, -164);
    g.fillTriangle(158, -150, 146, -152, 160, -164);

    // Signboard.
    g.fillStyle(0x26170d, 1);
    g.fillRoundedRect(-92, -151, 184, 36, 3);
    g.fillStyle(signBg, 1);
    g.fillRoundedRect(-88, -148, 176, 30, 2);
    g.lineStyle(2, signEdge, 1);
    g.strokeRoundedRect(-88, -148, 176, 30, 2);
    g.lineStyle(1, 0xffe9ad, 0.45);
    g.lineBetween(-80, -143, 80, -143);
    g.lineBetween(-80, -124, 80, -124);

    c.add(g);

    // Sign text.
    const signText = scene.add
      .text(0, -133, def.sign, {
        fontFamily: "'Be Vietnam Pro', 'Arial', sans-serif",
        fontSize: "15px",
        color: def.signColor === "red" ? "#fff4d6" : "#ffe9a6",
        fontStyle: "bold"
      })
      .setOrigin(0.5);
    c.add(signText);
    const subText = scene.add
      .text(0, -118, def.subSign || "", {
        fontFamily: "'Noto Serif SC', serif",
        fontSize: "8px",
        color: "#f6d98a"
      })
      .setOrigin(0.5);
    c.add(subText);

    // Hanging red lanterns.
    c.add(createLantern(scene, -118, -108));
    c.add(createLantern(scene, 118, -108));

    if (herb) {
      // Herb bundles drying under the eave.
      for (let i = 0; i < 5; i++) {
        const hx = -82 + i * 41;
        g.lineStyle(1.5, 0x4a6b32, 1);
        g.lineBetween(hx, -152, hx, -126);
        g.fillStyle(i % 2 ? 0x5d8a3c : 0x3f6b2e, 1);
        g.fillEllipse(hx, -121, 14, 18);
      }
    } else {
      // Bolts of cloth on the right ledge.
      for (let i = 0; i < 3; i++) {
        g.fillStyle([0x9d2a25, 0x2e607a, 0xc08b3a][i], 1);
        g.fillRoundedRect(64 + i * 13, -150, 10, 20, 2);
      }
    }

    c.setScale(S);
    return c;
  }

export function createLantern(scene, x, y) {
    const c = scene.add.container(x, y);
    const g = scene.add.graphics();
    g.lineStyle(1.5, 0x3b2413, 1);
    g.lineBetween(0, -10, 0, 0);
    g.fillStyle(0x7e1d18, 1);
    g.fillEllipse(0, 10, 18, 24);
    g.lineStyle(1, 0xf0b64d, 0.9);
    g.strokeEllipse(0, 10, 18, 24);
    g.lineBetween(-9, 10, 9, 10);
    g.fillStyle(0xf5c451, 0.9);
    g.fillRect(-2, 22, 4, 5);
    c.add(g);
    return c;
  }

export function createGate(scene, def) {
    const c = scene.add.container(0, 0);
    const g = scene.add.graphics();
    const half = 92;
    const h = 205;
    g.fillStyle(0x13170f, 0.38);
    g.fillEllipse(0, 14, 250, 48);

    // Stone footings.
    [ -half, half ].forEach((px) => {
      g.fillStyle(0x7e7565, 1);
      g.fillRect(px - 24, -14, 48, 22);
      g.fillStyle(0x5d5548, 1);
      g.fillRect(px - 24, 2, 48, 8);
    });

    // Red pillars.
    [ -half, half ].forEach((px) => {
      g.fillStyle(0x8e2924, 1);
      g.fillRect(px - 12, -h, 24, h);
      g.fillStyle(0xb33a31, 1);
      g.fillRect(px - 12, -h, 7, h);
      g.lineStyle(1.5, 0x4e1512, 1);
      g.strokeRect(px - 12, -h, 24, h);
      // Gold bands.
      g.fillStyle(0xd7b25c, 1);
      g.fillRect(px - 14, -h + 10, 28, 5);
      g.fillRect(px - 14, -32, 28, 5);
    });

    // Cross beams.
    g.fillStyle(0x6f1d19, 1);
    g.fillRect(-half - 18, -h - 4, half * 2 + 36, 14);
    g.fillStyle(0xa7352d, 1);
    g.fillRect(-half - 18, -h - 4, half * 2 + 36, 5);
    g.fillStyle(0x5a1714, 1);
    g.fillRect(-half + 8, -h + 44, half * 2 - 16, 9);

    // Little tiled roof above the beam.
    g.fillStyle(0x24343a, 1);
    g.fillPoints(
      [
        { x: -half - 40, y: -h - 8 },
        { x: half + 40, y: -h - 8 },
        { x: half + 18, y: -h - 34 },
        { x: -half - 18, y: -h - 34 }
      ],
      true
    );
    g.fillStyle(0x38545c, 1);
    g.fillPoints(
      [
        { x: -half - 36, y: -h - 10 },
        { x: half + 36, y: -h - 10 },
        { x: half + 14, y: -h - 31 },
        { x: -half - 14, y: -h - 31 }
      ],
      true
    );
    g.fillStyle(0x1b282d, 1);
    g.fillRect(-half - 10, -h - 35, half * 2 + 20, 6);
    g.lineStyle(1, 0x7b8c91, 0.5);
    for (let i = 0; i < 4; i++) g.lineBetween(-half - 28 + i * 4, -h - 12 - i * 5, half + 28 - i * 4, -h - 12 - i * 5);

    // Gold-trimmed name plaque.
    g.fillStyle(0x24150d, 1);
    g.fillRoundedRect(-92, -h + 64, 184, 36, 3);
    g.fillStyle(0x1f3a4c, 1);
    g.fillRoundedRect(-88, -h + 67, 176, 30, 2);
    g.lineStyle(2, 0xd7b25c, 1);
    g.strokeRoundedRect(-88, -h + 67, 176, 30, 2);
    c.add(g);

    const text = scene.add
      .text(0, -h + 82, def.sign, {
        fontFamily: "'Be Vietnam Pro', 'Arial', sans-serif",
        fontSize: "15px",
        color: "#ffe6a1",
        fontStyle: "bold"
      })
      .setOrigin(0.5);
    const sub = scene.add
      .text(0, -h + 96, def.subSign || "", {
        fontFamily: "'Noto Serif SC', serif",
        fontSize: "7px",
        color: "#e9cd8b"
      })
      .setOrigin(0.5);
    c.add([text, sub]);

    // Red banners on the pillars.
    const banner = scene.add.graphics();
    banner.fillStyle(0xa42b24, 1);
    banner.fillPoints(
      [
        { x: -half + 14, y: -h + 120 },
        { x: -half + 34, y: -h + 120 },
        { x: -half + 34, y: -h + 178 },
        { x: -half + 24, y: -h + 168 },
        { x: -half + 14, y: -h + 178 }
      ],
      true
    );
    c.add(banner);

    c.setScale(S);
    return c;
  }

export function createNoticeBoard(scene, def) {
    const c = scene.add.container(0, 0);
    const g = scene.add.graphics();
    g.fillStyle(0x14180f, 0.35);
    g.fillEllipse(0, 8, 110, 28);
    // Posts.
    g.fillStyle(0x4b2f1a, 1);
    g.fillRect(-42, -92, 8, 96);
    g.fillRect(34, -92, 8, 96);
    // Board.
    g.fillStyle(0x5a1f1b, 1);
    g.fillRect(-58, -136, 116, 58);
    g.fillStyle(0x9e2d27, 1);
    g.fillRect(-54, -132, 108, 50);
    g.lineStyle(2, 0xd8b25c, 1);
    g.strokeRect(-54, -132, 108, 50);
    // Papers pinned to the board.
    for (let i = 0; i < 4; i++) {
      g.fillStyle(0xf1e2be, 0.95);
      g.fillRect(-45 + i * 24, -124, 16, 26);
      g.lineStyle(1, 0x8b6f46, 0.8);
      for (let line = 0; line < 4; line++) g.lineBetween(-43 + i * 24, -119 + line * 5, -33 + i * 24, -119 + line * 5);
    }
    // Mini roof.
    g.fillStyle(0x23333a, 1);
    g.fillPoints(
      [
        { x: -68, y: -136 },
        { x: 68, y: -136 },
        { x: 48, y: -158 },
        { x: -48, y: -158 }
      ],
      true
    );
    g.fillStyle(0x36555d, 1);
    g.fillPoints(
      [
        { x: -62, y: -138 },
        { x: 62, y: -138 },
        { x: 44, y: -155 },
        { x: -44, y: -155 }
      ],
      true
    );
    c.add(g);

    const text = scene.add
      .text(0, -118, def.sign, {
        fontFamily: "'Be Vietnam Pro', 'Arial', sans-serif",
        fontSize: "16px",
        color: "#ffe5a3",
        fontStyle: "bold"
      })
      .setOrigin(0.5);
    c.add(text);
    c.setScale(S);
    return c;
  }

export function createStall(scene, def) {
    const c = scene.add.container(0, 0);
    const red = def.awning === "red";
    const light = red ? 0xe6e0cf : 0xe7edf0;
    const dark = red ? 0xa82b25 : 0x2f607e;
    const g = scene.add.graphics();
    g.fillStyle(0x11160f, 0.35);
    g.fillEllipse(0, 10, 156, 34);

    // Posts.
    g.fillStyle(0x4a2f1a, 1);
    g.fillRect(-60, -104, 7, 108);
    g.fillRect(53, -104, 7, 108);

    // Striped canopy.
    const stripes = 6;
    for (let i = 0; i < stripes; i++) {
      const x0 = -78 + (i * 156) / stripes;
      const x1 = -78 + ((i + 1) * 156) / stripes;
      g.fillStyle(i % 2 ? dark : light, 1);
      g.fillPoints(
        [
          { x: x0, y: -106 },
          { x: x1, y: -106 },
          { x: x1 + 4, y: -130 },
          { x: x0 - 4, y: -130 }
        ],
        true
      );
    }
    g.fillStyle(0x3a2413, 1);
    g.fillRect(-82, -134, 164, 6);
    g.fillStyle(light, 1);
    g.fillPoints(
      [
        { x: -82, y: -134 },
        { x: 82, y: -134 },
        { x: 56, y: -144 },
        { x: -56, y: -144 }
      ],
      true
    );

    // Table and wares.
    g.fillStyle(0x59391f, 1);
    g.fillRect(-68, -46, 136, 12);
    g.fillStyle(0x3b2413, 1);
    g.fillRect(-62, -36, 8, 34);
    g.fillRect(54, -36, 8, 34);
    for (let i = 0; i < 7; i++) {
      const colors = red ? [0xc8412f, 0xe1a93e, 0x7ba13e, 0x9b4e2c] : [0x4f8e7a, 0x3e6f96, 0xb27a35, 0x6b8f3f];
      g.fillStyle(colors[i % colors.length], 1);
      g.fillCircle(-54 + i * 18, -52, 7);
      g.fillStyle(0xf2e4c4, 0.6);
      g.fillCircle(-56 + i * 18, -54, 2.5);
    }
    // Baskets under the table.
    g.fillStyle(0x9a7443, 1);
    g.fillEllipse(-30, -6, 30, 12);
    g.fillStyle(0x6a4c27, 1);
    g.fillEllipse(32, -6, 26, 10);
    c.add(g);
    c.setScale(S);
    return c;
  }

