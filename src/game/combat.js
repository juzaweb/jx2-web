import * as Phaser from "phaser";
import { parseEnemyReward } from "./rewardSync.js";
import { skillById } from "./skills.js";
import { playSkillImpactVfx } from "./skillVfx.js";
import { toIso, isoDepth } from "./isoProjection.js";
import { canPvpAttack, mayDuel, PVP_ATTACK_RANGE, PVP_HIT_COOLDOWN_MS } from "./pvp.js";
import { findNearestPvpTarget, findPlayerAt } from "./pvpTargeting.js";
import { isCombatAllowed, mapPvpMode } from "./maps/mapRegistry.js";
import { isHostileFaction } from "./factions.js";
import { MELEE_REACH } from "./combatRules.js";
import { ATTACK_INTERVAL_MS } from "./combatConfig.js";
import { SkillCastController, isPeerTarget } from "./skills/client/castController.js";

let audioEnabled = true;
let audioContext = null;

/**
 * Why a swing, skill or duel was refused inside a city. Shared with the scene so
 * the click, the cursor and the combat system all explain the safe zone alike.
 */
export const SAFE_ZONE_LOG = "Đây là khu vực thành — nơi an cư, không thể giao chiến.";

export function isAudioEnabled() {
  return audioEnabled;
}

export function setAudioEnabled(enabled) {
  audioEnabled = enabled;
  return audioEnabled;
}

export function toggleAudio() {
  audioEnabled = !audioEnabled;
  return audioEnabled;
}

export function playTone(frequency = 220, duration = 0.07, type = "sine", volume = 0.025) {
  if (!audioEnabled) return;
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch (_) {}
}

