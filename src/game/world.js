import * as Phaser from "phaser";

export const WORLD_CONFIG = {
  width: 2200,
  height: 1250
};

export const NPC_DATA = [
  {
    id: "duoc-diem",
    name: "Chủ Dược Điếm",
    x: 580,
    y: 380,
    type: "herbalist",
    dialogue:
      'Chủ Dược Điếm: "Hoan nghênh hiệp khách ghé Dược Điếm Biện Kinh! Bổn tiệm chuyên cung cấp Kim Sáng Dược, Đại Hoàn Đan thượng hạng trị thương hồi khí."'
  },
  {
    id: "bach-tien-sinh",
    name: "Bạch Tiên Sinh",
    x: 780,
    y: 780,
    type: "scholar",
    dialogue:
      'Bạch Tiên Sinh: "Giang hồ hiểm ác, lòng người khó lường. Thiếu hiệp hành tẩu Biện Kinh nhớ giữ gìn bản tâm, chăm chỉ tu luyện võ công!"'
  },
  {
    id: "thuong-nhan-bao-ruong",
    name: "Thương Nhân Bảo Rương",
    x: 990,
    y: 800,
    type: "merchant",
    dialogue:
      'Thương Nhân Bảo Rương: "Khắp nơi trong thiên hạ đều có bảo rương ẩn giấu kỳ trân dị bảo. Thiếu hiệp nếu có chìa khóa hoàng kim, hãy mang đến đây đổi lấy tuyệt thế thần binh!"'
  },
  {
    id: "dai-su-hoat-dong",
    name: "Đại Sứ Hoạt Động",
    x: 1090,
    y: 690,
    type: "ambassador",
    dialogue:
      'Đại Sứ Hoạt Động: "Hoan nghênh chư vị anh hùng đến với Biện Kinh! Tham gia các hoạt động giang hồ mỗi ngày để nhận vinh dự và phần thưởng quý giá."'
  },
  {
    id: "chan-tu-don",
    name: "Chân Tử Đơn",
    x: 1220,
    y: 520,
    type: "martial",
    dialogue:
      'Chân Tử Đơn: "Võ học vô biên! Luyện tập quyền cước hàng ngày chính là căn cơ để xưng bá võ lâm."'
  },
  {
    id: "van-su-thong",
    name: "Vạn Sự Thông",
    x: 1160,
    y: 480,
    type: "sage",
    dialogue:
      'Vạn Sự Thông: "Thiên hạ sự tình, phong vân biến ảo, không điều gì mà lão phu không tường. Thiếu hiệp muốn dò hỏi tin tức chốn võ lâm chăng?"'
  }
];

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
   * Authentic JX2 Biện Kinh grand stone plaza floor
   * Large isometric sandstone slabs with subtle gradients, bevels, and curb transition
   */
  drawPavedGround() {
    const g = this.scene.add.graphics();

    // 1. Base warm sandstone color
    g.fillStyle(0xd9d3c7, 1);
    g.fillRect(0, 0, this.width, this.height);

    // 2. Cobblestone / Flagstone foundation for Dược Điếm in top-left
    // Matches the reference screenshot where under the shop awning is cobblestone/slate paving
    g.fillStyle(0x756f64, 1);
    g.fillPoints([
      { x: 0, y: 0 },
      { x: 740, y: 0 },
      { x: 740, y: 240 },
      { x: 120, y: 560 },
      { x: 0, y: 560 }
    ], true);

    // Irregular cobblestone stones inside Dược Điếm porch area
    const rng = (seed) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    g.lineStyle(1.5, 0x474239, 0.7);
    for (let py = 20; py < 540; py += 32) {
      for (let px = 20; px < 720; px += 36) {
        // Only draw if inside shop perimeter
        if (px < 740 - ((py - 240) * (620 / 320))) {
          const val = rng(px * 17 + py * 43);
          const stoneColor = val > 0.6 ? 0x8a8477 : val > 0.3 ? 0x6e685c : 0x7e786b;
          g.fillStyle(stoneColor, 0.85);
          const w = 26 + (val * 8);
          const h = 18 + (val * 6);
          g.fillRoundedRect(px - w / 2, py - h / 2, w, h, 6);
          g.strokeRoundedRect(px - w / 2, py - h / 2, w, h, 6);
        }
      }
    }

    // 3. Diagonal Stone Curb Steps (Bậc thềm đá hoa cương phân cách vỉa hè tiệm và quảng trường)
    // Runs from (120, 560) diagonally to (740, 240)
    g.fillStyle(0x8a8477, 1);
    g.fillPoints([
      { x: 120, y: 560 },
      { x: 740, y: 240 },
      { x: 765, y: 252 },
      { x: 145, y: 572 }
    ], true);
    // Curb top highlight
    g.lineStyle(2, 0xbeb7a9, 0.9);
    g.lineBetween(120, 560, 740, 240);
    // Curb shadow line
    g.lineStyle(2, 0x484339, 0.8);
    g.lineBetween(145, 572, 765, 252);

    // Chiseled joints along the curb stones
    const curbSteps = 24;
    for (let i = 0; i <= curbSteps; i++) {
      const t = i / curbSteps;
      const kx1 = 120 + t * (740 - 120);
      const ky1 = 560 + t * (240 - 560);
      const kx2 = 145 + t * (765 - 145);
      const ky2 = 572 + t * (252 - 572);
      g.lineStyle(1.5, 0x484339, 0.7);
      g.lineBetween(kx1, ky1, kx2, ky2);
    }

    // 4. Grand Isometric Stone Paving Diamond Grid for Central Plaza (76px width, 38px height)
    const tileW = 76;
    const tileH = 38;

    // Subtle mortar lines
    g.lineStyle(1.2, 0xb8b0a1, 0.7);

    // Diagonal lines Set 1: Down-Right
    const totalDiagonals = Math.ceil((this.width + this.height * 2) / tileW) + 12;
    for (let i = -12; i < totalDiagonals; i++) {
      const startX = i * tileW;
      g.lineBetween(startX, 0, startX + this.height * 2, this.height);
    }

    // Diagonal lines Set 2: Down-Left
    for (let i = -12; i < totalDiagonals; i++) {
      const startX = i * tileW;
      g.lineBetween(startX, 0, startX - this.height * 2, this.height);
    }

    // 5. Authentic stone slab lighting & natural variations
    for (let row = 0; row < Math.ceil(this.height / tileH); row++) {
      for (let col = 0; col < Math.ceil(this.width / tileW) + 2; col++) {
        const cx = col * tileW + (row % 2 === 0 ? 0 : tileW / 2);
        const cy = row * tileH;

        // Skip slabs covered by Dược Điếm cobblestone foundation
        if (cx < 740 && cy < 560 && cx < 740 - ((cy - 240) * (620 / 320))) {
          continue;
        }

        const val = rng(row * 47 + col * 93);
        if (val > 0.55) {
          // Subtle warm beige / cool granite tint
          const tint = val > 0.85 ? 0xeae5dc : val > 0.7 ? 0xd0c9bd : 0xe0dad0;
          g.fillStyle(tint, 0.5);
          g.fillPoints([
            { x: cx, y: cy - tileH / 2 },
            { x: cx + tileW / 2, y: cy },
            { x: cx, y: cy + tileH / 2 },
            { x: cx - tileW / 2, y: cy }
          ], true);
        }
      }
    }
  }

  /**
   * Dược Điếm (Apothecary Shop at top-left - directly in front of the player matching user reference screenshot)
   * Large wooden veranda, umbrella sunshade, medicine drying baskets, jars, blue brocade cloth table, and stone lantern
   */
  drawApothecaryShop() {
    const shop = this.scene.add.container(0, 0);

    // 1. Wooden wall facade along the back (warm natural cedar planks)
    const wallGraphics = this.scene.add.graphics();
    wallGraphics.fillStyle(0x7c5835, 1);
    wallGraphics.fillPoints([
      { x: 0, y: 0 },
      { x: 640, y: 0 },
      { x: 640, y: 150 },
      { x: 0, y: 440 }
    ], true);

    // Vertical plank lines
    wallGraphics.lineStyle(1.5, 0x51351c, 0.75);
    for (let wx = 20; wx < 640; wx += 22) {
      wallGraphics.lineBetween(wx, 0, wx, (wx * 150) / 640 + 100);
    }
    shop.add(wallGraphics);

    // 2. Heavy dark timber support columns
    const c1 = this.scene.add.rectangle(180, 240, 22, 100, 0x3d2719).setStrokeStyle(2, 0x1f1108);
    const c2 = this.scene.add.rectangle(380, 160, 22, 100, 0x3d2719).setStrokeStyle(2, 0x1f1108);
    const c3 = this.scene.add.rectangle(570, 90, 22, 100, 0x3d2719).setStrokeStyle(2, 0x1f1108);
    shop.add([c1, c2, c3]);

    // 3. Hanging signboard "DƯỢC ĐIẾM"
    const signBoard = this.scene.add.rectangle(480, 110, 140, 32, 0x181816).setStrokeStyle(2.5, 0xd4af37);
    const signText = this.scene.add.text(480, 110, "藥 舖 • DƯỢC ĐIẾM", {
      fontFamily: "Arial, Tahoma, sans-serif",
      fontSize: "13px",
      color: "#ffdf7a",
      fontStyle: "bold"
    }).setOrigin(0.5);
    shop.add([signBoard, signText]);

    // 4. Large rustic canvas umbrella / sunshade at (240, 430) (Dù bạt che mưa nắng)
    const umbrella = this.createSunshadeUmbrella(240, 430);
    shop.add(umbrella);

    // 5. Merchant table with blue brocade cloth at (360, 460)
    const tableContainer = this.scene.add.container(360, 460);
    const tableShadow = this.scene.add.ellipse(0, 28, 130, 22, 0x161c16, 0.45);

    const tg = this.scene.add.graphics();
    // Wooden table legs
    tg.fillStyle(0x3d2415, 1);
    tg.lineStyle(1.5, 0x24140b, 1);
    tg.fillRect(-52, 6, 10, 20);
    tg.strokeRect(-52, 6, 10, 20);
    tg.fillRect(42, 6, 10, 20);
    tg.strokeRect(42, 6, 10, 20);
    tg.fillRect(-50, 10, 100, 6);

    // Blue brocade draped cloth
    tg.fillStyle(0x1d4ed8, 1);
    tg.lineStyle(2, 0xd4af37, 1);
    tg.fillRect(-58, -16, 116, 26);
    tg.strokeRect(-58, -16, 116, 26);
    // Draped hem hanging over front
    tg.fillPoints([
      { x: -58, y: 10 },
      { x: 58, y: 10 },
      { x: 50, y: 22 },
      { x: -50, y: 22 }
    ], true);
    tg.strokePoints([
      { x: -58, y: 10 },
      { x: 58, y: 10 },
      { x: 50, y: 22 },
      { x: -50, y: 22 }
    ], true);

    // Gold floral cloud rosettes on cloth
    tg.fillStyle(0xfacc15, 0.85);
    tg.fillCircle(-30, -3, 9);
    tg.fillCircle(30, -1, 10);
    tg.fillStyle(0xfef08a, 0.95);
    tg.fillCircle(0, -4, 8);

    // Display items on table (scrolls, medicine packet)
    const scroll1 = this.scene.add.rectangle(-36, -14, 18, 9, 0xfef3c7).setStrokeStyle(1, 0x78350f);
    const scroll2 = this.scene.add.rectangle(-16, -17, 14, 7, 0xfef3c7).setStrokeStyle(1, 0x78350f);
    const herbJar = this.scene.add.circle(38, -14, 7, 0x059669).setStrokeStyle(1.5, 0xd4af37);

    tableContainer.add([tableShadow, tg, scroll1, scroll2, herbJar]);
    shop.add(tableContainer);

    // 6. Straw mat with shoes neatly arranged beside the table at (300, 500)
    const matContainer = this.scene.add.container(300, 500);
    const mat = this.scene.add.rectangle(0, 0, 46, 30, 0xc4b595).setStrokeStyle(1.5, 0x8a7a58);
    const shoeL = this.scene.add.ellipse(-8, 0, 10, 16, 0x991b1b).setStrokeStyle(1, 0x450a0a);
    const shoeR = this.scene.add.ellipse(8, 0, 10, 16, 0x991b1b).setStrokeStyle(1, 0x450a0a);
    matContainer.add([mat, shoeL, shoeR]);
    shop.add(matContainer);

    // 7. Wicker herb drying baskets (Nong / nia phơi thảo mộc)
    const basket1 = this.createHerbBasket(370, 390, 0x4d7c0f); // Green medicinal leaves
    const basket2 = this.createHerbBasket(450, 430, 0xd97706); // Golden ginseng powder / root slices
    const basket3 = this.createHerbBasket(500, 400, 0x15803d); // Dark healing herbs
    const basket4 = this.createHerbBasket(545, 445, 0xb91c1c); // Red wolfberries (kỷ tử)
    shop.add([basket1, basket2, basket3, basket4]);

    // 8. Ceramic medicine jugs & jars (Bình gốm & vò thuốc lớn)
    const jar1 = this.createCeramicJar(485, 470, 0x78350f, 20, 28);
    const jar2 = this.createCeramicJar(525, 480, 0x92400e, 24, 32);
    const jar3 = this.createCeramicJar(285, 460, 0xd97706, 18, 24);
    shop.add([jar1, jar2, jar3]);

    // 9. Ancient stone pagoda lantern at (380, 550) (Đèn đá hoa đăng cổ)
    const stoneLantern = this.createStonePagodaLantern(380, 550);
    shop.add(stoneLantern);

    shop.setDepth(350);

    // Static physics collider behind counter and shop wall
    if (this.obstacles) {
      const col = this.obstacles.create(320, 320, "entity-dot");
      col.setSize(480, 220);
      col.setVisible(false);
      col.refreshBody();
    }
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
    c.setDepth(y + 30);
    return c;
  }

  /**
   * Tiền Trang (Bank & Treasury at north-east avenue)
   */
  drawBankShop() {
    const bx = 1650;
    const by = 320;
    const group = this.scene.add.container(bx, by);

    // Terrace base
    const base = this.scene.add.rectangle(0, 70, 360, 60, 0x57534e).setStrokeStyle(2, 0x292524);
    const steps = this.scene.add.rectangle(0, 95, 120, 20, 0x78716c).setStrokeStyle(1.5, 0x44403c);

    // Wall facade
    const wall = this.scene.add.rectangle(0, 0, 330, 110, 0x6b2e2b).setStrokeStyle(3, 0x3d1715);

    // Red lacquered columns with gold bases
    for (let i = -2; i <= 2; i++) {
      const colX = i * 70;
      group.add(this.scene.add.rectangle(colX, 0, 16, 110, 0x991b1b).setStrokeStyle(1.5, 0x450a0a));
      group.add(this.scene.add.rectangle(colX, 50, 22, 10, 0xd4af37));
    }

    // Main vault door with heavy brass rings
    const door = this.scene.add.rectangle(0, 15, 60, 75, 0x271915).setStrokeStyle(2, 0xd4af37);
    const ringL = this.scene.add.circle(-12, 15, 5, 0xeab308);
    const ringR = this.scene.add.circle(12, 15, 5, 0xeab308);

    // Curved imperial tile roof
    const roof = this.scene.add.triangle(0, -55, -190, 35, 0, -60, 190, 35, 0x262e38).setStrokeStyle(3, 0xd4af37);

    // Plaque "TIỀN TRANG"
    const plaque = this.scene.add.rectangle(0, -42, 130, 28, 0x181816).setStrokeStyle(2, 0xd4af37);
    const text = this.scene.add.text(0, -42, "錢 莊 • TIỀN TRANG", {
      fontFamily: "Arial, Tahoma, sans-serif",
      fontSize: "13px",
      color: "#ffdf7a",
      fontStyle: "bold"
    }).setOrigin(0.5);

    group.add([base, steps, wall, door, ringL, ringR, roof, plaque, text]);
    group.setDepth(by + 100);

    if (this.obstacles) {
      const col = this.obstacles.create(bx, by + 40, "entity-dot");
      col.setSize(330, 90);
      col.setVisible(false);
      col.refreshBody();
    }
  }

  /**
   * Tiểu Viễn Lâu (Famous Grand Tavern at south-west avenue)
   */
  drawTavernShop() {
    const tx = 240;
    const ty = 1020;
    const group = this.scene.add.container(tx, ty);

    // Ground shadow
    const shadow = this.scene.add.ellipse(0, 110, 360, 40, 0x141813, 0.4);
    // Wooden deck
    const deck = this.scene.add.rectangle(0, 90, 340, 40, 0x6e4e37).setStrokeStyle(2, 0x3d2719);
    // Tavern lower floor
    const floor1 = this.scene.add.rectangle(0, 20, 300, 110, 0x5e3a24).setStrokeStyle(2.5, 0x2e1a0d);
    // Tavern upper floor
    const floor2 = this.scene.add.rectangle(0, -65, 260, 80, 0x6b432b).setStrokeStyle(2, 0x2e1a0d);
    // Upper balcony lattice railing
    const balcony = this.scene.add.rectangle(0, -30, 270, 16, 0x3d2415).setStrokeStyle(1.5, 0xb45309);
    // Multi-tier pagoda roof
    const roof1 = this.scene.add.triangle(0, -20, -170, 25, 0, -35, 170, 25, 0x242d38).setStrokeStyle(2.5, 0x9c7747);
    const roof2 = this.scene.add.triangle(0, -100, -155, 25, 0, -45, 155, 25, 0x1f2937).setStrokeStyle(2.5, 0xd4af37);

    // Plaque "TIỂU VIỄN LÂU"
    const plaque = this.scene.add.rectangle(0, 10, 140, 26, 0x181816).setStrokeStyle(2, 0xd4af37);
    const text = this.scene.add.text(0, 10, "酒 樓 • TIỂU VIỄN LÂU", {
      fontFamily: "Arial, Tahoma, sans-serif",
      fontSize: "12px",
      color: "#ffdf7a",
      fontStyle: "bold"
    }).setOrigin(0.5);

    // Wine flag pole with crimson flag "酒" (Tửu)
    const pole = this.scene.add.rectangle(160, 30, 5, 140, 0x4a3420);
    const flag = this.scene.add.rectangle(185, -15, 45, 45, 0xdc2626).setStrokeStyle(2, 0x7f1d1d);
    const flagText = this.scene.add.text(185, -15, "酒", {
      fontFamily: "serif",
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    // Casks outside
    const cask1 = this.scene.add.ellipse(-110, 85, 36, 26, 0x78350f).setStrokeStyle(1.5, 0x361605);
    const cask2 = this.scene.add.ellipse(-80, 85, 36, 26, 0x78350f).setStrokeStyle(1.5, 0x361605);

    group.add([shadow, deck, floor1, floor2, balcony, roof1, roof2, plaque, text, pole, flag, flagText, cask1, cask2]);
    group.setDepth(ty + 110);

    if (this.obstacles) {
      const col = this.obstacles.create(tx, ty + 50, "entity-dot");
      col.setSize(300, 100);
      col.setVisible(false);
      col.refreshBody();
    }
  }

  /**
   * Võ Quán Biện Kinh (Martial Arts Academy at south-east avenue)
   */
  drawMartialAcademy() {
    const mx = 1750;
    const my = 850;
    const group = this.scene.add.container(mx, my);

    // Platform
    const platform = this.scene.add.rectangle(0, 60, 380, 90, 0x574f44).setStrokeStyle(2, 0x332e27);
    const hall = this.scene.add.rectangle(0, -10, 320, 120, 0x4d3829).setStrokeStyle(3, 0x261a11);
    const roof = this.scene.add.triangle(0, -65, -185, 30, 0, -55, 185, 30, 0x2d3748).setStrokeStyle(3, 0x94a3b8);

    const plaque = this.scene.add.rectangle(0, -35, 170, 28, 0x111827).setStrokeStyle(2, 0xf59e0b);
    const text = this.scene.add.text(0, -35, "武 館 • VÕ QUÁN", {
      fontFamily: "Arial, Tahoma, sans-serif",
      fontSize: "13px",
      color: "#fef08a",
      fontStyle: "bold"
    }).setOrigin(0.5);

    const dummy1 = this.createTrainingDummy(-110, 65);
    const dummy2 = this.createTrainingDummy(-60, 65);
    const weaponRack = this.createHeavyWeaponRack(100, 65);

    group.add([platform, hall, roof, plaque, text, dummy1, dummy2, weaponRack]);
    group.setDepth(my + 100);

    if (this.obstacles) {
      const col = this.obstacles.create(mx, my + 30, "entity-dot");
      col.setSize(320, 100);
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
   * Vạn Sự Thông Đình Đài (Octagonal Central Pavilion)
   */
  drawCentralPavilion() {
    const cx = 1160;
    const cy = 420;
    const group = this.scene.add.container(cx, cy);

    // Podium shadow
    const shadow = this.scene.add.ellipse(0, 65, 240, 50, 0x141813, 0.4);
    // Octagonal granite podium
    const base = this.scene.add.circle(0, 45, 95, 0x635b4f).setStrokeStyle(2.5, 0x3d362b);
    const innerBase = this.scene.add.circle(0, 42, 80, 0x787063).setStrokeStyle(1.5, 0x473f33);

    // Columns
    const col1 = this.scene.add.rectangle(-55, 10, 14, 80, 0x3b2416).setStrokeStyle(1.5, 0x1f1109);
    const col2 = this.scene.add.rectangle(55, 10, 14, 80, 0x3b2416).setStrokeStyle(1.5, 0x1f1109);

    // Pagoda tile roof
    const roof = this.scene.add.triangle(0, -35, -135, 30, 0, -65, 135, 30, 0x1e2e38).setStrokeStyle(3, 0x10b981);

    // Jade plaque "VẠN SỰ THÔNG"
    const plaque = this.scene.add.rectangle(0, -42, 140, 24, 0x064e3b).setStrokeStyle(2, 0x34d399);
    const text = this.scene.add.text(0, -42, "萬 事 通 • VẠN SỰ THÔNG", {
      fontFamily: "Arial, Tahoma, sans-serif",
      fontSize: "11px",
      color: "#a7f3d0",
      fontStyle: "bold"
    }).setOrigin(0.5);

    group.add([shadow, base, innerBase, col1, col2, roof, plaque, text]);
    group.setDepth(cy + 65);

    if (this.obstacles) {
      const col = this.obstacles.create(cx, cy + 45, "entity-dot");
      col.setSize(140, 60);
      col.setVisible(false);
      col.refreshBody();
    }
  }

  /**
   * Dragon Balustrade (Lan can đá chạm rồng - matching bottom-right of user screenshot)
   * Positioned at the bottom-right corner of the player view around (1140, 880)
   */
  drawDragonBalustrades() {
    const rx = 1140;
    const ry = 880;
    const group = this.scene.add.container(rx, ry);

    // Stone ramp steps
    const step1 = this.scene.add.rectangle(0, 20, 160, 24, 0x8a8477).setStrokeStyle(2, 0x575249);
    const step2 = this.scene.add.rectangle(15, 36, 160, 24, 0x7a7468).setStrokeStyle(2, 0x484339);

    // Carved stone dragon head & ramp balustrade
    const dragonG = this.scene.add.graphics();
    dragonG.fillStyle(0x948e82, 1);
    dragonG.lineStyle(2, 0x4f4a3f, 1);

    // Dragon curved balustrade body
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

    // Dragon head sculpted finial facing North-West towards plaza
    dragonG.fillStyle(0xa8a296, 1);
    dragonG.fillCircle(-55, -22, 18);
    dragonG.strokeCircle(-55, -22, 18);

    // Dragon snout, horn, and eye
    dragonG.fillPoints([
      { x: -75, y: -26 },
      { x: -55, y: -34 },
      { x: -50, y: -16 }
    ], true);
    dragonG.strokePoints([
      { x: -75, y: -26 },
      { x: -55, y: -34 },
      { x: -50, y: -16 }
    ], true);

    // Dragon horn
    dragonG.fillStyle(0x6e685c, 1);
    dragonG.fillTriangle(-50, -36, -42, -52, -36, -34);
    dragonG.strokeTriangle(-50, -36, -42, -52, -36, -34);

    // Stone Pearl in dragon's jaws
    dragonG.fillStyle(0xfef08a, 1);
    dragonG.fillCircle(-70, -20, 6);

    // Dragon Eye
    dragonG.fillStyle(0x18181b, 1);
    dragonG.fillCircle(-58, -25, 3.5);

    // Lotus bud baluster post
    const post = this.scene.add.rectangle(-40, 20, 16, 44, 0x8a8477).setStrokeStyle(1.5, 0x575249);
    const lotusBud = this.scene.add.circle(-40, -4, 10, 0xa8a296).setStrokeStyle(1.5, 0x575249);

    group.add([step1, step2, dragonG, post, lotusBud]);
    group.setDepth(ry + 20);

    if (this.obstacles) {
      const col = this.obstacles.create(rx, ry + 15, "entity-dot");
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
    this.npcs.forEach((npc) => {
      this.createNPC(npc.x, npc.y, npc.name, npc.type);
    });
  }

  /**
   * Build authentic JX2 NPC figure with overhead name
   */
  createNPC(x, y, name, type = "scholar") {
    const c = this.scene.add.container(x, y);

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
    c.setDepth(y + 20);

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
    g.strokeRect(6, 6, this.width - 12, this.height - 12);
  }

  /**
   * Backward-compatible methods
   */
  drawRoad() {}
  drawRiver() {}
  drawBuildings() {}
  drawStreetLanterns() {}

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
    return this.npcs ? [...this.npcs] : [];
  }
}
