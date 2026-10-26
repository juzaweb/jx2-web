import * as Phaser from "phaser";
import { getMonster } from "./enemyCatalog.js";
import { drawMonster } from "./enemyVisuals.js";
import { interpolateEnemyPosition, reconcileEnemyState } from "./enemySync.js";
import { toIso, isoDepth } from "./isoProjection.js";
import { WORLD_POSITION_SCALE, WORLD_SCALE, WORLD_SPEED_SCALE } from "./worldConfig.js";

const S = WORLD_SCALE;
const POS = WORLD_POSITION_SCALE;
/** Vertical offset (rig units) for the health bar and name label. */
const LABEL_OFFSET = 20;
const NAME_OFFSET = 29;
/**
 * Roughly the camera's visible width (15 tiles × 380 px), so a name stays on
 * screen while the monster does and is skipped once it is far outside the view.
 */
const NAME_VISIBLE_RANGE = 600 * WORLD_SCALE;

/**
 * One monster instance. Its numbers come from the catalogue
 * (`src/game/enemyCatalog.js`), so adding a species never means editing this
 * class — only its `visual` block has to be understood by `enemyVisuals.js`.
 */
export class Enemy {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {number} id
   * @param {string} [monsterId]
   */
  constructor(scene, x, y, id, monsterId = "soi-xam") {
    this.scene = scene;
    this.id = id;
    this.monster = getMonster(monsterId);
    this.monsterId = this.monster.id;
    this.name = this.monster.name;
    this.level = this.monster.level;
    this.isBoss = !!this.monster.isBoss;

    this.homeX = x;
    this.homeY = y;

    this.maxHp = this.monster.maxHp;
    this.hp = this.maxHp;
    this.attack = this.monster.attack;
    this.defense = this.monster.defense;
    this.critRate = this.monster.critRate;
    this.critDamage = this.monster.critDamage;
    this.stats = {
      attack: this.attack,
      defense: this.defense,
      critRate: this.critRate,
      critDamage: this.critDamage
    };

    this.visualScale = S * (this.monster.visual?.scale || 1);

    this.isDead = false;
    // Where the server last reported this monster (see applyServerState). Left
    // null until then, so it never slides toward a position nobody has claimed.
    this.targetX = null;
    this.targetY = null;

    this.createSprite(x, y);
    this.createVisuals(x, y);
  }

  createSprite(x, y) {
    this.sprite = this.scene.physics.add.sprite(x, y, "entity-dot");
    const bodyW = (this.isBoss ? 46 : 30) * S;
    const bodyH = (this.isBoss ? 32 : 22) * S;
    this.sprite.setSize(bodyW, bodyH);
    this.sprite.body.setCollideWorldBounds(true);
    this.sprite.body.setDrag(250, 250);
    this.sprite.body.setMaxVelocity(90 * POS * WORLD_SPEED_SCALE, 90 * POS * WORLD_SPEED_SCALE);
    this.sprite.setDepth(y);
    this.sprite.setVisible(false);
  }

  createVisuals(x, y) {
    const iso = toIso(x, y);
    const depth = isoDepth(x, y);
    this.wolfVisual = this.scene.add.container(iso.x, iso.y).setDepth(depth);
    this.wolfVisual.setScale(this.visualScale);
    drawMonster(this.scene, this.wolfVisual, this.monster);

    this.barWidth = (this.isBoss ? 52 : 38) * S;
    this.hpBack = this.scene.add
      .rectangle(iso.x, iso.y - LABEL_OFFSET * S, this.barWidth, 4 * S, 0x1b1714)
      .setDepth(depth + 1);
    this.hpFill = this.scene.add
      .rectangle(iso.x, iso.y - LABEL_OFFSET * S, this.barWidth - 2 * S, 2 * S, 0xc94a3f)
      .setDepth(depth + 2);

    this.nameText = this.scene.add
      .text(iso.x, iso.y - NAME_OFFSET * S, `${this.name} · Lv${this.level}`, {
        fontFamily: "Arial, Tahoma, sans-serif",
        fontSize: "10px",
        color: this.isBoss ? "#f5c542" : "#e5d6bb",
        stroke: "#1c201a",
        strokeThickness: 2
      })
      .setOrigin(0.5)
      .setDepth(depth + 3);
    this.nameText.setScale(S);
  }

