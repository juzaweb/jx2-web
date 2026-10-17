import * as Phaser from "phaser";

export const WORLD_CONFIG = {
  width: 2200,
  height: 1250
};

export class WorldManager {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.width = WORLD_CONFIG.width;
    this.height = WORLD_CONFIG.height;
    this.obstacles = null;
  }

  create() {
    this.obstacles = this.scene.physics.add.staticGroup();
    this.drawTerrain();
    this.drawRoad();
    this.drawRiver();
    this.drawWorldBorder();
    this.drawBuildings();
    this.drawStreetLanterns();
    this.drawDecorations();
    this.drawLabels();
  }

  drawTerrain() {
    const g = this.scene.add.graphics();
    g.fillGradientStyle(0x2b4635, 0x2b4635, 0x1f3429, 0x1f3429, 1);
    g.fillRect(0, 0, this.width, this.height);

    // Decorative grass patches
    for (let i = 0; i < 180; i++) {
      const x = Phaser.Math.Between(10, this.width - 10);
      const y = Phaser.Math.Between(10, this.height - 10);
      if (y > 490 && y < 740) continue; // Keep main road clear

      g.fillStyle([0x39593d, 0x4d6942, 0x284b37][i % 3], 0.75);
      g.fillEllipse(x, y, Phaser.Math.Between(8, 25), Phaser.Math.Between(4, 12));
    }
  }

  drawRoad() {
    const g = this.scene.add.graphics();
    // Ancient stone road foundation
    g.fillStyle(0x6a6250, 0.92);
    g.fillPoints([
      { x: 0, y: 510 },
      { x: this.width, y: 510 },
      { x: this.width, y: 720 },
      { x: 0, y: 720 }
    ], true);

    // Stone paving slabs
    g.fillStyle(0x8a8069, 0.42);
    for (let x = 0; x < this.width; x += 84) {
      g.fillRect(x, 512, 2, 204);
      for (let y = 530; y < 710; y += 56) {
        g.fillRect(x + 4, y, 74, 2);
      }
    }
  }

  drawRiver() {
    const g = this.scene.add.graphics();
    // Flowing river stream
    g.fillStyle(0x315c67, 0.85);
    g.fillPoints([
      { x: 0, y: 925 },
      { x: 390, y: 900 },
      { x: 650, y: 950 },
      { x: 930, y: 910 },
      { x: 1200, y: 960 },
      { x: 1540, y: 930 },
      { x: 1800, y: 990 },
      { x: 2200, y: 960 },
      { x: 2200, y: 1080 },
      { x: 0, y: 1080 }
    ], true);

    // Water ripple lines
    g.lineStyle(3, 0x7eb1b1, 0.25);
    for (let i = 0; i < 12; i++) {
      g.lineBetween(i * 200, 970 + (i % 3) * 20, i * 200 + 130, 960 + (i % 3) * 20);
    }
  }

  drawWorldBorder() {
    const g = this.scene.add.graphics();
    g.lineStyle(3, 0x9a8657, 0.5);
    g.strokeRect(8, 8, this.width - 16, this.height - 16);
  }

  drawBuildings() {
    this.drawBuilding(260, 280, 220, 150, "客棧"); // Inn
    this.drawBuilding(1510, 260, 230, 160, "武館"); // Martial Academy
    this.drawBuilding(900, 220, 180, 130, "藥舖"); // Apothecary
  }

  drawBuilding(x, y, w, h, label) {
    const group = this.scene.add.container(x, y);
    const shadow = this.scene.add.ellipse(w / 2, h + 10, w + 25, 22, 0x101812, 0.35);
    const body = this.scene.add.rectangle(w / 2, h / 2, w, h, 0x574538).setStrokeStyle(3, 0x342a20);
    const door = this.scene.add.rectangle(w / 2, h - 32, 34, 64, 0x2c241e).setStrokeStyle(2, 0x9c7541);
    const roof = this.scene.add.triangle(
      w / 2, 3,
      -28, 48,
      w / 2, -48,
      w + 28, 48,
      0x302a25
    ).setStrokeStyle(3, 0x9c7747);
    const plaque = this.scene.add.rectangle(w / 2, 42, 76, 25, 0x242521).setStrokeStyle(1, 0xc5a45f);
    const text = this.scene.add.text(w / 2, 42, label, {
      fontFamily: "serif",
      fontSize: "15px",
      color: "#f1dba3"
    }).setOrigin(0.5);

    group.add([shadow, body, door, roof, plaque, text]);
    group.setDepth(y + h);

    // Static physics body for building collision
    if (this.obstacles) {
      const colWidth = Math.max(20, w - 16);
      const colHeight = Math.max(20, h * 0.6);
      const colY = y + h * 0.65;
      const obstacle = this.obstacles.create(x + w / 2, colY, "entity-dot");
      obstacle.setSize(colWidth, colHeight);
      obstacle.setVisible(false);
      obstacle.refreshBody();
    }
  }

  /**
   * Get static physics group containing world obstacles (buildings)
   * @returns {Phaser.Physics.Arcade.StaticGroup}
   */
  getObstacles() {
    return this.obstacles;
  }

  drawStreetLanterns() {
    for (let x = 100; x < this.width; x += 220) {
      this.scene.add.circle(x, 485, 6, 0xffc66e, 0.95).setDepth(1);
      this.scene.add.circle(x, 485, 14, 0xffa52c, 0.09).setDepth(1);
      this.scene.add.rectangle(x, 470, 3, 22, 0x40372a).setDepth(1);
    }
  }

  drawDecorations() {
    for (let i = 0; i < 42; i++) {
      const x = Phaser.Math.Between(30, this.width - 30);
      const y = Phaser.Math.Between(40, this.height - 40);
      if ((y > 450 && y < 740) || (y > 900 && y < 1090)) continue;

      const tree = this.scene.add.container(x, y);
      tree.add(this.scene.add.ellipse(0, 24, 38, 13, 0x101810, 0.28));
      tree.add(this.scene.add.rectangle(0, 8, 10, 28, 0x5c4530));
      tree.add(this.scene.add.circle(-8, -7, 18, 0x29452f));
      tree.add(this.scene.add.circle(9, -15, 22, 0x365a39));
      tree.add(this.scene.add.circle(12, 0, 15, 0x42653c));
      tree.setDepth(y);
    }
  }

  drawLabels() {
    this.scene.add.text(640, 445, "長 安 古 道  •  TRƯỜNG AN CỔ ĐẠO", {
      fontFamily: "serif",
      fontSize: "19px",
      color: "#e8d6a9",
      stroke: "#29261d",
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(2);

    this.scene.add.text(1090, 785, "BÃI LUYỆN CÔNG", {
      fontFamily: "serif",
      fontSize: "18px",
      color: "#d8c79d",
      stroke: "#1a241c",
      strokeThickness: 4
    }).setDepth(5);
  }
}
