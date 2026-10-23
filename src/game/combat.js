import * as Phaser from "phaser";
import { addQuantity, rollDrop, DROP_TABLE_MAP, rollKillReward } from "./items.js";
import { parseEnemyReward } from "./rewardSync.js";
import { skillById, skillsForSect, skillMpCost, skillLockReason, skillUnlocked } from "./skills.js";
import { computeSkillDamage, applyBuffsToStats } from "./skillDamage.js";
import {
  playSkillCastVfx,
  playSkillImpactVfx,
  playRangeIndicator,
  playTargetMarker
} from "./skillVfx.js";
import { directionFromVelocity } from "./heroDirections.js";
import { toIso, isoDepth } from "./isoProjection.js";
import { canPvpAttack } from "./pvp.js";
import { computeDamage } from "./damage.js";
import { ATTACK_INTERVAL_MS } from "./combatConfig.js";
import { bridge, EVENTS } from "./bridge.js";
import { translate } from "../i18n/translator.js";

let audioEnabled = true;
let audioContext = null;

const MAX_DROPS = 40;
const UNOWNED_DROP_TTL_MS = 15000;

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
    /** Skill slots assigned to UIOP keys and mouse buttons. */
    this.skillLoadout = { u: 0, i: 1, o: 2, p: 3, left: 0, right: 1 };
    this.selectedSkillSlot = 0;
    this.leftSkillSlot = 0;
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
   * The player's stats with active timed buffs applied. The server is told these
   * numbers so its authoritative skill damage matches the client's prediction.
   * @returns {Object}
   */
  getEffectiveStats() {
    const now = this.scene?.time?.now ?? 0;
    this.buffs = this.buffs.filter((buff) => buff.until > now);
    return applyBuffsToStats(this.player.stats, this.buffs, now);
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

  performAttack() {
    if (!this.attackReady) return;
    this.attackReady = false;
    this.scene.time.delayedCall(this.attackIntervalMs(), () => {
      this.attackReady = true;
    });

    // Trigger physical sword thrust / lunge animation on character body
    this.player.playAttackMotion?.();

    playTone(260, 0.07, "sawtooth", 0.02);

    const facingRight = this.player.visual.scaleX >= 0;
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

    const candidates = this.enemyManager
      .getAlive()
      .filter((wolf) => Phaser.Math.Distance.Between(this.player.x, this.player.y, wolf.x, wolf.y) < 85);

    if (!candidates.length) {
      return;
    }

    candidates.sort(
      (a, b) =>
        Phaser.Math.Distance.Between(this.player.x, this.player.y, a.x, a.y) -
        Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y)
    );

    const targetEnemy = candidates[0];
    const result = computeDamage(this.player, targetEnemy, Math.random);
    this.damageEnemy(targetEnemy, result.damage, result.crit);

    if (result.crit) {
      this.ui.addLog(`Chí mạng! Kiếm chiêu đánh trúng Sói Xám gây ${result.damage} sát thương!`);
    } else {
      this.ui.addLog(`Kiếm chiêu đánh trúng Sói Xám gây ${result.damage} sát thương.`);
    }
  }

  /**
   * The skill currently assigned to the right hand.
   * @returns {Object|undefined}
   */
  getSelectedSkill() {
    return skillsForSect(this.player.sect).find((skill) => skill.slot === this.selectedSkillSlot);
  }

  /**
   * The skill assigned to the left mouse button.
   * @returns {Object|undefined}
   */
  getLeftSkill() {
    return skillsForSect(this.player.sect).find((skill) => skill.slot === this.leftSkillSlot);
  }

  /**
   * Validate and assign a skill slot to one mouse button.
   * @param {"left"|"right"} hand
   * @param {number} slot
   * @returns {boolean}
   */
  equipSkill(hand, slot) {
    const skill = skillsForSect(this.player.sect).find((entry) => entry.slot === slot);
    if (!skill) {
      this.ui.addLog("Môn phái này chưa có chiêu thức ở ô đó.");
      return false;
    }
    if (hand === "left" && skill.target === "self") {
      this.ui.addLog("Chiêu thức tự thân không thể gán vào chuột trái.");
      return false;
    }
    if (!skillUnlocked(skill, this.player.stats.level)) {
      this.ui.addLog(this.skillLockMessage(skill));
      return false;
    }
    this.cancelPendingCast();
    if (hand === "left") {
      this.leftSkillSlot = slot;
      bridge.emit(EVENTS.LEFT_SKILL_SELECTED, slot);
    } else {
      this.selectedSkillSlot = slot;
      bridge.emit(EVENTS.SKILL_SELECTED, slot);
    }
    return true;
  }

  /**
   * Keyboard shortcut: assign a skill to the right mouse button.
   * @param {number} slot
   * @returns {boolean}
   */
  selectSkill(slot) {
    const ok = this.equipSkill("right", slot);
    if (ok) {
      const skill = this.getSelectedSkill();
      this.ui.addLog(`Tay phải: ${translate(skill.nameKey, undefined, skill.id)} (chuột phải để dùng).`);
    }
    return ok;
  }

  /**
   * Update the active skill loadout.
   * @param {Object} loadout
   */
  setSkillLoadout(loadout) {
    if (!loadout) return;
    this.skillLoadout = {
      u: loadout.u ?? 0,
      i: loadout.i ?? 1,
      o: loadout.o ?? 2,
      p: loadout.p ?? 3,
      left: loadout.u ?? loadout.left ?? 0,
      right: loadout.i ?? loadout.right ?? 1
    };
    this.selectedSkillSlot = this.skillLoadout.u;
    this.leftSkillSlot = this.skillLoadout.i;
    this.cancelPendingCast();
  }

  /**
   * Cast the skill assigned to a specific key (u, i, o, p).
   * @param {string} key
   * @param {{x:number,y:number}|null} [aim]
   * @returns {boolean}
   */
  castSkillByKey(key, aim = null) {
    const slot = this.skillLoadout?.[key?.toLowerCase()];
    if (slot === undefined) return false;
    return this.castSkillBySlot(slot, aim);
  }

  /**
   * Directly cast a skill assigned to a slot.
   * @param {number} slot
   * @param {{x:number,y:number}|null} [aim]
   * @returns {boolean}
   */
  castSkillBySlot(slot, aim = null) {
    const skill = skillsForSect(this.player.sect).find((entry) => entry.slot === slot);
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
    if (!this.canCast(skill)) return false;

    if (skill.target === "self") {
      this.executeSkill(skill, null);
      return true;
    }

    const target = this.findTarget(aim);
    if (!target) {
      if (aim && this.player) {
        this.player.setFacingRight?.(aim.x >= this.player.x);
      }
      this.executeSkill(skill, null);
      return true;
    }

    this.approachAndCast(skill, target);
    return true;
  }

  /**
   * Right mouse button: cast on the clicked target, or release in place when the
   * click did not land on an enemy.
   * @param {{x:number,y:number}|null} [aim]
   */
  castSelectedSkill(aim = null) {
    this.performSkill(aim);
  }

  /**
   * Left mouse button: cast on a clicked enemy. The hero walks into range first.
   * @param {Object} target
   */
  castLeftSkill(target) {
    const skill = this.getLeftSkill();
    if (!skill || !target || skill.target === "self") return false;
    if (!this.canCast(skill)) return true;
    this.approachAndCast(skill, target);
    return true;
  }

  /**
   * Start a cast. Melee skills first walk the hero into range (VLTK2 behaviour);
   * the actual release happens in update() once the target is reachable.
   * @param {{x:number,y:number}|null} [aim]
   */
  performSkill(aim = null) {
    const skill = this.getSelectedSkill();
    if (!skill) {
      this.ui.addLog("Chưa gán chiêu thức vào ô này.");
      return;
    }
    this.castSkill(skill, aim);
  }

  /**
   * Walk the hero into the skill's reach, then release it. Used by both mouse
   * buttons when an enemy is targeted.
   * @param {Object} skill
   * @param {Object} target
   */
  approachAndCast(skill, target) {
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);
    if (distance <= this.skillReach(skill)) {
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
   */
  executeSkill(skill, target) {
    if (!this.canCast(skill)) return;
    const now = this.scene.time?.now ?? 0;
    const cost = skillMpCost(skill.id);

    this.skillCooldowns.set(skill.id, now + skill.cooldown);
    if (cost > 0) this.player.stats.mp -= cost;

    this.player.playSkillMotion?.(skill.vfx?.cast);
    playTone(skill.mult > 1.5 ? 420 : 360, 0.18, "triangle", 0.035);
    this.showFloatText(
      this.player.x,
      this.player.y - 62,
      translate(skill.nameKey, undefined, skill.id),
      "#ffe9a8"
    );

    this.scene.networkClient?.sendAttack?.({
      skill: skill.id,
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      facingRight: this.player.visual.scaleX >= 0
    });

    bridge.emit(EVENTS.SKILL_CAST, {
      slot: skill.slot,
      skillId: skill.id,
      cooldown: skill.cooldown,
      readyAt: this.skillCooldowns.get(skill.id)
    });

    this.applySkill(skill, now, target);
    this.ui.updateHud(this.player.stats);
  }

  /**
   * Distance at which a skill can release.
   * @param {Object} skill
   * @returns {number}
   */
  skillReach(skill) {
    if (skill.radius > 0) return skill.radius;
    return Math.min(skill.range, this.screenCastRange());
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
   * Pick the enemy nearest to the clicked point, or to the hero when no point
   * was supplied.
   * @param {{x:number,y:number}|null} aim
   * @returns {Object|null}
   */
  findTarget(aim) {
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
   * Drive a pending approach. Called from the scene's update loop.
   * @param {number} time
   */
  update(time) {
    const now = typeof time === "number" ? time : (this.scene?.time?.now ?? 0);
    this.updateBuffs(now);

    const pending = this.pendingCast;
    if (!pending) return;

    const target = this.enemyManager
      .getAlive()
      .find((wolf) => wolf.id === pending.targetId);
    if (!target) {
      this.cancelPendingCast();
      this.ui.addLog("Mục tiêu đã biến mất.");
      return;
    }

    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);
    if (distance <= this.skillReach(pending.skill)) {
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
   */
  applySkill(skill, now, preferredTarget = null) {
    if (skill.target === "self" || (skill.radius === 0 && skill.range === 0)) {
      playSkillCastVfx(this.scene, this.player, skill);
      this.applySelfEffects(skill, now);
      this.ui.addLog(`${translate(skill.nameKey, undefined, skill.id)} đã thi triển.`);
      return;
    }

    const targets = skill.radius > 0
      ? this.resolveTargets(skill)
      : (preferredTarget ? [preferredTarget] : this.resolveTargets(skill));
    const primary = targets[0] || null;
    this.aimAt(primary);
    playSkillCastVfx(this.scene, this.player, skill, primary);
    if (skill.radius > 0) {
      playRangeIndicator(this.scene, this.player.x, this.player.y, skill.radius, skill.vfx?.color);
    }

    if (!targets.length) {
      return;
    }

    const attacker = applyBuffsToStats(this.player.stats, this.buffs, now);
    let hits = 0;
    let anyCrit = false;

    for (const wolf of targets) {
      playTargetMarker(this.scene, wolf.x, wolf.y, skill.vfx?.color);
      const result = computeSkillDamage(skill, attacker, wolf, Math.random);
      if (result.damage > 0) {
        if (result.crit) anyCrit = true;
        this.damageEnemy(wolf, result.damage, result.crit, { skill: skill.id });
        hits++;
      }
      this.applySkillEffectsToEnemy(wolf, skill, now);
    }

    const critText = anyCrit ? " (Chí mạng!)" : "";
    this.ui.addLog(
      `${translate(skill.nameKey, undefined, skill.id)} trúng ${hits} mục tiêu!${critText}`
    );
  }

  /**
   * Enemies this cast can hit: everything inside the AoE radius, or the nearest
   * enemy inside the single-target range. Extracted so aiming and hit resolution
   * use exactly the same target set.
   * @param {Object} skill
   * @returns {Object[]}
   */
  resolveTargets(skill) {
    const alive = this.enemyManager.getAlive();
    const distanceTo = (wolf) => Phaser.Math.Distance.Between(this.player.x, this.player.y, wolf.x, wolf.y);

    if (skill.radius > 0) {
      return alive
        .filter((wolf) => distanceTo(wolf) <= skill.radius)
        .sort((a, b) => distanceTo(a) - distanceTo(b));
    }

    const range = this.skillReach(skill);
    const nearest = alive
      .filter((wolf) => distanceTo(wolf) <= range)
      .sort((a, b) => distanceTo(a) - distanceTo(b))[0];
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
    for (const effect of skill.effects || []) {
      if (effect.kind === "buff") {
        this.buffs.push({
          skillId: skill.id,
          formationSprite: skill.vfx?.type === "formation" ? skill.vfx.sprite : null,
          formationScale: skill.vfx?.type === "formation" && typeof skill.vfx.scale === "number" ? skill.vfx.scale : undefined,
          stat: effect.stat,
          amount: effect.amount,
          until: now + effect.duration
        });
      } else if (effect.kind === "heal") {
        const amount = Math.round((effect.amount || 0) + (this.player.stats.maxHp * (effect.pctMaxHp || 0)));
        if (amount > 0) {
          if (this.scene.networkClient?.isConnected) {
            this.scene.networkClient.sendHeal({ amount });
          } else {
            this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + amount);
          }
        }
      }
    }
    if (skill.vfx?.type === "formation" && skill.vfx?.sprite) {
      if (typeof skill.vfx.scale === "number") {
        this.player.showFormation?.(skill.vfx.sprite, skill.vfx.scale);
      } else {
        this.player.showFormation?.(skill.vfx.sprite);
      }
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
  }

  /**
   * Clear all active buffs and hide any buff formation rings.
   */
  clearBuffs() {
    this.buffs = [];
    this.player.hideFormation?.();
  }

  /**
   * Apply a skill's timed effects to a struck enemy (slow, stun).
   * @param {Object} wolf
   * @param {Object} skill
   * @param {number} now
   */
  applySkillEffectsToEnemy(wolf, skill, now) {
    for (const effect of skill.effects || []) {
      if (effect.kind === "slow") {
        wolf.slowPct = effect.pct;
        wolf.slowUntil = now + effect.duration;
      } else if (effect.kind === "stun") {
        wolf.stunUntil = now + effect.duration;
      }
    }
  }

  /**
   * Strike another player. Both fighters must fly the PK flag. The damage is
   * computed here as an optimistic estimate, but the server re-validates it and
   * applies it to the target's authoritative HP — this client only reports intent.
   * @param {import("./remotePlayer.js").RemotePlayer} target
   */
  performPvpAttack(target) {
    if (!this.attackReady) return;
    if (!this.scene.networkClient?.isConnected) {
      this.ui.addLog("Cần kết nối máy chủ để tỷ thí cùng cao thủ.");
      return;
    }

    const attacker = { id: this.localPlayerId, pkFlag: this.player.pkFlag === true };
    const defender = { id: target?.id, pkFlag: target?.pkFlag === true };
    const distance = target
      ? Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y)
      : Number.NaN;

    if (!canPvpAttack(attacker, defender, distance)) {
      this.ui.addLog(
        this.player.pkFlag === true
          ? `${target?.displayName || "Đối thủ"} chưa bật cờ PK.`
          : "Hãy bật cờ PK trước khi tấn công người chơi khác."
      );
      return;
    }

    this.attackReady = false;
    this.scene.time.delayedCall(this.attackIntervalMs(), () => {
      this.attackReady = true;
    });

    this.player.playAttackMotion?.();
    playTone(300, 0.07, "sawtooth", 0.022);

    const facingRight = target.x >= this.player.x;
    const slashOffsetX = facingRight ? 16 : -16;
    const base = toIso(this.player.x, this.player.y);

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

    const result = computeDamage(this.player, target, Math.random);
    this.scene.networkClient?.sendPlayerHit?.({
      targetId: target.id,
      damage: result.damage
    });

    // Optimistic feedback; the authoritative HP arrives back from the server.
    this.showFloatText(
      target.x,
      target.y - 30,
      result.crit ? `-${result.damage} BẠO KÍCH!` : `-${result.damage}`,
      result.crit ? "#ffcc00" : "#ffb49a"
    );
    this.ui.addLog(
      `${result.crit ? "Chí mạng! " : ""}Kiếm chiêu chém tới ${target.displayName || "đối thủ"}!`
    );
  }

  damageEnemy(wolf, damage, isCrit = false, meta = {}) {
    if (wolf.isDead) return;

    wolf.takeHit(damage);
    const floatText = isCrit ? `-${damage} BẠO KÍCH!` : `-${damage}`;
    const floatColor = isCrit ? "#ffcc00" : "#ffb49a";
    this.showFloatText(wolf.x, wolf.y - 30, floatText, floatColor);
    playTone(isCrit ? 180 : 120, 0.06, "square", isCrit ? 0.025 : 0.012);

    const skill = meta.skill ? skillById(meta.skill) : null;
    if (skill) playSkillImpactVfx(this.scene, wolf.x, wolf.y, skill);

    // The server owns the wolf's health: a skill hit names the skill so the server
    // can recompute the damage itself; a plain attack still reports its estimate.
    this.scene.networkClient?.sendEnemyHit?.({
      id: wolf.id,
      damage,
      ...(meta.skill ? { skill: meta.skill } : {})
    });

    if (wolf.hp <= 0) {
      this.handleWolfKill(wolf);
    }
  }

  handleWolfKill(wolf) {
    wolf.die();

    // Online, enemy health and the reward are server-owned: the server rolls the
    // payout and broadcasts `enemy_reward` + an authoritative `player_progress`.
    if (this.usesServerRewards()) {
      this.ui.addLog("Đánh bại Sói Xám!");
      return;
    }

    // Offline (no server connection) progression is frozen: the kill plays out,
    // but the client never mints coins/EXP of its own and nothing is dropped.
    this.ui.addLog("Đánh bại Sói Xám! (ngoại tuyến — không nhận tiến trình)");

    // Schedule enemy revive (the server drives respawn while connected)
    this.scene.time.delayedCall(10000, () => {
      wolf.revive();
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

    this.ui.addLog(`Đánh bại Sói Xám! +${reward.exp} EXP`);
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
   * True while a multiplayer connection owns enemy state; the reward then comes
   * from the server instead of a local roll.
   * @returns {boolean}
   */
  usesServerRewards() {
    return this.scene?.networkClient?.isConnected === true;
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
   * the persisted `quest_rewarded` flag). Offline, nothing is paid. The resulting
   * `player_progress` arrives through applyServerProgress().
   */
  handleQuestReward() {
    if (this.usesServerRewards()) {
      this.scene.networkClient?.sendQuestClaim?.();
    }
    this.ui.addLog("Nhiệm vụ hoàn thành! Phần thưởng sẽ do máy chủ trao.");
  }

  /**
   * Spawn a collectable drop. Without an explicit entry the loot is rolled
   * locally (offline play); while connected the server supplies the entry so
   * every client renders the same item.
   * @param {number} x
   * @param {number} y
   * @param {?{id:string, qty:number}} [loot]
   * @param {{collectable?:boolean}} [options] - `collectable: false` renders loot
   *   owned by another player, which only shows up in the world
   */
  spawnDrop(x, y, loot = null, { collectable = true } = {}) {
    this.drops = this.drops || [];
    const rolled = loot || rollDrop();
    const dropEntry = DROP_TABLE_MAP.get(rolled.id);

    const drop = {
      x,
      y,
      phase: Math.random() * 6,
      active: true,
      collectable,
      itemId: rolled.id,
      qty: rolled.qty ?? dropEntry?.qty ?? 1,
      name: dropEntry ? dropEntry.name : rolled.id,
      // Someone else's loot can never be picked up, so it fades instead of littering.
      expiresAt: collectable ? null : (this.scene.time?.now ?? 0) + UNOWNED_DROP_TTL_MS
    };

    const dropIso = toIso(x, y);
    drop.visual = this.scene.add.container(dropIso.x, dropIso.y).setDepth(isoDepth(x, y) + 5);
    if (!collectable) {
      drop.visual.setAlpha(0.55);
    }
    drop.visual.add(this.scene.add.circle(0, 0, 13, 0xe9bd59, 0.12));
    drop.visual.add(
      this.scene.add
        .polygon(0, 0, [0, -8, 7, 0, 0, 8, -7, 0], 0x8fd7b2)
        .setStrokeStyle(2, 0xe0f4c5)
    );
    drop.visual.add(this.scene.add.circle(0, 0, 2, 0xffffff));

    this.drops.push(drop);
  }

  updateDrops(time) {
    this.drops = this.drops || [];
    if (this.drops.length > MAX_DROPS) {
      this.drops = this.drops.filter((drop) => drop.active).slice(-MAX_DROPS);
    }

    this.drops.forEach((drop) => {
      if (!drop.active) return;

      if (!drop.collectable && time >= drop.expiresAt) {
        drop.active = false;
        drop.visual.destroy();
        return;
      }

      const dropIso = toIso(drop.x, drop.y + Math.sin(time / 180 + drop.phase) * 4);
      drop.visual.setPosition(dropIso.x, dropIso.y);

      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, drop.x, drop.y) < 38) {
        this.collectDrop(drop);
      }
    });
  }

  collectDrop(drop) {
    if (!drop.active || !drop.collectable) return;
    drop.active = false;
    drop.visual.destroy();

    // Coins are server-owned, so a pickup grants no bạc on the client. MP is
    // server-owned too: predict locally and mirror the restore into the pool.
    this.player.stats.mp = Math.min(this.player.stats.maxMp, this.player.stats.mp + 5);
    this.scene.networkClient?.sendRestoreMp?.({ amount: 5 });

    addQuantity(drop.itemId, drop.qty);

    const dropName = drop.name || drop.itemId;
    this.ui.addLog(`Nhặt được ${dropName} x${drop.qty}: +5 nội lực.`);
    this.ui.updateHud(this.player.stats);
    this.ui.updateInventory();
    if (typeof this.onStateChange === "function") {
      this.onStateChange();
    }
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
