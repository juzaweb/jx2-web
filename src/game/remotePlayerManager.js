import { RemotePlayer } from "./remotePlayer.js";
import { skillById } from "./skills.js";

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
  }

  setLocalPlayerId(id) {
    this.localPlayerId = id;
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
    }
  }

  /**
   * Player performed an attack or skill
   * @param {Object} payload
   */
  handlePlayerAttacked(payload = {}) {
    if (!payload.id) return;
    const player = this.players.get(payload.id);
    if (player) {
      if (payload.skill === "la_han_tran") {
        player.showFormation?.("vfx-la-han-tran", 0.6);
        if (player.formationTimer) {
          player.formationTimer.remove?.();
          player.formationTimer = null;
        }
        player.formationTimer = this.scene?.time?.delayedCall?.(180000, () => {
          player.hideFormation?.();
          player.formationTimer = null;
        });
      } else if (payload.skill === "kim_cang_bat_hoai") {
        const skill = skillById("kim_cang_bat_hoai");
        const duration = skill?.effects?.find((effect) => effect.kind === "buff")?.duration ?? 30000;
        player.showOverhead?.(
          skill?.vfx?.overhead ?? "buff-phat-an",
          skill?.vfx?.overheadScale,
          skill?.vfx?.overheadOffsetY
        );
        if (player.overheadTimer) {
          player.overheadTimer.remove?.();
          player.overheadTimer = null;
        }
        player.overheadTimer = this.scene?.time?.delayedCall?.(duration, () => {
          player.hideOverhead?.();
          player.overheadTimer = null;
        });
      } else if (payload.skill === "kiem_khi") {
        player.playSkill();
      } else {
        player.playAttack(payload.facingRight !== false);
      }
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

