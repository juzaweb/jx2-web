import * as Phaser from "phaser";
import { parseEnemyReward } from "./rewardSync.js";
import { skillById, skillsForSect, skillMpCost, skillLockReason, skillUnlocked } from "./skills.js";
import {
  playSkillCastVfx,
  playSkillImpactVfx,
  playRangeIndicator,
  playTargetMarker
} from "./skillVfx.js";
import { clampToRange } from "./aim.js";
import { directionFromVelocity } from "./heroDirections.js";
import { toIso, isoDepth } from "./isoProjection.js";
import { canPvpAttack, PVP_ATTACK_RANGE, PVP_CAST_DISTANCE, PVP_HIT_COOLDOWN_MS } from "./pvp.js";
import { findNearestPvpTarget, findPlayerAt } from "./pvpTargeting.js";
import { MELEE_REACH } from "./combatRules.js";
import { ATTACK_INTERVAL_MS } from "./combatConfig.js";
import { bridge, EVENTS } from "./bridge.js";
import { translate } from "../i18n/translator.js";

let audioEnabled = true;
let audioContext = null;

/**
 * A monster takes local damage through `takeHit`; a peer (RemotePlayer) does not,
 * because the server owns every player's HP. That difference is the only thing
 * that tells the two target kinds apart in a cast.
 * @param {*} target
 * @returns {boolean}
 */
