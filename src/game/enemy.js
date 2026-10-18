import * as Phaser from "phaser";
import { stepEnemy } from "./enemyAi.js";
import { interpolateEnemyPosition, reconcileEnemyState } from "./enemySync.js";

export class Wolf {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {number} id
   */
  constructor(scene, x, y, id) {
    this.scene = scene;
    this.id = id;
    this.homeX = x;
    this.homeY = y;
    this.hp = 45;
    this.maxHp = 45;
    this.attack = 12;
    this.defense = 3;
    this.critRate = 0.05;
    this.critDamage = 1.5;
    this.stats = {
      attack: 12,
      defense: 3,
      critRate: 0.05,
      critDamage: 1.5
    };
    this.isDead = false;
    this.nextBite = 0;
    // Where the server says this wolf is; the render follows it (see update())
    this.targetX = x;
    this.targetY = y;

    this.createSprite(x, y);
    this.createVisuals(x, y);
  }

  createSprite(x, y) {
    this.sprite = this.scene.physics.add.sprite(x, y, "entity-dot");
    this.sprite.setSize(30, 22);
    this.sprite.body.setCollideWorldBounds(true);
    this.sprite.body.setDrag(250, 250);
    this.sprite.body.setMaxVelocity(90, 90);
    this.sprite.setDepth(y);
    this.sprite.setVisible(false);
  }