  /**
   * Render one frame: follow the server's position lead and redraw the labels.
   * Monster life, damage, control effects and respawns are server-owned; the
   * server already holds a stunned monster still, so this only interpolates.
   * @param {number} time scene clock (ms), unused but part of the update contract
   * @param {number} delta ms since the previous frame
   * @param {{x:number, y:number}} player local hero, used for label culling
   */
  update(time, delta, player) {
    if (!this.sprite.active) return;

    // The server owns monster life: it sends `enemy_respawned` when a monster is
    // back, so a dead one simply stops rendering until that snapshot arrives.
    if (this.isDead) return;

    // The server steps the AI and this render follows its lead. With no snapshot
    // yet the monster holds still rather than guessing a position.
    this.followServerPosition(delta);

    const x = this.sprite.x;
    const y = this.sprite.y;
    const iso = toIso(x, y);
    const depth = isoDepth(x, y);

    this.wolfVisual.setPosition(iso.x, iso.y);
    this.wolfVisual.setDepth(depth);

    const ratio = Math.max(0, Math.min(1, this.hp / this.maxHp));
    this.hpBack.setPosition(iso.x, iso.y - LABEL_OFFSET * S);
    this.hpBack.setDepth(depth + 1);
    this.hpFill.setPosition(
      iso.x - (this.barWidth / 2) * (1 - ratio),
      iso.y - LABEL_OFFSET * S
    );
    this.hpFill.setDepth(depth + 2);
    this.hpFill.width = Math.max(0.5, (this.barWidth - 2 * S) * ratio);
    this.nameText.setPosition(iso.x, iso.y - NAME_OFFSET * S);
    this.nameText.setDepth(depth + 3);

    // Fast bounding-box pre-checks & squared distance calculations to avoid Math.hypot overhead in loop
    const dx = player.x - x;
    const dy = player.y - y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    const isNameVisible = absDx <= NAME_VISIBLE_RANGE && absDy <= NAME_VISIBLE_RANGE && (dx * dx + dy * dy) <= NAME_VISIBLE_RANGE * NAME_VISIBLE_RANGE;
    this.nameText.setVisible(isNameVisible);
  }