/** Coerce a server-sent stat to a finite number, keeping the current value otherwise. */
const toStat = (value, fallback) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export class CombatSystem {
  /**
   * @param {Phaser.Scene} scene
   * @param {import("./player.js").Player} player
   * @param {import("./enemy.js").EnemyManager} enemyManager
   * @param {import("./ui.js").UIManager} uiManager
   * @param {Function} [onStateChange]
   */
  constructor(scene, player, enemyManager, uiManager, onStateChange = null) {
    this.scene = scene;
    this.player = player;
    this.enemyManager = enemyManager;
    this.ui = uiManager;
    this.onStateChange = onStateChange;

    this.attackReady = true;
    /** id -> timestamp (ms) the skill becomes castable again. */
    this.skillCooldowns = new Map();
    /** Active timed buffs: { stat, amount, until }. */
    this.buffs = [];
    /** Melee approach in flight: { skill, targetId }. */
    this.pendingCast = null;
    /** Active flurry: { skill, targetId, nextAt, endsAt, hitsLeft, intervalMs, chasing }. */
    this.channel = null;
    this.lastChaseAt = 0;
    /** Skill ids learned from books; starter skills are implicitly known. */
    this.learnedSkills = new Set();
    /** skill id -> level (1..MAX_SKILL_LEVEL), mirrored from `skills_sync`. */
    this.skillLevels = {};
    /** Player id this client joined with, used to match server kill attribution. */
    this.localPlayerId = null;

    /** Skill casting rules and lifecycle (see `skills/client/castController.js`). */
    this.cast = new SkillCastController(this, { playTone });
  }

  /**
   * Skill casting controller.
   *
   * Created in the constructor, but tests also build the class with
   * `Object.create(CombatSystem.prototype)` and hand-assign fields, so the getter
   * creates it on first use as well.
   * @returns {SkillCastController}
   */
  get cast() {
    if (!this._cast) this._cast = new SkillCastController(this, { playTone });
    return this._cast;
  }

  set cast(value) {
    this._cast = value;
  }

  /**
   * The player's stats, exactly as the server publishes them. Buffs are applied
   * server-side; the local buff list only drives VFX.
   * @returns {Object}
   */
  getEffectiveStats() {
    return this.player?.stats || {};
  }

  /**
   * Whether fighting is allowed where the hero stands. A city is a safe zone: a
   * swing, a skill aimed at a body, and a duel are all refused there, even with
   * the PK flag raised. The server enforces the same rule, so this only spares
   * the player a shot the server would drop.
   * @returns {boolean}
   */
  canFight() {
    return isCombatAllowed(this.scene?.map || this.scene?.currentMapId);
  }

  /**
   * PvP policy of the map the hero stands on. A faction battlefield opts every
   * player in; a normal map keeps the PK flag.
   * @returns {"none"|"flag"|"faction"}
   */
  pvpMode() {
    return mapPvpMode(this.scene?.map || this.scene?.currentMapId);
  }

  /**
   * Whether a peer is a legal target under the current map's PvP policy.
   * @param {Object|null} peer
   * @returns {boolean}
   */
  isDuelTarget(peer) {
    if (!peer) return false;
    const mode = this.pvpMode();
    if (mode === "none") return false;
    if (mode === "faction") return isHostileFaction(this.player?.faction, peer.faction);
    return peer.pkFlag === true;
  }

  /**
   * Milliseconds until the next normal attack, shortened by the attack-speed
   * multiplier (see combatConfig.js).
   * @returns {number}
   */
  attackIntervalMs() {
    const speed = Number(this.player?.stats?.attackSpeed);
    return ATTACK_INTERVAL_MS / (Number.isFinite(speed) && speed > 0 ? speed : 1);
  }

  /**
   * Start the attack cooldown and play the swing every strike shares: motion,
   * sound, the broadcast to peers and the slash arc. PvP passes the facing so the
   * hero turns toward its target instead of keeping the sprite's orientation.
   * @param {boolean} [facingRight]
   * @param {number} [intervalMs]
   */
  beginAttack(facingRight = this.player.visual.scaleX >= 0, intervalMs = this.attackIntervalMs()) {
    this.attackReady = false;
    this.scene.time.delayedCall(intervalMs, () => {
      this.attackReady = true;
    });

    // Trigger physical sword thrust / lunge animation on character body
    const bakedSwing = this.player.playAttackMotion?.() === true;

    playTone(260, 0.07, "sawtooth", 0.02);

    // Broadcast attack to other players via network
    this.scene.networkClient?.sendAttack?.({
      skill: "normal",
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      facingRight
    });

    // A weapon with its own swing sheet already draws the arc, so only fall back
    // to the vector one for the looks that have no art.
    if (bakedSwing) return;

    const slashOffsetX = facingRight ? 16 : -16;
    const base = toIso(this.player.x, this.player.y);

    const slash = this.scene.add
      .arc(
        base.x + slashOffsetX,
        base.y - 7,
        34,
        facingRight ? -70 : 110,
        facingRight ? 70 : 250,
        false,
        0xe9d59c,
        0.9
      )
      .setStrokeStyle(5, 0xf2e3bd, 0.95)
      .setDepth(isoDepth(this.player.x, this.player.y) + 10);

    this.scene.tweens.add({
      targets: slash,
      alpha: 0,
      scale: 1.4,
      duration: 190,
      onComplete: () => slash.destroy()
    });
  }

  /**
   * The closest living monster inside sword reach.
   * Prefers the scene's targeted enemy if already in range.
   * @returns {Object|null}
   */
  nearestEnemyInReach() {
    const locked = this.scene?.enemyTarget;
    if (locked && !locked.isDead && locked.active !== false) {
      const dx = locked.x - this.player.x;
      const dy = locked.y - this.player.y;
      if (dx * dx + dy * dy <= MELEE_REACH * MELEE_REACH) {
        return locked;
      }
    }

    const px = this.player.x;
    const py = this.player.y;
    const reachSq = MELEE_REACH * MELEE_REACH;
    let closest = null;
    let minSq = reachSq;

    for (const wolf of this.enemyManager.getAlive()) {
      const dx = wolf.x - px;
      const dy = wolf.y - py;
      const distSq = dx * dx + dy * dy;
      if (distSq < minSq) {
        minSq = distSq;
        closest = wolf;
      }
    }

    return closest;
  }

  /**
   * The closest PK-flagged player inside PvP range. Peers live in the scene's
   * `RemotePlayerManager`, which may be absent (offline or before the handshake).
   * @returns {Object|null}
   */
  nearestPvpTarget() {
    const players = this.scene.remotePlayerManager?.getAll?.() || [];
    return findNearestPvpTarget(this.player, players, PVP_ATTACK_RANGE, this.pvpMode());
  }

  /**
   * PvP strikes must not out-pace the server's i-frame: an early hit is dropped
   * silently, so the client would draw damage that never happened.
   * @returns {number}
   */
  pvpAttackIntervalMs() {
    return Math.max(this.attackIntervalMs(), PVP_HIT_COOLDOWN_MS);
  }

  /**
   * A plain attack: a monster in sword reach wins, otherwise a nearby duel target
   * is struck, otherwise the swing merely plays through empty air.
   */
  performAttack() {
    if (!this.attackReady) return;
    if (this.channel) return;
    if (!this.canFight()) {
      this.ui.addLog(SAFE_ZONE_LOG, "system");
      return;
    }

    const targetEnemy = this.nearestEnemyInReach();
    if (targetEnemy) {
      this.beginAttack();
      this.damageEnemy(targetEnemy);

      this.ui.addLog(`Kiếm chiêu chém tới ${targetEnemy.name || "mục tiêu"}!`);
      return;
    }

    // Nothing to cut in melee: a legal duel target in range is the next best
    // choice (a different camp on the battlefield, a flagged peer elsewhere).
    const pvpTarget = mayDuel(this.player, this.pvpMode()) ? this.nearestPvpTarget() : null;
    if (pvpTarget) {
      this.performPvpAttack(pvpTarget);
      return;
    }

    this.beginAttack();
  }

  /**
   * Cast a skill bound to a numbered hotbar slot, by catalog id.
   * @param {string} skillId
   * @param {{x:number,y:number}|null} [aim]
   * @returns {boolean}
   */
  castSkillById(skillId, aim = null) {
    return this.cast.castSkillById(skillId, aim);
  }

  /**
   * Direct casting execution logic.
   * @param {Object} skill
   * @param {{x:number,y:number}|null} [aim]
   * @returns {boolean}
   */
  castSkill(skill, aim = null) {
    return this.cast.castSkill(skill, aim);
  }

  /**
   * Walk the hero into the skill's reach, then release it.
   * @param {Object} skill
   * @param {Object} target
   */
  approachAndCast(skill, target) {
    return this.cast.approachAndCast(skill, target);
  }

  /**
   * Explain why a skill cannot be used yet.
   * @param {Object} skill
   * @returns {string}
   */
  skillLockMessage(skill) {
    return this.cast.skillLockMessage(skill);
  }

  /**
   * Check if a skill is unlocked, off cooldown, and the player has enough MP,
   * without logging failure messages.
   * @param {Object} skill
   * @returns {boolean}
   */
  isSkillReady(skill) {
    return this.cast.isSkillReady(skill);
  }

  /**
   * Validate level, cooldown and MP without spending anything.
   * @param {Object} skill
   * @returns {boolean}
   */
  canCast(skill) {
    return this.cast.canCast(skill);
  }

  /**
   * Spend the cost and release the skill.
   * @param {Object} skill
   * @param {Object|null} target
   * @param {{x:number,y:number}|null} [aimPoint] cursor point when nothing was targeted
   */
  executeSkill(skill, target, aimPoint = null) {
    return this.cast.executeSkill(skill, target, aimPoint);
  }

  /**
   * Distance at which a skill can release, capped by the camera view.
   * @param {Object} skill
   * @returns {number}
   */
  skillReach(skill) {
    return this.cast.skillReach(skill);
  }

  /**
   * Distance a cast at `target` may release from.
   * @param {Object} skill
   * @param {Object} target
   * @returns {number}
   */
  castReach(skill, target) {
    return this.cast.castReach(skill, target);
  }

  /**
   * Push the hero's current position to the server. A PvP hit is validated against
   * the server's copy of both positions, so a strike that lands right after a
   * chase would otherwise be measured from where we stood a frame ago and be
   * refused as out of range.
   */
  syncPosition() {
    const client = this.scene.networkClient;
    if (!client?.isConnected) return;

    const body = this.player.sprite?.body;
    client.sendMove?.({
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      vx: Math.round(body?.velocity?.x || 0),
      vy: Math.round(body?.velocity?.y || 0),
      direction: this.player.facing
    });
  }

  /**
   * Farthest world distance visible from the player, so a long-range skill
   * cannot auto-target enemies that are off-screen. Uses the camera's actual
   * world-view corners when available, which stays correct when the player is
   * not centred (e.g. at the map edge).
   * @returns {number}
   */
  screenCastRange() {
    const camera = this.scene?.cameras?.main;
    const zoom = camera?.zoom;
    if (!camera || !zoom) return Infinity;

    const view = camera.worldView;
    if (view && view.width > 0 && Number.isFinite(view.right) && Number.isFinite(view.bottom)) {
      const { x, y } = this.player;
      const corners = [
        [view.left, view.top],
        [view.right, view.top],
        [view.left, view.bottom],
        [view.right, view.bottom]
      ];
      return Math.max(...corners.map(([cx, cy]) => Math.hypot(cx - x, cy - y)));
    }

    return Math.hypot(camera.width / (2 * zoom), camera.height / (2 * zoom));
  }

  /**
   * Pick the target of a cast. Whatever sits under the aim wins — monster or
   * duellist alike — so the ring the player sees is the body the skill lands on.
   * When both bodies cover the aim, the duellist takes it: a duel is the choice
   * the player already made by raising the PK flag.
   *
   * With nothing under the aim, a locked/auto-acquired duellist still takes the
   * cast (legacy PvP behaviour); an aim on empty ground carries no target and the
   * projectile simply flies there.
   * @param {{x:number,y:number}|null} aim
   * @returns {Object|null}
   */
  findTarget(aim) {
    const peer = aim ? this.aimedPlayerTarget(aim) : null;
    const monster = aim ? this.aimedEnemyTarget(aim) : null;

    // Duellist first: checked before the monster so it also wins when both bodies
    // cover the aim.
    if (peer) return peer;
    if (monster) return monster;

    const duellist = this.findPlayerTarget(aim);
    if (duellist) return duellist;

    return aim ? null : this.nearestEnemyTarget();
  }

  /**
   * The living monster whose body sits under `aim`. Only a point that actually
   * lands on a monster counts, instead of chasing whichever one happens to be
   * closest to an empty click.
   * @param {{x:number,y:number}} aim
   * @returns {Object|null}
   */
  aimedEnemyTarget(aim) {
    const px = aim.x;
    const py = aim.y;
    const maxSq = 150 * 150;
    let closest = null;
    let minSq = maxSq;

    for (const wolf of this.enemyManager.getAlive()) {
      const dx = wolf.x - px;
      const dy = wolf.y - py;
      const distSq = dx * dx + dy * dy;
      if (distSq <= minSq) {
        minSq = distSq;
        closest = wolf;
      }
    }
    return closest;
  }

  /**
   * The living monster nearest to the hero, for a cast that was given no aim.
   * @returns {Object|null}
   */
  nearestEnemyTarget() {
    const px = this.player.x;
    const py = this.player.y;
    const maxSq = 600 * 600;
    let closest = null;
    let minSq = maxSq;

    for (const wolf of this.enemyManager.getAlive()) {
      const dx = wolf.x - px;
      const dy = wolf.y - py;
      const distSq = dx * dx + dy * dy;
      if (distSq <= minSq) {
        minSq = distSq;
        closest = wolf;
      }
    }
    return closest;
  }

  /**
   * The duellist a skill should aim at: the peer under the click, else the locked
   * PvP target (`scene.pvpTarget`, set by clicking a legal peer), else the closest
   * legal opponent inside the PvP range. A hero with no way to fight (peaceful on
   * a flag map) never acquires one.
   * @param {{x:number,y:number}|null} aim
   * @returns {Object|null}
   */
  findPlayerTarget(aim) {
    if (!mayDuel(this.player, this.pvpMode())) return null;

    const underAim = this.aimedPlayerTarget(aim);
    if (underAim) return underAim;

    const locked = this.scene.pvpTarget;
    if (isPeerTarget(locked) && this.isDuelTarget(locked) && locked.container?.active !== false) {
      return locked;
    }

    // Nothing picked: an opponent already inside striking range is still the most
    // relevant target. Without this a skill cast next to a duellist flies past
    // them and does nothing, which reads as "skill hits but no HP loss".
    const peers = this.scene.remotePlayerManager?.getAll?.() || [];
    return findNearestPvpTarget(this.player, peers, PVP_ATTACK_RANGE, this.pvpMode());
  }

  /**
   * The legal duellist whose drawn body covers `aim`, if any.
   * @param {{x:number,y:number}|null} aim
   * @returns {Object|null}
   */
  aimedPlayerTarget(aim) {
    if (!aim || !mayDuel(this.player, this.pvpMode())) return null;

    const peers = this.scene.remotePlayerManager?.getAll?.() || [];
    const clicked = findPlayerAt(peers, aim.x, aim.y);
    return this.isDuelTarget(clicked) ? clicked : null;
  }

  /**
   * Drive a pending approach. Called from the scene's update loop.
   * @param {number} time
   */
  update(time) {
    const now = typeof time === "number" ? time : (this.scene?.time?.now ?? 0);
    this.updateBuffs(now);
    this.updateChannel(now);

    const pending = this.pendingCast;
    if (!pending) return;

    const target = this.findPendingTarget(pending.targetId);
    if (!target) {
      this.cancelPendingCast();
      this.ui.addLog("Mục tiêu đã biến mất.");
      return;
    }

    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);
    if (distance <= this.castReach(pending.skill, target)) {
      this.pendingCast = null;
      this.player.stopMovement?.();
      this.executeSkill(pending.skill, target);
      return;
    }

    // Re-issue the move every 400ms so a moving target is still chased.
    if (!this.lastChaseAt || time - this.lastChaseAt > 400) {
      this.lastChaseAt = time;
      this.player.moveTo(target.x, target.y);
    }
  }

  /**
   * Resolve the id stored on a pending approach: a monster or a peer, whichever
   * still holds it. A peer that left or stopped being a legal target ends the chase.
   * @param {string} targetId
   * @returns {Object|null}
   */
  findPendingTarget(targetId) {
    const wolf = this.enemyManager.getAlive().find((entry) => entry.id === targetId);
    if (wolf) return wolf;

    const peer = (this.scene.remotePlayerManager?.getAll?.() || []).find((entry) => entry.id === targetId);
    if (!isPeerTarget(peer) || !this.isDuelTarget(peer)) return null;
    return peer.container?.active === false ? null : peer;
  }

  /**
   * Cancel a pending approach (left-click movement, joystick, skill change).
   */
  cancelPendingCast() {
    this.endChannel();
    if (!this.pendingCast) return;
    this.pendingCast = null;
    this.player.stopMovement?.();
  }

  /**
   * Resolve a cast against the world: self buffs/heals, or damage and control on
   * the nearest enemy / an area around the hero.
   * @param {Object} skill
   * @param {number} now
   * @param {Object|null} [preferredTarget]
   * @param {{x:number,y:number}|null} [aimPoint] cursor point when nothing was targeted
   */
  applySkill(skill, now, preferredTarget = null, aimPoint = null) {
    return this.cast.applySkill(skill, now, preferredTarget, aimPoint);
  }

  /**
   * Begin a channelled flurry.
   * @param {Object} skill
   * @param {Object} target
   * @param {number} now
   */
  startChannel(skill, target, now) {
    return this.cast.startChannel(skill, target, now);
  }

  /**
   * Drive the active flurry.
   * @param {number} now
   */
  updateChannel(now) {
    return this.cast.updateChannel(now);
  }

  /**
   * Land one strike of a channel on its resolved target.
   * @param {Object} target monster or peer
   * @param {Object} skill
   * @returns {boolean} false when the strike can no longer be delivered
   */
  strikeChannelTarget(target, skill) {
    return this.cast.strikeChannelTarget(target, skill);
  }

  /**
   * Stop the active flurry and release movement.
   * @param {string} [message] log line shown when the channel ended early
   */
  endChannel(message) {
    return this.cast.endChannel(message);
  }

  /**
   * Resolve a skill cast against another player. The peer's HP is server-owned, so
   * this only reports the roll; the returned `player_hp` (or a dodge refusal) drives
   * the floating damage number.
   * @param {Object} skill
   * @param {Object} target
   * @param {{log?: boolean, sync?: boolean}} [options] suppress the per-target log
   *   and the position sync for a multi-target cast
   * @returns {boolean} whether the hit was reported to the server
   */
  applySkillToPlayer(skill, target, options) {
    return this.cast.applySkillToPlayer(skill, target, options);
  }

  /**
   * Explain a skill that found nothing when the reason is our own PK flag.
   * @param {Object} skill
   */
  hintPeacefulDuelist(skill) {
    return this.cast.hintPeacefulDuelist(skill);
  }

  /**
   * Centre of an AoE cast.
   * @param {Object} skill
   * @param {Object|null} preferredTarget
   * @param {{x:number,y:number}|null} aimPoint
   * @returns {{x:number,y:number}}
   */
  resolveCastCenter(skill, preferredTarget = null, aimPoint = null) {
    return this.cast.resolveCastCenter(skill, preferredTarget, aimPoint);
  }

  /**
   * Enemies this cast can hit.
   * @param {Object} skill
   * @param {{x:number,y:number}|null} [center] AoE centre
   * @returns {Object[]}
   */
  resolveTargets(skill, center = null) {
    return this.cast.resolveTargets(skill, center);
  }

  /**
   * Flagged players inside a cast's area.
   * @param {Object} skill
   * @param {{x:number,y:number}|null} [center] AoE centre
   * @returns {Object[]}
   */
  resolvePeerTargets(skill, center = null) {
    return this.cast.resolvePeerTargets(skill, center);
  }

  /**
   * Turn the hero toward the primary target.
   * @param {Object|null} target
   */
  aimAt(target) {
    return this.cast.aimAt(target);
  }

  /**
   * Apply a skill's timed effects to the caster (buff, heal).
   * @param {Object} skill
   * @param {number} now
   */
  applySelfEffects(skill, now) {
    return this.cast.applySelfEffects(skill, now);
  }

  /**
   * Filter expired buffs and update active formation aura / overhead seal.
   * @param {number} now
   */
  updateBuffs(now) {
    return this.cast.updateBuffs(now);
  }

  /** Clear all active buffs and hide any buff formation rings or overhead seals. */
  clearBuffs() {
    return this.cast.clearBuffs();
  }

  /**
   * Strike another player. The map decides whether that is allowed: a faction
   * battlefield lets different camps fight without the flag, every other map
   * still needs both fighters flagged. The client only reports the intent; the
   * server recomputes the damage from its own stats and applies it to the
   * target's authoritative HP.
   * @param {import("./remotePlayer.js").RemotePlayer} target
   */
  performPvpAttack(target) {
    if (!this.attackReady) return;
    if (this.channel) return;
    if (!this.canFight()) {
      this.ui.addLog(SAFE_ZONE_LOG, "system");
      return;
    }
    if (!this.scene.networkClient?.isConnected) {
      this.ui.addLog("Cần kết nối máy chủ để tỷ thí cùng cao thủ.");
      return;
    }

    const mode = this.pvpMode();
    if (mode === "faction") {
      // Same camp never fights, whatever the PK flags say.
      if (!isHostileFaction(this.player.faction, target?.faction)) {
        this.ui.addLog("Đồng minh cùng phe — không thể giao chiến.", "system");
        return;
      }
    } else {
      // Report the reasons a strike can be refused separately: one catch-all
      // message made an out-of-range click look like a flag problem.
      if (this.player.pkFlag !== true) {
        this.ui.addLog("Hãy bật cờ PK trước khi tấn công người chơi khác.");
        return;
      }
      if (!target || target.pkFlag !== true) {
        this.ui.addLog(`${target?.displayName || "Đối thủ"} chưa bật cờ PK.`);
        return;
      }
    }

    const attacker = {
      id: this.localPlayerId,
      pkFlag: this.player.pkFlag === true,
      faction: this.player.faction
    };
    const defender = {
      id: target.id,
      pkFlag: target.pkFlag === true,
      faction: target.faction
    };
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);

    if (!canPvpAttack(attacker, defender, distance, PVP_ATTACK_RANGE, mode)) {
      this.ui.addLog(`${target.displayName || "Đối thủ"} ở ngoài tầm chém — hãy tiến lại gần.`);
      return;
    }

    const facingRight = target.x >= this.player.x;
    this.aimAt(target);
    this.beginAttack(facingRight, this.pvpAttackIntervalMs());

    this.syncPosition();
    this.scene.networkClient?.sendPlayerHit?.({ targetId: target.id });

    // No optimistic damage: the server confirms the hit via player_hp (or refuses
    // it) and that is what draws the floating number.
    this.ui.addLog(`Kiếm chiêu chém tới ${target.displayName || "đối thủ"}!`);
  }

  /**
   * Ask the server to resolve one hit against a monster. The client only names the
   * target (and the skill when the hit came from a cast); damage, death, rewards
   * and the floating number all come back in the server's `enemy_hit` broadcast.
   * @param {Object} wolf
   * @param {{skill?:string}} [meta]
   */
  damageEnemy(wolf, meta = {}) {
    if (!wolf || wolf.isDead) return;
    if (!this.canFight()) return;

    const skill = meta.skill ? skillById(meta.skill) : null;
    if (skill) playSkillImpactVfx(this.scene, wolf.x, wolf.y, skill);
    playTone(skill ? 180 : 120, 0.06, "square", skill ? 0.02 : 0.012);

    this.scene.networkClient?.sendEnemyHit?.({
      id: wolf.id,
      ...(skill ? { skill: skill.id } : {})
    });
  }

  /**
   * Render the authoritative reward the server rolled for a defeated enemy. The
   * payout itself is not applied here — the server credits the killer's ledger and
   * sends a `player_progress` update, which applyServerProgress() mirrors.
   * @param {Object} payload - `enemy_reward` payload
   */
  applyServerReward(payload) {
    const reward = parseEnemyReward(payload);
    if (!reward) return;

    const x = reward.x ?? this.player.x;
    const y = reward.y ?? this.player.y;
    const killedByMe = this.isLocalKiller(reward.attackerId);

    if (!killedByMe) return;

    this.ui.addLog(`Đánh bại ${reward.name || "quái vật"}! +${reward.exp} EXP`);
    this.showFloatText(x, y - 25, `+${reward.exp} EXP`, "#f3d17f");
  }

  /**
   * Mirror the server-owned progression ledger onto the local stats. The client
   * never adds coins/EXP/level itself — it only renders what the server sends and
   * reacts to a level-up for feedback.
   * @param {{level:number, exp:number, nextExp?:number, coins:number, kills:number, maxHp?:number, maxMp?:number, levelUps?:number}} progress
   */
  applyServerProgress(progress) {
    if (!progress) return;
    const stats = this.player.stats;
    const prevLevel = stats.level;

    stats.level = toStat(progress.level, stats.level);
    stats.exp = toStat(progress.exp, stats.exp);
    stats.coins = toStat(progress.coins, stats.coins);
    stats.kills = toStat(progress.kills, stats.kills);
    if (progress.nextExp !== undefined) stats.nextExp = toStat(progress.nextExp, stats.nextExp);
    if (progress.maxHp !== undefined) stats.maxHp = toStat(progress.maxHp, stats.maxHp);
    if (progress.maxMp !== undefined) stats.maxMp = toStat(progress.maxMp, stats.maxMp);

    stats.hp = Math.min(stats.hp, stats.maxHp);
    stats.mp = Math.min(stats.mp, stats.maxMp);

    // The server remembers whether the one-off quest reward was already paid, so
    // the client can never offer it a second time.
    if (progress.questRewarded !== undefined) {
      this.ui.setQuestRewarded?.(Boolean(progress.questRewarded));
    }

    if (stats.level > prevLevel) {
      // The server also heals/refills and streams the new HP/MP; mirror it for a
      // snappy HUD before those packets land.
      stats.hp = stats.maxHp;
      stats.mp = stats.maxMp;
      this.ui.addLog(`Chúc mừng! Bạn đã lên cấp ${stats.level}. HP/MP được hồi đầy.`);
      playTone(660, 0.2, "triangle", 0.04);
      this.showFloatText(this.player.x, this.player.y - 70, "LÊN CẤP!", "#ffe7a0");
    }

    this.ui.updateHud(stats);
    if (typeof this.onStateChange === "function") {
      this.onStateChange();
    }

    // Quest completion is detected client-side from the kill count, but the
    // payout is claimed from the server.
    this.scene.time.delayedCall(650, () => {
      this.ui.updateQuest(stats, () => this.handleQuestReward());
    });
  }

  /**
   * @param {string|null} playerId
   */
  setLocalPlayerId(playerId) {
    this.localPlayerId = playerId;
  }

  /**
   * @param {string|null} attackerId
   * @returns {boolean} whether the server attributed the kill to this client
   */
  isLocalKiller(attackerId) {
    return Boolean(this.localPlayerId) && attackerId === this.localPlayerId;
  }

  /**
   * The quest payout is server-owned: ask the server to grant it (idempotent via
   * the persisted `quest_rewarded` flag). The resulting `player_progress` arrives
   * through applyServerProgress().
   */
  handleQuestReward() {
    this.scene.networkClient?.sendQuestClaim?.();
    this.ui.addLog("Nhiệm vụ hoàn thành! Phần thưởng sẽ do máy chủ trao.");
  }

  showFloatText(x, y, text, color) {
    const base = toIso(x, y);
    const label = this.scene.add
      .text(base.x, base.y, text, {
        fontFamily: "Arial",
        fontSize: "14px",
        fontStyle: "bold",
        color,
        stroke: "#172019",
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(1500);

    this.scene.tweens.add({
      targets: label,
      y: base.y - 35,
      alpha: 0,
      duration: 800,
      onComplete: () => label.destroy()
    });
  }
}