const isPeerTarget = (target) => Boolean(target) && typeof target.takeHit !== "function";

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
    this.lastChaseAt = 0;
    /** Player id this client joined with, used to match server kill attribution. */
    this.localPlayerId = null;
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
    this.player.playAttackMotion?.();

    playTone(260, 0.07, "sawtooth", 0.02);

    const slashOffsetX = facingRight ? 16 : -16;
    const base = toIso(this.player.x, this.player.y);

    // Broadcast attack to other players via network
    this.scene.networkClient?.sendAttack?.({
      skill: "normal",
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      facingRight
    });

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
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, locked.x, locked.y);
      if (dist <= MELEE_REACH) {
        return locked;
      }
    }

    const candidates = this.enemyManager
      .getAlive()
      .filter((wolf) => Phaser.Math.Distance.Between(this.player.x, this.player.y, wolf.x, wolf.y) < MELEE_REACH);

    if (!candidates.length) return null;

    candidates.sort(
      (a, b) =>
        Phaser.Math.Distance.Between(this.player.x, this.player.y, a.x, a.y) -
        Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y)
    );

    return candidates[0];
  }

  /**
   * The closest PK-flagged player inside PvP range. Peers live in the scene's
   * `RemotePlayerManager`, which may be absent (offline or before the handshake).
   * @returns {Object|null}
   */
  nearestPvpTarget() {
    const players = this.scene.remotePlayerManager?.getAll?.() || [];
    return findNearestPvpTarget(this.player, players);
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

    const targetEnemy = this.nearestEnemyInReach();
    if (targetEnemy) {
      this.beginAttack();
      this.damageEnemy(targetEnemy);

      this.ui.addLog(`Kiếm chiêu chém tới ${targetEnemy.name || "mục tiêu"}!`);
      return;
    }

    // Nothing to cut in melee: a PK-flagged peer in range is the next best target.
    const pvpTarget = this.player.pkFlag === true ? this.nearestPvpTarget() : null;
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
    const skill = skillsForSect(this.player.sect).find((entry) => entry.id === skillId);
    if (!skill) {
      this.ui.addLog("Môn phái này chưa có chiêu thức ở ô đó.");
      return false;
    }
    return this.castSkill(skill, aim);
  }

  /**
   * Direct casting execution logic.
   * @param {Object} skill
   * @param {{x:number,y:number}|null} [aim]
   * @returns {boolean}
   */
  castSkill(skill, aim = null) {
    if (!skill) return false;
    // A tâm pháp is always running: it is never cast and never costs MP.
    if (skill.passive) {
      this.ui.addLog(`${translate(skill.nameKey, undefined, skill.id)} tự động vận hành.`);
      return false;
    }
    if (!this.canCast(skill)) return false;

    if (skill.target === "self") {
      this.executeSkill(skill, null);
      return true;
    }

    // A cursor sitting on the hero carries no direction; treat it as "no aim".
    const aimPoint = aim && Math.hypot(aim.x - this.player.x, aim.y - this.player.y) > 1 ? aim : null;

    const target = this.findTarget(aimPoint);
    if (!target) {
      // Nothing to hit: the projectile still flies toward where the player aimed.
      this.executeSkill(skill, null, aimPoint);
      return true;
    }

    this.approachAndCast(skill, target);
    return true;
  }

  /**
   * Walk the hero into the skill's reach, then release it.
   * @param {Object} skill
   * @param {Object} target
   */
  approachAndCast(skill, target) {
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);
    if (distance <= this.castReach(skill, target)) {
      this.executeSkill(skill, target);
      return;
    }

    this.pendingCast = { skill, targetId: target.id };
    this.lastChaseAt = 0;
    this.player.moveTo(target.x, target.y);
    this.ui.addLog(
      `Đang tiếp cận mục tiêu để dùng ${translate(skill.nameKey, undefined, skill.id)}...`
    );
  }

  /**
   * Explain why a skill cannot be used yet.
   * @param {Object} skill
   * @returns {string}
   */
  skillLockMessage(skill) {
    const reason = skillLockReason(skill, this.player.stats.level);
    if (reason?.kind === "prereq") {
      return `Cần học ${translate(reason.nameKey, undefined, reason.id)} trước.`;
    }
    return `Chiêu này cần đạt cấp ${reason?.level ?? skill.unlockLevel}.`;
  }

  /**
   * Check if a skill is unlocked, off cooldown, and the player has enough MP,
   * without logging failure messages.
   * @param {Object} skill
   * @returns {boolean}
   */
  isSkillReady(skill) {
    if (!skill) return false;
    const now = this.scene.time?.now ?? 0;
    const readyAt = this.skillCooldowns.get(skill.id) || 0;
    if (now < readyAt) return false;
    if (!skillUnlocked(skill, this.player.stats?.level ?? 1)) return false;
    if ((this.player.stats?.mp ?? 0) < skillMpCost(skill.id)) return false;
    return true;
  }

  /**
   * Validate level, cooldown and MP without spending anything.
   * @param {Object} skill
   * @returns {boolean}
   */
  canCast(skill) {
    const now = this.scene.time?.now ?? 0;
    const readyAt = this.skillCooldowns.get(skill.id) || 0;
    if (now < readyAt) {
      this.ui.addLog(
        `${translate(skill.nameKey, undefined, skill.id)} còn ${Math.ceil((readyAt - now) / 1000)}s hồi.`
      );
      return false;
    }
    if (!skillUnlocked(skill, this.player.stats.level)) {
      this.ui.addLog(this.skillLockMessage(skill));
      return false;
    }
    if (this.player.stats.mp < skillMpCost(skill.id)) {
      this.ui.addLog("Nội lực không đủ để thi triển chiêu thức.");
      return false;
    }
    return true;
  }

  /**
   * Spend the cost and release the skill.
   * @param {Object} skill
   * @param {Object|null} target
   * @param {{x:number,y:number}|null} [aimPoint] cursor point when nothing was targeted
   */
  executeSkill(skill, target, aimPoint = null) {
    if (!this.canCast(skill)) return;
    const now = this.scene.time?.now ?? 0;
    const cost = skillMpCost(skill.id);

    this.skillCooldowns.set(skill.id, now + skill.cooldown);
    if (cost > 0) this.player.stats.mp -= cost;

    // Turn toward the target before the motion starts so the body, the VFX and
    // the packet that peers replay all agree on the direction.
    this.aimAt(target || aimPoint);

    this.player.playSkillMotion?.(skill.vfx?.cast);
    playTone(skill.mult > 1.5 ? 420 : 360, 0.18, "triangle", 0.035);
    this.showFloatText(
      this.player.x,
      this.player.y - 62,
      translate(skill.nameKey, undefined, skill.id),
      "#ffe9a8"
    );

    const aimed = target || aimPoint;
    // Send the AoE centre so the server can validate each hit against the area
    // the palm actually lands on instead of the whole cast range.
    const aimCenter = skill.radius > 0
      ? this.resolveCastCenter(skill, target, aimPoint)
      : aimed;
    this.scene.networkClient?.sendAttack?.({
      skill: skill.id,
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      ...(aimCenter
        ? { aimX: Math.round(aimCenter.x), aimY: Math.round(aimCenter.y) }
        : {}),
      facingRight: aimed ? aimed.x >= this.player.x : this.player.facingDirection !== 6
    });

    bridge.emit(EVENTS.SKILL_CAST, {
      slot: skill.slot,
      skillId: skill.id,
      cooldown: skill.cooldown,
      readyAt: this.skillCooldowns.get(skill.id)
    });

    this.applySkill(skill, now, target, aimPoint);
    this.ui.updateHud(this.player.stats);
  }

  /**
   * Distance at which a skill can release. For an AoE the cast range is how far
   * the centre can be placed, while `radius` only sizes the area; a radius-only
   * skill (`range: 0`) still releases from its own radius.
   * @param {Object} skill
   * @returns {number}
   */
  skillReach(skill) {
    const reach = Number(skill.range) > 0 ? Number(skill.range) : Number(skill.radius) || 0;
    return Math.min(reach, this.screenCastRange());
  }

  /**
   * Distance a cast at `target` may release from. A peer hit is validated by the
   * server against the shared PvP range, so a long-range skill still has to close
   * in before it can land.
   * @param {Object} skill
   * @param {Object} target
   * @returns {number}
   */
  castReach(skill, target) {
    const reach = this.skillReach(skill);
    return isPeerTarget(target) ? Math.min(reach, PVP_CAST_DISTANCE) : reach;
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
   * Pick the target of a cast: a locked or clicked duellist first, then the enemy
   * nearest to the clicked point (or to the hero when no point was supplied).
   * @param {{x:number,y:number}|null} aim
   * @returns {Object|null}
   */
  findTarget(aim) {
    const duellist = this.findPlayerTarget(aim);
    if (duellist) return duellist;

    const alive = this.enemyManager.getAlive();
    if (!alive.length) return null;

    if (aim) {
      // Only treat a click as a target when it is actually near a wolf, instead
      // of chasing whichever wolf happens to be closest to an empty click.
      const clicked = alive
        .filter((wolf) => Phaser.Math.Distance.Between(aim.x, aim.y, wolf.x, wolf.y) <= 150)
        .sort(
          (a, b) =>
            Phaser.Math.Distance.Between(aim.x, aim.y, a.x, a.y) -
            Phaser.Math.Distance.Between(aim.x, aim.y, b.x, b.y)
        );
      return clicked[0] || null;
    }

    const nearest = alive
      .filter((wolf) => Phaser.Math.Distance.Between(this.player.x, this.player.y, wolf.x, wolf.y) <= 600)
      .sort(
        (a, b) =>
          Phaser.Math.Distance.Between(this.player.x, this.player.y, a.x, a.y) -
          Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y)
      );
    return nearest[0] || null;
  }

  /**
   * The duellist a skill should aim at: the peer under the click, else the locked
   * PvP target (`scene.pvpTarget`, set by clicking a flagged peer), else the
   * closest flags-up opponent inside the PvP range. Only a hero flying the PK flag
   * may acquire one — a peaceful hero never auto-attacks.
   * @param {{x:number,y:number}|null} aim
   * @returns {Object|null}
   */
  findPlayerTarget(aim) {
    if (this.player.pkFlag !== true) return null;

    const peers = this.scene.remotePlayerManager?.getAll?.() || [];
    if (aim) {
      const clicked = findPlayerAt(peers, aim.x, aim.y);
      if (clicked?.pkFlag === true) return clicked;
    }

    const locked = this.scene.pvpTarget;
    if (isPeerTarget(locked) && locked.pkFlag === true && locked.container?.active !== false) {
      return locked;
    }

    // Nothing picked: an opponent already inside striking range is still the most
    // relevant target. Without this a skill cast next to a duellist flies past
    // them and does nothing, which reads as "skill hits but no HP loss".
    return findNearestPvpTarget(this.player, peers, PVP_ATTACK_RANGE);
  }

  /**
   * Drive a pending approach. Called from the scene's update loop.
   * @param {number} time
   */
  update(time) {
    const now = typeof time === "number" ? time : (this.scene?.time?.now ?? 0);
    this.updateBuffs(now);

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
   * still holds it. A peer that left or lowered its PK flag ends the chase.
   * @param {string} targetId
   * @returns {Object|null}
   */
  findPendingTarget(targetId) {
    const wolf = this.enemyManager.getAlive().find((entry) => entry.id === targetId);
    if (wolf) return wolf;

    const peer = (this.scene.remotePlayerManager?.getAll?.() || []).find((entry) => entry.id === targetId);
    if (!isPeerTarget(peer) || peer.pkFlag !== true) return null;
    return peer.container?.active === false ? null : peer;
  }

  /**
   * Cancel a pending approach (left-click movement, joystick, skill change).
   */
  cancelPendingCast() {
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
    if (skill.target === "self" || (skill.radius === 0 && skill.range === 0)) {
      playSkillCastVfx(this.scene, this.player, skill);
      this.applySelfEffects(skill, now);
      this.ui.addLog(`${translate(skill.nameKey, undefined, skill.id)} đã thi triển.`);
      return;
    }

    // An AoE lands on the chosen point (target, cursor, or the hero when neither
    // was supplied); a single-target skill resolves around the hero as before.
    const center = skill.radius > 0
      ? this.resolveCastCenter(skill, preferredTarget, aimPoint)
      : null;
    const targets = skill.radius > 0
      ? this.resolveTargets(skill, center)
      : (preferredTarget ? [preferredTarget] : this.resolveTargets(skill));
    const primary = targets[0] || null;
    // An AoE's art must land on the same centre the damage is resolved around,
    // even when the nearest victim is offset inside the radius.
    const vfxTarget = skill.radius > 0 ? center : primary;
    this.aimAt(vfxTarget || aimPoint);
    playSkillCastVfx(this.scene, this.player, skill, vfxTarget, aimPoint);
    if (center) {
      playRangeIndicator(this.scene, center.x, center.y, skill.radius, skill.vfx?.color);
    }

    // A peer's HP lives on the server, so that branch only reports the roll.
    if (isPeerTarget(primary)) {
      this.applySkillToPlayer(skill, primary);
      return;
    }

    if (!targets.length) {
      this.hintPeacefulDuelist(skill);
      return;
    }

    let hits = 0;

    for (const wolf of targets) {
      playTargetMarker(this.scene, wolf.x, wolf.y, skill.vfx?.color);
      this.damageEnemy(wolf, { skill: skill.id });
      hits++;
    }

    this.ui.addLog(
      `${translate(skill.nameKey, undefined, skill.id)} trúng ${hits} mục tiêu!`
    );
  }

  /**
   * Resolve a skill cast against another player. The peer's HP is server-owned, so
   * this only reports the roll; the returned `player_hp` (or a dodge refusal) drives
   * the floating damage number.
   * @param {Object} skill
   * @param {Object} target
   */
  applySkillToPlayer(skill, target) {
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);
    const attacker = { id: this.localPlayerId, pkFlag: true };
    const defender = { id: target.id, pkFlag: target.pkFlag === true };
    if (!canPvpAttack(attacker, defender, distance)) {
      this.ui.addLog(`${target.displayName || "Đối thủ"} ở ngoài tầm chiêu thức.`);
      return;
    }

    playTargetMarker(this.scene, target.x, target.y, skill.vfx?.color);

    this.syncPosition();
    this.scene.networkClient?.sendPlayerHit?.({ targetId: target.id, skill: skill.id });

    this.ui.addLog(
      `${translate(skill.nameKey, undefined, skill.id)} trúng ${target.displayName || "đối thủ"}!`
    );
  }

  /**
   * Explain a skill that found nothing when the reason is our own PK flag: an
   * opponent stands in range but a peaceful hero cannot damage them.
   * @param {Object} skill
   */
  hintPeacefulDuelist(skill) {
    if (this.player.pkFlag === true) return;

    const peers = this.scene.remotePlayerManager?.getAll?.() || [];
    const near = findNearestPvpTarget(this.player, peers, PVP_ATTACK_RANGE);
    if (!near) return;

    this.ui.addLog(
      `${near.displayName || "Đối thủ"} đã bật cờ PK — hãy bật cờ PK của bạn để ${translate(skill.nameKey, undefined, skill.id)} gây sát thương.`
    );
  }

  /**
   * Centre of an AoE cast: the clicked target, the cursor point, or the hero.
   * A point beyond the skill's cast range is pulled back to its edge so the
   * resolved area matches the VFX.
   * @param {Object} skill
   * @param {Object|null} preferredTarget
   * @param {{x:number,y:number}|null} aimPoint
   * @returns {{x:number,y:number}}
   */
  resolveCastCenter(skill, preferredTarget = null, aimPoint = null) {
    const aimedAt = preferredTarget || aimPoint;
    if (!aimedAt) return { x: this.player.x, y: this.player.y };
    return clampToRange(this.player, aimedAt, this.skillReach(skill));
  }

  /**
   * Enemies this cast can hit: everything inside the AoE radius around `center`
   * (defaults to the hero), or the nearest enemy inside the single-target range.
   * Extracted so aiming and hit resolution use exactly the same target set.
   * @param {Object} skill
   * @param {{x:number,y:number}|null} [center] AoE centre
   * @returns {Object[]}
   */
  resolveTargets(skill, center = null) {
    const alive = this.enemyManager.getAlive();

    if (skill.radius > 0) {
      const origin = center || { x: this.player.x, y: this.player.y };
      const distanceToCenter = (wolf) =>
        Phaser.Math.Distance.Between(origin.x, origin.y, wolf.x, wolf.y);
      return alive
        .filter((wolf) => distanceToCenter(wolf) <= skill.radius)
        .sort((a, b) => distanceToCenter(a) - distanceToCenter(b));
    }

    const playerDistanceTo = (wolf) =>
      Phaser.Math.Distance.Between(this.player.x, this.player.y, wolf.x, wolf.y);
    const range = this.skillReach(skill);
    const nearest = alive
      .filter((wolf) => playerDistanceTo(wolf) <= range)
      .sort((a, b) => playerDistanceTo(a) - playerDistanceTo(b))[0];
    return nearest ? [nearest] : [];
  }

  /**
   * Turn the hero toward the primary target so the cast VFX and attack motion
   * visibly point at whoever is about to be hit.
   * @param {Object|null} target
   */
  aimAt(target) {
    if (!target) return;
    const from = toIso(this.player.x, this.player.y);
    const to = toIso(target.x, target.y);
    const direction = directionFromVelocity(to.x - from.x, to.y - from.y);
    this.player.faceDirection?.(direction);
  }

  /**
   * Apply a skill's timed effects to the caster (buff, heal).
   * @param {Object} skill
   * @param {number} now
   */
  applySelfEffects(skill, now) {
    const overheadSprite = skill.vfx?.type === "overhead" ? skill.vfx.overhead : null;
    for (const effect of skill.effects || []) {
      if (effect.kind === "buff") {
        this.buffs.push({
          skillId: skill.id,
          formationSprite: skill.vfx?.type === "formation" ? skill.vfx.sprite : null,
          formationScale: skill.vfx?.type === "formation" && typeof skill.vfx.scale === "number" ? skill.vfx.scale : undefined,
          overheadSprite,
          overheadScale: overheadSprite && typeof skill.vfx.overheadScale === "number" ? skill.vfx.overheadScale : undefined,
          overheadOffsetY: overheadSprite && typeof skill.vfx.overheadOffsetY === "number" ? skill.vfx.overheadOffsetY : undefined,
          stat: effect.stat,
          amount: effect.amount,
          until: now + effect.duration
        });
      } else if (effect.kind === "heal") {
        // The server applies the heal when it accepts the cast and broadcasts the
        // resulting player_hp; the client only plays the VFX.
      }
    }
    if (skill.vfx?.type === "formation" && skill.vfx?.sprite) {
      if (typeof skill.vfx.scale === "number") {
        this.player.showFormation?.(skill.vfx.sprite, skill.vfx.scale);
      } else {
        this.player.showFormation?.(skill.vfx.sprite);
      }
    }
    if (overheadSprite) {
      this.player.showOverhead?.(overheadSprite, skill.vfx.overheadScale, skill.vfx.overheadOffsetY);
    }
  }

  /**
   * Filter expired buffs and update active formation aura under player feet.
   * Only prunes and updates when an active buff has reached its expiration timestamp,
   * avoiding allocations and redundant render state calls in the per-frame game loop.
   * @param {number} now
   */
  updateBuffs(now) {
    if (this.buffs.length === 0) return;

    let hasExpired = false;
    for (let i = 0; i < this.buffs.length; i++) {
      if (this.buffs[i].until <= now) {
        hasExpired = true;
        break;
      }
    }
    if (!hasExpired) return;

    this.buffs = this.buffs.filter((buff) => buff.until > now);
    const activeFormation = this.buffs.find((buff) => buff.formationSprite);
    if (activeFormation) {
      if (typeof activeFormation.formationScale === "number") {
        this.player.showFormation?.(activeFormation.formationSprite, activeFormation.formationScale);
      } else {
        this.player.showFormation?.(activeFormation.formationSprite);
      }
    } else {
      this.player.hideFormation?.();
    }

    const activeOverhead = this.buffs.find((buff) => buff.overheadSprite);
    if (activeOverhead) {
      this.player.showOverhead?.(
        activeOverhead.overheadSprite,
        activeOverhead.overheadScale,
        activeOverhead.overheadOffsetY
      );
    } else {
      this.player.hideOverhead?.();
    }
  }

  /**
   * Clear all active buffs and hide any buff formation rings or overhead seals.
   */
  clearBuffs() {
    this.buffs = [];
    this.player.hideFormation?.();
    this.player.hideOverhead?.();
  }

  /**
   * Strike another player. Both fighters must fly the PK flag. The client only
   * reports the intent; the server recomputes the damage from its own stats and
   * applies it to the target's authoritative HP.
   * @param {import("./remotePlayer.js").RemotePlayer} target
   */
  performPvpAttack(target) {
    if (!this.attackReady) return;
    if (!this.scene.networkClient?.isConnected) {
      this.ui.addLog("Cần kết nối máy chủ để tỷ thí cùng cao thủ.");
      return;
    }

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

    const attacker = { id: this.localPlayerId, pkFlag: true };
    const defender = { id: target.id, pkFlag: true };
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);

    if (!canPvpAttack(attacker, defender, distance)) {
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
