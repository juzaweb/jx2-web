/**
 * Everything that belongs to the map currently loaded: the renderer, the camera
 * and physics bounds, the friendly NPCs, and the static colliders between the
 * world and the hero/monsters.
 *
 * The scene owns *when* a map changes (portal, server message, save file); this
 * class owns *how* a map is put up and taken down, so the scene does not have to
 * remember the same teardown order in three different places.
 */

import { WorldManager } from "./worldManager.js";
import { createPharmacyNpc } from "./npc.js";

export class MapStage {
  /** @param {import("phaser").Scene} scene */
  constructor(scene) {
    this.scene = scene;
    /** @type {WorldManager|null} */
    this.worldManager = null;
    /** @type {Array<object>} */
    this.npcs = [];
    /** @type {Array<import("phaser").Physics.Arcade.Collider>} */
    this.colliders = [];
  }

  /**
   * Put a map up: clamp the world to it, draw it, spawn its NPCs and wire the
   * static collisions that already can be wired (the hero, and the enemy group
   * when the scene has one).
   * @param {import("./maps/mapRegistry.js").MapDefinition} map
   * @returns {MapStage}
   */
  build(map) {
    this.applyBounds(map);
    this.worldManager = new WorldManager(this.scene);
    this.worldManager.create(map);
    this.spawnNpcs(map);
    this.bindColliders();
    return this;
  }

  /**
   * Clamp the camera and the physics world to the map's walkable rectangle, so
   * the hero can never walk out onto the empty backdrop.
   * @param {import("./maps/mapRegistry.js").MapDefinition} map
   */
  applyBounds(map) {
    const b = map.bounds;
    const width = b.x1 - b.x0;
    const height = b.y1 - b.y0;
    this.scene.cameras.main.setBounds(b.x0, b.y0, width, height);
    this.scene.physics.world.setBounds(b.x0, b.y0, width, height);
  }

  /**
   * Friendly NPCs stand on the same static group as the buildings, so the hero
   * cannot walk through them.
   * @param {import("./maps/mapRegistry.js").MapDefinition} map
   */
  spawnNpcs(map) {
    this.destroyNpcs();
    const defs = map?.npcs || [];
    this.npcs = defs.map((def) => createPharmacyNpc(this.scene, def));
    for (const def of defs) {
      this.worldManager?.addBody(def.x, def.y, 46, 34);
    }
  }

  destroyNpcs() {
    this.npcs.forEach((npc) => {
      npc.sprite?.destroy();
      npc.nameText?.destroy();
      npc.promptText?.destroy();
    });
    this.npcs = [];
  }

  /** Drop the previous colliders before the world they point at is destroyed. */
  clearColliders() {
    this.colliders.forEach((collider) => collider?.destroy?.());
    this.colliders = [];
  }

  /**
   * Wire (or re-wire) the hero and monster collisions against the current
   * map's obstacles. The enemy group only exists after the roster is built, so
   * map travel calls this again once the monsters are in place.
   */
  bindColliders() {
    this.clearColliders();
    const obstacles = this.worldManager?.getObstacles();
    if (!obstacles) return;

    const { player, enemyManager } = this.scene;
    if (player?.sprite) {
      this.colliders.push(this.scene.physics.add.collider(player.sprite, obstacles));
    }
    if (enemyManager?.group) {
      this.colliders.push(this.scene.physics.add.collider(enemyManager.group, obstacles));
    }
  }

  /** Take the whole map down: colliders first, then NPCs and the renderer. */
  destroy() {
    this.clearColliders();
    this.destroyNpcs();
    this.worldManager?.destroy();
    this.worldManager = null;
  }
}
