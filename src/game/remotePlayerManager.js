import { RemotePlayer } from "./remotePlayer.js";

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

    if (this.uiBridge && typeof this.uiBridge.addLog === "function") {
      this.uiBridge.addLog(`Hiệp khách ${p.displayName || p.username} đã đặt chân đến Biện Kinh.`, "system");
    }
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
   * Authoritative HP pushed by the server; drives the peer's overhead bar.
   * @param {Object} payload
   */
  handlePlayerHp(payload = {}) {
    if (!payload.id) return;
    const player = this.players.get(payload.id);
    if (player) {
      player.applyStats(payload);
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
      if (payload.skill === "kiem_khi") {
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
      if (this.uiBridge && typeof this.uiBridge.addLog === "function") {
        this.uiBridge.addLog(`Hiệp khách ${player.displayName} đã rời khỏi Biện Kinh.`, "system");
      }
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

