import { RemotePlayer } from "./remotePlayer.js";
import { skillById } from "./skills.js";
import { playSkillCastVfx } from "./skills/client/vfx.js";

/**
 * RemotePlayerManager
 * Manages all online remote player instances on the Phaser canvas.
 */
export class RemotePlayerManager {
  /**
   * @param {Phaser.Scene} scene
   * @param {import("./uiBridgeAdapter.js").UIBridgeAdapter} [uiBridge]
   */
  constructor(scene, uiBridge = null) {
    this.scene = scene;
    this.uiBridge = uiBridge;
    this.players = new Map(); // key: playerId, value: RemotePlayer
    this.localPlayerId = null;
    /** Camp of the local hero, used to colour enemies on faction battlefields. */
    this.localFaction = null;
    /** PvP policy of the map the group is currently on. */
    this.pvpMode = "flag";
  }

  setLocalPlayerId(id) {
    this.localPlayerId = id;
  }

  /**
   * Adopt the local hero's faction and repaint every nameplate.
   * @param {string|null} faction
   */
  setLocalFaction(faction) {
    this.localFaction = faction || null;
    this.players.forEach((player) =>
      player.refreshNameColor?.(this.pvpMode, this.localFaction)
    );
  }

  /**
   * Adopt the current map's PvP policy and repaint every nameplate.
   * @param {"none"|"flag"|"faction"} mode
   */
  setPvpMode(mode) {
    this.pvpMode = mode || "flag";
    this.players.forEach((player) =>
      player.refreshNameColor?.(this.pvpMode, this.localFaction)
    );
  }

  /**
   * Spawn a new remote player on map
   * @param {Object} playerData
   */
  addPlayer(playerData) {
    if (!playerData || !playerData.id) return;
    if (this.localPlayerId && playerData.id === this.localPlayerId) return;

    // One avatar per character: a stale socket from an earlier page load can still
    // be on the server roster under a different player id, and two identical
    // nameplates make it impossible to tell which body a hit actually landed on.
    if (playerData.characterId) {
      this.players.forEach((existing, key) => {
        if (existing.characterId && existing.characterId === playerData.characterId && key !== playerData.id) {
          existing.destroy();
          this.players.delete(key);
        }
      });
    }

    // Remove existing if duplicate
    if (this.players.has(playerData.id)) {
      this.players.get(playerData.id).destroy();
      this.players.delete(playerData.id);
    }

    const remotePlayer = new RemotePlayer(this.scene, playerData);
    remotePlayer.refreshNameColor?.(this.pvpMode, this.localFaction);
    this.players.set(playerData.id, remotePlayer);
  }

  /**
   * Initial world state received from server
   * @param {Object} payload
   */
  handleInitWorld(payload = {}) {
    if (payload.yourId) {
      this.setLocalPlayerId(payload.yourId);
    }

    if (Array.isArray(payload.players)) {
      payload.players.forEach((p) => {
        this.addPlayer(p);
      });
    }
  }

  /**
   * New player joined the world
   * @param {Object} payload
   */
  handlePlayerJoined(payload = {}) {
    const p = payload.player;
    if (!p || !p.id) return;
    if (this.localPlayerId && p.id === this.localPlayerId) return;

    this.addPlayer(p);
  }

  /**
   * Player coordinates updated
   * @param {Object} payload
   */
  handlePlayerMoved(payload = {}) {
    if (!payload.id) return;
    const player = this.players.get(payload.id);
    if (player) {
      player.setTarget(payload);
    }
  }

  /**
   * A player changed the gear they are wearing; redraw that peer's rig.
   * @param {Object} payload
   */
  handlePlayerEquipment(payload = {}) {
    if (!payload.id) return;
    const player = this.players.get(payload.id);
    if (player) {
      player.applyEquipment(payload.equipment);
    }
  }

  /**
   * Authoritative HP pushed by the server; drives the peer's overhead bar.
   * @param {Object} payload
   */
  handlePlayerHp(payload = {}) {
    if (!payload.id) return;
    const player = this.players.get(payload.id);
    if (player) {
      player.applyStats(payload);
      if (payload.damage > 0) player.flashHit?.();
    }
  }

  /**
   * A player toggled their PK flag
   * @param {Object} payload
   */
  handlePlayerPk(payload = {}) {
    if (!payload.id) return;
    const player = this.players.get(payload.id);
    if (player) {
      player.applyPkFlag(payload.pkFlag === true);
      player.refreshNameColor?.(this.pvpMode, this.localFaction);
    }
  }

  /**
   * Player performed an attack or skill.
   *
   * A peer must see the same art the caster sees, so a catalog skill is replayed
   * through the shared skill-VFX pipeline (sprite sheets, thrown projectiles,
   * cast gestures). Only a plain swing falls back to the generic melee motion.
   * @param {Object} payload
   */
  handlePlayerAttacked(payload = {}) {
    if (!payload.id) return;
    const player = this.players.get(payload.id);
    if (!player) return;

    const skill = payload.skill && payload.skill !== "normal" ? skillById(payload.skill) : null;
    if (!skill) {
      player.playAttack(payload.facingRight !== false);
      return;
    }

    // The server echoes the impact point it validated, so ranged/AoE art lands
    // where the caster aimed instead of at the peer's own feet.
    const aimPoint =
      Number.isFinite(payload.aimX) && Number.isFinite(payload.aimY)
        ? { x: payload.aimX, y: payload.aimY }
        : null;

    this.applyPeerBuffAura(player, skill);
    playSkillCastVfx(this.scene, player, skill, null, aimPoint);
  }

  /**
   * Long-lived self buffs stay on the peer for their whole duration: a ground
   * formation ring and/or an overhead seal, exactly as the caster renders them.
   * @param {RemotePlayer} player
   * @param {Object} skill
   */
  applyPeerBuffAura(player, skill) {
    const vfx = skill?.vfx || {};
    const duration = Math.max(
      0,
      ...(skill?.effects || [])
        .filter((effect) => effect?.kind === "buff")
        .map((effect) => Number(effect.duration) || 0)
    );

    if (vfx.type === "formation" && vfx.sprite) {
      player.showFormation?.(vfx.sprite, vfx.scale);
      player.formationTimer?.remove?.();
      player.formationTimer = this.scene?.time?.delayedCall?.(duration || 180000, () => {
        player.hideFormation?.();
        player.formationTimer = null;
      });
    }

    if (vfx.type === "overhead" && vfx.overhead) {
      player.showOverhead?.(vfx.overhead, vfx.overheadScale, vfx.overheadOffsetY);
      player.overheadTimer?.remove?.();
      player.overheadTimer = this.scene?.time?.delayedCall?.(duration || 30000, () => {
        player.hideOverhead?.();
        player.overheadTimer = null;
      });
    }
  }

  /**
   * Player left the world
   * @param {Object} payload
   */
  handlePlayerLeft(payload = {}) {
    if (!payload.id) return;
    const player = this.players.get(payload.id);
    if (player) {
      player.destroy();
      this.players.delete(payload.id);
    }
  }

  /**
   * Frame update for all remote players
   * @param {number} time
   * @param {number} delta
   */
  update(time, delta) {
    this.players.forEach((player) => {
      player.update(time, delta);
    });
  }

  /**
   * Get all remote player instances
   * @returns {Array<RemotePlayer>}
   */
  getAll() {
    return Array.from(this.players.values());
  }

  /**
   * Clean up all remote players
   */
  destroy() {
    this.players.forEach((player) => {
      player.destroy();
    });
    this.players.clear();
  }
}

