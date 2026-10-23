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

/** Front-facing 2.5D shop painter with a sprite fallback. */

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