  createVisuals(x, y) {
    this.wolfVisual = this.scene.add.container(x, y).setDepth(y);
    this.drawWolf(this.wolfVisual);

    this.hpBack = this.scene.add.rectangle(x, y - 20, 38, 4, 0x1b1714).setDepth(y + 1);
    this.hpFill = this.scene.add.rectangle(x, y - 20, 36, 2, 0xc94a3f).setDepth(y + 2);
    this.nameText = this.scene.add.text(x, y - 29, "Sói Xám", {
      fontFamily: "Arial, Tahoma, sans-serif",
      fontSize: "10px",
      color: "#e5d6bb",
      stroke: "#1c201a",
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(y + 3);
  }

  drawWolf(container) {
    const shadow = this.scene.add.ellipse(0, 13, 42, 12, 0x0b100d, 0.35);
    const body = this.scene.add.ellipse(0, 0, 36, 20, 0x747b79).setStrokeStyle(2, 0x353d3a);
    const head = this.scene.add.circle(17, -6, 10, 0x929b96).setStrokeStyle(2, 0x454b48);
    const ear = this.scene.add.triangle(16, -16, -5, 8, 0, -7, 6, 7, 0x626b67);
    const muzzle = this.scene.add.triangle(27, -2, -2, -5, 9, 0, -2, 5, 0xadb4a8);
    const eye = this.scene.add.circle(20, -8, 2, 0xffd26b);
    const leg1 = this.scene.add.rectangle(-10, 11, 5, 12, 0x424b48);
    const leg2 = this.scene.add.rectangle(8, 11, 5, 12, 0x424b48);
    const tail = this.scene.add.line(-19, 0, -1, 0, -10, -8, 0x858c87).setLineWidth(4);

    container.add([shadow, tail, body, head, ear, muzzle, eye, leg1, leg2]);
  }

  update(time, delta, player, onBite) {
    if (!this.sprite.active || this.isDead) return;

    // Online the server steps the AI and this render follows its lead; offline the
    // client steps the same shared AI with the local player as the only target
    if (this.usesServerMovement()) {
      this.followServerPosition(delta);
    } else {
      this.stepLocally(delta, player);
    }

    const x = this.sprite.x;
    const y = this.sprite.y;

    this.sprite.setDepth(y);
    this.wolfVisual.setPosition(x, y);
    this.wolfVisual.setDepth(y);

    this.hpBack.setPosition(x, y - 20);
    this.hpBack.setDepth(y + 1);
    this.hpFill.setPosition(x - 19 + (this.hp / this.maxHp) * 19, y - 20);
    this.hpFill.setDepth(y + 2);
    this.hpFill.width = Math.max(0.5, 36 * (this.hp / this.maxHp));
    this.nameText.setPosition(x, y - 29);
    this.nameText.setDepth(y + 3);

    const distance = Phaser.Math.Distance.Between(player.x, player.y, x, y);

    if (distance < 55 && time > this.nextBite) {
      this.nextBite = time + 1400;
      if (typeof onBite === "function") {
        onBite(this);
      }
    }
  }

  /**
   * True while a server owns the roster; movement then arrives as snapshots
   * instead of being simulated here.
   * @returns {boolean}
   */
  usesServerMovement() {
    return this.scene?.networkClient?.isConnected === true;
  }

  /**
   * Online: render the position the server is leading towards.
   * @param {number} deltaMs
   */
  followServerPosition(deltaMs) {
    if (!Number.isFinite(this.targetX) || !Number.isFinite(this.targetY)) return;

    this.applyStep(
      interpolateEnemyPosition(
        { x: this.x, y: this.y },
        { x: this.targetX, y: this.targetY },
        deltaMs
      )
    );
  }

  /**
   * Offline: step the shared AI (src/game/enemyAi.js) against the local player.
   * @param {number} deltaMs
   * @param {{x:number, y:number}} player
   */
  stepLocally(deltaMs, player) {
    const next = stepEnemy(
      { x: this.x, y: this.y, homeX: this.homeX, homeY: this.homeY },
      [{ x: player.x, y: player.y }],
      deltaMs
    );

    this.applyStep(next);
  }

  /**
   * Place the wolf (and its body) on an already-decided position and face the way
   * it moved.
   * @param {{x:number, y:number}} next
   */
  applyStep(next) {
    const previousX = this.x;
    if (next.x === previousX && next.y === this.y) return;

    this.placeAt(next.x, next.y);
    if (Math.abs(next.x - previousX) > 1) {
      this.wolfVisual.setScale(next.x < previousX ? -1 : 1, 1);
    }
  }

  /**
   * Put the sprite and its physics body on a position.
   * @param {number} x
   * @param {number} y
   */
  placeAt(x, y) {
    if (this.sprite.body?.reset) {
      this.sprite.body.reset(x, y);
    } else {
      this.sprite.setPosition(x, y);
    }
  }

  takeHit(damage) {
    if (this.isDead) return;
    this.hp -= damage;
    this.wolfVisual.setAlpha(0.45);
    this.scene.time.delayedCall(100, () => {
      if (this.sprite.active && !this.isDead) {
        this.wolfVisual.setAlpha(1);
      }
    });
  }

  /**
   * Apply an authoritative server snapshot: health always, position by the
   * server's lead (a warp is applied at once, anything smaller is smoothed).
   * @param {{x?:number,y?:number,hp?:number,isDead?:boolean}} state
   */
  applyServerState(state = {}) {
    if (!this.sprite.active) return;

    const next = reconcileEnemyState(
      { x: this.x, y: this.y, hp: this.hp, maxHp: this.maxHp, isDead: this.isDead },
      state
    );

    this.hp = next.hp;

    if (next.isDead) {
      if (!this.isDead) this.die();
      return;
    }

    if (this.isDead) this.revive();

    if (Number.isFinite(state.x) && Number.isFinite(state.y)) {
      this.targetX = state.x;
      this.targetY = state.y;
      if (next.snap) this.placeAt(state.x, state.y);
    }
  }

  die() {
    this.isDead = true;
    this.sprite.body.enable = false;
    this.wolfVisual.setVisible(false);
    this.hpBack.setVisible(false);
    this.hpFill.setVisible(false);
    this.nameText.setVisible(false);
  }

  revive() {
    if (!this.sprite.active) return;
    this.isDead = false;
    this.hp = this.maxHp;
    this.sprite.setPosition(this.homeX, this.homeY);
    this.sprite.body.enable = true;
    this.targetX = this.homeX;
    this.targetY = this.homeY;
    this.wolfVisual.setVisible(true);
    this.wolfVisual.setAlpha(1);
    this.hpBack.setVisible(true);
    this.hpFill.setVisible(true);
    this.nameText.setVisible(true);
  }

  get x() {
    return this.sprite.x;
  }

  get y() {
    return this.sprite.y;
  }

  get active() {
    return this.sprite.active;
  }
}

export class EnemyManager {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.enemies = [];
    this.group = null;
  }

  /**
   * @param {Array<[number, number]>} positions spawn points, kept in sync with the
   * server's `ENEMY_SPAWNS` in `server/src/websocket/gameSocket.js` (id = index)
   */
  create(positions = [
    [840, 600],
    [950, 670],
    [1110, 590],
    [1260, 650],
    [1380, 590],
    [760, 800],
    [1050, 820],
    [1320, 790]
  ]) {
    this.group = this.scene.physics.add.group();
    positions.forEach((pos, i) => {
      const wolf = new Wolf(this.scene, pos[0], pos[1], i);
      this.group.add(wolf.sprite);
      this.enemies.push(wolf);
    });
  }

  update(time, delta, player, onBite) {
    this.enemies.forEach((wolf) => {
      wolf.update(time, delta, player, onBite);
    });
  }

  respawnEnemies() {
    const aliveCount = this.enemies.filter((w) => w.active && !w.isDead).length;
    if (aliveCount < 4) {
      const deadWolves = this.enemies.filter((w) => w.isDead);
      deadWolves.slice(0, 2).forEach((w) => w.revive());
    }
  }

  getAll() {
    return this.enemies;
  }

  getAlive() {
    return this.enemies.filter((w) => w.active && !w.isDead);
  }

  /**
   * @param {number} id
   * @returns {Wolf|null}
   */
  getById(id) {
    return this.enemies.find((wolf) => wolf.id === id) || null;
  }

  /**
   * Apply one authoritative enemy update (a hit or a respawn)
   * @param {Object} state
   */
  applyEnemyState(state = {}) {
    const wolf = this.getById(state.id);
    if (wolf) wolf.applyServerState(state);
  }

  /**
   * Apply a list of authoritative snapshots: the world-init roster or relayed positions
   * @param {Array<Object>} enemies
   */
  applyServerSnapshot(enemies) {
    if (!Array.isArray(enemies)) return;
    enemies.forEach((enemy) => this.applyEnemyState(enemy));
  }
}