  /**
   * Render the position the server is leading towards.
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
   * Place the wolf (and its body) on an already-decided position and face the way
   * it moved.
   * @param {{x:number, y:number}} next
   */
  applyStep(next) {
    const previousX = this.x;
    if (next.x === previousX && next.y === this.y) return;

    this.placeAt(next.x, next.y);
    if (Math.abs(next.x - previousX) > 1) {
      const facing = next.x < previousX ? -1 : 1;
      this.wolfVisual.setScale(facing * this.visualScale, this.visualScale);
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

  /**
   * Apply an authoritative server snapshot: health always, position by the
   * server's lead (a warp is applied at once, anything smaller is smoothed).
   * @param {{x?:number,y?:number,hp?:number,isDead?:boolean}} state
   */
  applyServerState(state = {}) {
    if (!this.sprite.active) return;

    const previousHp = this.hp;
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

    // A snapshot that lowers HP is a landed hit: flash the sprite briefly so the
    // authoritative number also reads as impact.
    if (next.hp < previousHp) this.flashHit();

    if (Number.isFinite(state.x) && Number.isFinite(state.y)) {
      this.targetX = state.x;
      this.targetY = state.y;
      if (next.snap) this.placeAt(state.x, state.y);
    }
  }

  /**
   * Brief white-out on the monster after a landed hit.
   */
  flashHit() {
    this.wolfVisual.setAlpha(0.45);
    this.scene.time.delayedCall(100, () => {
      if (this.sprite.active && !this.isDead) {
        this.wolfVisual.setAlpha(1);
      }
    });
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
    this.wolfVisual.setVisible(true);
    this.wolfVisual.setAlpha(1);
    this.hpBack.setVisible(true);
    this.hpFill.setVisible(true);
    this.nameText.setVisible(true);
  }

  /** Release every Phaser object this monster owns. */
  destroy() {
    this.sprite?.destroy?.();
    this.wolfVisual?.destroy?.();
    this.hpBack?.destroy?.();
    this.hpFill?.destroy?.();
    this.nameText?.destroy?.();
    this.sprite = null;
    this.wolfVisual = null;
    this.hpBack = null;
    this.hpFill = null;
    this.nameText = null;
  }

  get x() {
    return this.sprite ? this.sprite.x : this.homeX;
  }

  get y() {
    return this.sprite ? this.sprite.y : this.homeY;
  }

  get active() {
    return !!this.sprite?.active;
  }
}

/** Backwards-compatible alias: the market wolf used to be its own class. */
export { Enemy as Wolf };

export class EnemyManager {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.enemies = [];
    this.enemyMap = new Map(); // O(1) lookup map by enemy id
    this.group = null;
  }

  /**
   * Build the roster. Accepts catalog spawns (`{id, monsterId, x, y}`) and the
   * legacy `[x, y]` pairs so old call sites keep working.
   * @param {Array<object|[number, number]>} [spawns]
   */
  create(spawns = []) {
    // The physics group is long-lived: the world keeps colliders pointing at it,
    // so it is emptied rather than replaced when a new roster is built.
    this.clear();
    if (!this.group) this.group = this.scene.physics.add.group();
    spawns.forEach((spawn, index) => this.spawnOne(spawn, index));
  }

  /**
   * @param {object|[number, number]} spawn
   * @param {number} index
   * @returns {Enemy}
   */
  spawnOne(spawn, index) {
    const isPair = Array.isArray(spawn);
    const x = isPair ? spawn[0] : spawn.x;
    const y = isPair ? spawn[1] : spawn.y;
    const id = isPair ? index : spawn.id ?? index;
    const monsterId = isPair ? spawn[2] : spawn.monsterId;

    const enemy = new Enemy(this.scene, x, y, id, monsterId);
    this.group?.add(enemy.sprite);
    this.enemies.push(enemy);
    this.enemyMap.set(id, enemy);
    return enemy;
  }

  /**
   * Drop the whole roster (used when travelling to another map). The physics
   * group stays alive on purpose: the world holds colliders against it, and
   * destroying the group would leave those colliders pointing at nothing.
   */
  clear() {
    this.enemies.forEach((enemy) => enemy.destroy());
    this.enemies = [];
    this.enemyMap.clear();
    // Each enemy already released its own sprite, so only the group entries go.
    this.group?.clear(false, false);
  }

  update(time, delta, player) {
    this.enemies.forEach((enemy) => {
      enemy.update(time, delta, player);
    });
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
    return this.enemyMap.get(id) || this.enemies.find((wolf) => wolf.id === id) || null;
  }

  /**
   * Apply one authoritative enemy update (a hit or a respawn)
   * @param {Object} state
   */
  applyEnemyState(state = {}) {
    const enemy = this.getById(state.id);
    if (enemy) enemy.applyServerState(state);
  }

  /**
   * Apply a list of authoritative snapshots: the world-init roster or relayed positions
   * @param {Array<Object>} enemies
   */
  applyServerSnapshot(enemies) {
    if (!Array.isArray(enemies)) return;
    if (!this.group) this.group = this.scene.physics.add.group();

    enemies.forEach((state) => {
      if (!this.getById(state.id)) {
        const enemy = new Enemy(
          this.scene,
          state.x,
          state.y,
          state.id,
          state.monsterId
        );
        this.group.add(enemy.sprite);
        this.enemies.push(enemy);
        this.enemyMap.set(state.id, enemy);
      }
      this.applyEnemyState(state);
    });
  }
}

/**
 * Whether a ground-space coordinate lands on a living enemy's clickable body box.
 * @param {Enemy} enemy
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isPointOnEnemy(enemy, x, y) {
  if (!enemy || enemy.isDead || enemy.active === false) return false;
  const ex = enemy.x;
  const ey = enemy.y;
  if (typeof ex !== "number" || typeof ey !== "number" || !Number.isFinite(ex) || !Number.isFinite(ey)) {
    return false;
  }

  const isBoss = Boolean(enemy.isBoss);
  const isHumanoid =
    enemy.monster?.visual?.kind === "humanoid" ||
    enemy.monster?.visual?.kind === "armored" ||
    enemy.monster?.visual?.kind === "boss";

  if (isHumanoid) {
    const halfWidth = isBoss ? 120 : 90;
    const above = isBoss ? 280 : 200;
    const below = isBoss ? 80 : 60;
    if (Math.abs(x - ex) <= halfWidth && y >= ey - above && y <= ey + below) {
      return true;
    }
  } else {
    const scale = enemy.monster?.visual?.scale || 1;
    const halfWidth = 100 * scale;
    const halfHeight = 85 * scale;
    if (Math.abs(x - ex) <= halfWidth && Math.abs(y - ey) <= halfHeight) {
      return true;
    }
  }

  const fallbackRadius = isBoss ? 140 : 90;
  const dx = x - ex;
  const dy = y - ey;
  return dx * dx + dy * dy <= fallbackRadius * fallbackRadius;
}

/**
 * Find the closest living monster under a ground-space coordinate.
 * @param {Array<Enemy>} enemies
 * @param {number} x
 * @param {number} y
 * @returns {Enemy|null}
 */
export function findEnemyAt(enemies, x, y) {
  if (!Array.isArray(enemies)) return null;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  let best = null;
  let bestDistSq = Infinity;
  for (const enemy of enemies) {
    if (!enemy || enemy.isDead || enemy.active === false) continue;
    if (isPointOnEnemy(enemy, x, y)) {
      const dx = x - enemy.x;
      const dy = y - enemy.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        best = enemy;
        bestDistSq = distSq;
      }
    }
  }
  return best;
}

