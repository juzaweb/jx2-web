/**
 * Client-side skill casting: gating, aim resolution, damage targeting, buffs and
 * the channelled-flurry lifecycle.
 *
 * Extracted from `CombatSystem` so the cast rules live next to the catalog while
 * `CombatSystem` keeps the state (`skillCooldowns`, `buffs`, `channel`,
 * `pendingCast`, `learnedSkills`) and the public methods tests rely on.
 *
 * Every cross-call goes through `this.combat.<method>` (not `this.<method>`) so
 * a test or a scene that overrides one public method still intercepts the call.
 * State is read and written on `this.combat` for the same reason.
 *
 * Client-only: this module imports Phaser and must never be re-exported by the
 * server-safe `skills/index.js` barrel.
 */

import * as Phaser from "phaser";

import {
  effectiveSkillCooldown,
  effectiveSkillMpCost,
  selfBuffEntries,
  skillCastReach,
  skillLockReason,
  skillUsable,
  skillsForWeapon
} from "../index.js";
import {
  channelDurationMs,
  channelHitCount,
  channelIntervalMs,
  isChannelSkill,
  splashRadius
} from "../../combatRules.js";
import { PVP_ATTACK_RANGE, PVP_CAST_DISTANCE, canPvpAttack, mayDuel } from "../../pvp.js";
import { findNearestPvpTarget } from "../../pvpTargeting.js";
import { clampToRange } from "../../aim.js";
import { toIso } from "../../isoProjection.js";
import { directionFromVelocity } from "../../heroDirections.js";
import { bridge, EVENTS } from "../../bridge.js";
import { translate } from "../../../i18n/translator.js";
import {
  playRangeIndicator,
  playSkillCastVfx,
  playSkillImpactVfx,
  playTargetMarker
} from "./vfx.js";

/**
 * Monsters carry a catalog id; a peer (RemotePlayer) does not. That difference is
 * what tells the two target kinds apart in a cast — a monster is drawn locally,
 * while a peer's HP is server-owned.
 * @param {*} target
 * @returns {boolean}
 */
export const isPeerTarget = (target) => Boolean(target) && typeof target.monsterId !== "string";

export class SkillCastController {
  /**
   * @param {import("../../combat.js").CombatSystem} combat owner of the cast state
   * @param {{ playTone?: Function }} [deps]
   */
  constructor(combat, deps = {}) {
    this.combat = combat;
    this.playTone = deps.playTone || (() => {});
  }

  /**
   * Cast a skill bound to a numbered hotbar slot, by catalog id.
   * @param {string} skillId
   * @param {{x:number,y:number}|null} [aim]
   * @returns {boolean}
   */
  castSkillById(skillId, aim = null) {
    const skill = skillsForWeapon(this.combat.player.weaponType).find(
      (entry) => entry.id === skillId
    );
    if (!skill) {
      this.combat.ui.addLog("Vũ khí đang trang bị không có chiêu thức này.");
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
      this.combat.ui.addLog(`${translate(skill.nameKey, undefined, skill.id)} tự động vận hành.`);
      return false;
    }
    if (!this.combat.canCast(skill)) return false;

    if (skill.target === "self") {
      this.combat.executeSkill(skill, null);
      return true;
    }

    // Self buffs and heals still work in town; anything aimed at a body does not.
    if (!this.combat.canFight()) {
      this.combat.ui.addLog(
        `${translate(skill.nameKey, undefined, skill.id)} không thể thi triển trong khu vực thành.`,
        "system"
      );
      return false;
    }

    // A cursor sitting on the hero carries no direction; treat it as "no aim".
    const aimPoint =
      aim && Math.hypot(aim.x - this.combat.player.x, aim.y - this.combat.player.y) > 1 ? aim : null;

    const target = this.combat.findTarget(aimPoint);
    if (!target) {
      // Nothing to hit: the projectile still flies toward where the player aimed.
      this.combat.executeSkill(skill, null, aimPoint);
      return true;
    }

    this.combat.approachAndCast(skill, target);
    return true;
  }

  /**
   * Walk the hero into the skill's reach, then release it.
   * @param {Object} skill
   * @param {Object} target
   */
  approachAndCast(skill, target) {
    const distance = Phaser.Math.Distance.Between(
      this.combat.player.x,
      this.combat.player.y,
      target.x,
      target.y
    );
    if (distance <= this.combat.castReach(skill, target)) {
      this.combat.executeSkill(skill, target);
      return;
    }

    this.combat.pendingCast = { skill, targetId: target.id };
    this.combat.lastChaseAt = 0;
    this.combat.player.moveTo(target.x, target.y);
    this.combat.ui.addLog(
      `Đang tiếp cận mục tiêu để dùng ${translate(skill.nameKey, undefined, skill.id)}...`
    );
  }

  /**
   * Explain why a skill cannot be used yet.
   * @param {Object} skill
   * @returns {string}
   */
  skillLockMessage(skill) {
    const reason = skillLockReason(skill, this.combat.player.stats.level, this.combat.learnedSkills);
    if (reason?.kind === "book") {
      return "Chưa học chiêu thức này. Dùng sách võ công để học.";
    }
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
    const now = this.combat.scene.time?.now ?? 0;
    const readyAt = this.combat.skillCooldowns.get(skill.id) || 0;
    if (now < readyAt) return false;
    if (!skillUsable(skill, this.combat.player.stats?.level ?? 1, this.combat.learnedSkills)) {
      return false;
    }
    if ((this.combat.player.stats?.mp ?? 0) < effectiveSkillMpCost(skill.id)) return false;
    return true;
  }

  /**
   * Validate level, cooldown and MP without spending anything.
   * @param {Object} skill
   * @returns {boolean}
   */
  canCast(skill) {
    const now = this.combat.scene.time?.now ?? 0;
    if (this.combat.channel) {
      this.combat.ui.addLog("Đang thi triển liên hoàn chiêu thức, hãy chờ đánh xong.");
      return false;
    }
    const readyAt = this.combat.skillCooldowns.get(skill.id) || 0;
    if (now < readyAt) {
      this.combat.ui.addLog(
        `${translate(skill.nameKey, undefined, skill.id)} còn ${Math.ceil((readyAt - now) / 1000)}s hồi.`
      );
      return false;
    }
    if (!skillUsable(skill, this.combat.player.stats.level, this.combat.learnedSkills)) {
      this.combat.ui.addLog(this.skillLockMessage(skill));
      return false;
    }
    if (this.combat.player.stats.mp < effectiveSkillMpCost(skill.id)) {
      this.combat.ui.addLog("Nội lực không đủ để thi triển chiêu thức.");
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
    if (!this.combat.canCast(skill)) return;
    const now = this.combat.scene.time?.now ?? 0;
    // Test mode reports 0, so a whole kit can be cast back to back.
    const cooldownMs = effectiveSkillCooldown(skill.id);

    // Cooldown is a local pacing hint; MP is only mirrored from the server's
    // `player_mp`, so the client never spends a pool it does not own.
    this.combat.skillCooldowns.set(skill.id, now + cooldownMs);
    // Turn toward the target before the motion starts so the body, the VFX and
    // the packet that peers replay all agree on the direction.
    this.combat.aimAt(target || aimPoint);

    this.combat.player.playSkillMotion?.(skill.vfx?.cast);
    this.playTone(skill.mult > 1.5 ? 420 : 360, 0.18, "triangle", 0.035);
    this.combat.showFloatText(
      this.combat.player.x,
      this.combat.player.y - 62,
      translate(skill.nameKey, undefined, skill.id),
      "#ffe9a8"
    );

    const aimed = target || aimPoint;
    // Send the AoE centre so the server can validate each hit against the area
    // the palm actually lands on instead of the whole cast range.
    const aimCenter =
      skill.radius > 0 ? this.combat.resolveCastCenter(skill, target, aimPoint) : aimed;
    this.combat.scene.networkClient?.sendAttack?.({
      skill: skill.id,
      x: Math.round(this.combat.player.x),
      y: Math.round(this.combat.player.y),
      ...(aimCenter
        ? { aimX: Math.round(aimCenter.x), aimY: Math.round(aimCenter.y) }
        : {}),
      facingRight: aimed ? aimed.x >= this.combat.player.x : this.combat.player.facingDirection !== 6
    });

    bridge.emit(EVENTS.SKILL_CAST, {
      slot: skill.slot,
      skillId: skill.id,
      cooldown: cooldownMs,
      readyAt: this.combat.skillCooldowns.get(skill.id)
    });

    this.combat.applySkill(skill, now, target, aimPoint);
    this.combat.ui.updateHud(this.combat.player.stats);
  }

  /**
   * Distance at which a skill can release, capped by what the camera shows.
   * @param {Object} skill
   * @returns {number}
   */
  skillReach(skill) {
    return Math.min(skillCastReach(skill), this.combat.screenCastRange());
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
    const reach = this.combat.skillReach(skill);
    return isPeerTarget(target) ? Math.min(reach, PVP_CAST_DISTANCE) : reach;
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
      playSkillCastVfx(this.combat.scene, this.combat.player, skill);
      this.combat.applySelfEffects(skill, now);
      this.combat.ui.addLog(`${translate(skill.nameKey, undefined, skill.id)} đã thi triển.`);
      return;
    }

    // An AoE lands on the chosen point (target, cursor, or the hero when neither
    // was supplied); a single-target skill resolves around the hero as before.
    const center =
      skill.radius > 0 ? this.combat.resolveCastCenter(skill, preferredTarget, aimPoint) : null;
    const preferredPeer = isPeerTarget(preferredTarget) ? preferredTarget : null;
    const monsters =
      skill.radius > 0
        ? this.combat.resolveTargets(skill, center)
        : preferredPeer
          ? []
          : preferredTarget
            ? [preferredTarget]
            : this.combat.resolveTargets(skill);
    // An AoE hits every flagged player in its area too, not just monsters.
    const peers =
      skill.radius > 0
        ? this.combat.resolvePeerTargets(skill, center)
        : preferredPeer
          ? [preferredPeer]
          : [];
    const primary = preferredPeer || peers[0] || monsters[0] || null;
    // An AoE's art must land on the same centre the damage is resolved around,
    // even when the nearest victim is offset inside the radius.
    const vfxTarget = skill.radius > 0 ? center : primary;
    this.combat.aimAt(vfxTarget || aimPoint);
    playSkillCastVfx(this.combat.scene, this.combat.player, skill, vfxTarget, aimPoint);
    if (center) {
      playRangeIndicator(this.combat.scene, center.x, center.y, skill.radius, skill.vfx?.color);
    }

    // A channel holds the caster in a five-second flurry. Both monsters and
    // peers can be its target, each resolved by its own server path per strike.
    if (isChannelSkill(skill)) {
      const channelTarget = preferredPeer || monsters[0] || null;
      if (channelTarget) {
        this.combat.startChannel(skill, channelTarget, now);
        return;
      }
    }

    if (!monsters.length && !peers.length) {
      this.combat.hintPeacefulDuelist(skill);
      return;
    }

    let hits = 0;

    for (const wolf of monsters) {
      playTargetMarker(this.combat.scene, wolf.x, wolf.y, skill.vfx?.color);
      this.combat.damageEnemy(wolf, { skill: skill.id });
      hits++;
    }

    // One position sync covers every peer this cast names.
    if (peers.length > 0) this.combat.syncPosition();

    for (const peer of peers) {
      if (this.combat.applySkillToPlayer(skill, peer, { log: false, sync: false })) hits++;
    }

    this.combat.ui.addLog(
      `${translate(skill.nameKey, undefined, skill.id)} trúng ${hits} mục tiêu!`
    );
  }

  /**
   * Begin a channelled flurry.
   * @param {Object} skill
   * @param {Object} target
   * @param {number} now
   */
  startChannel(skill, target, now) {
    this.combat.player.stopMovement?.();
    this.combat.channel = {
      skill,
      targetId: target.id,
      nextAt: now,
      endsAt: now + channelDurationMs(skill),
      hitsLeft: channelHitCount(skill),
      intervalMs: channelIntervalMs(skill),
      chasing: false
    };
    this.combat.ui.addLog(
      `${translate(skill.nameKey, undefined, skill.id)}: liên hoàn ${this.combat.channel.hitsLeft} quyền!`
    );
  }

  /**
   * Drive the active flurry. Re-resolves the target every strike so a moving
   * monster is chased instead of being punched at a stale position.
   * @param {number} now
   */
  updateChannel(now) {
    const channel = this.combat.channel;
    if (!channel) return;

    if (now >= channel.endsAt || channel.hitsLeft <= 0) {
      this.combat.endChannel();
      return;
    }
    if (now < channel.nextAt) return;

    const target = this.combat.findPendingTarget(channel.targetId);
    if (!target) {
      this.combat.endChannel("Mục tiêu đã biến mất.");
      return;
    }

    const distance = Phaser.Math.Distance.Between(
      this.combat.player.x,
      this.combat.player.y,
      target.x,
      target.y
    );
    if (distance > this.combat.castReach(channel.skill, target)) {
      // The target stepped away: chase it and retry the same strike shortly.
      channel.nextAt = now + 150;
      channel.chasing = true;
      this.combat.player.moveTo(target.x, target.y);
      return;
    }

    if (channel.chasing) {
      channel.chasing = false;
      this.combat.player.stopMovement?.();
      this.combat.syncPosition();
    }

    this.combat.aimAt(target);
    this.combat.player.playSkillMotion?.(channel.skill.vfx?.cast);
    this.playTone(200, 0.05, "square", 0.018);
    playTargetMarker(this.combat.scene, target.x, target.y, channel.skill.vfx?.color);

    // The ring marks the area every strike reaches, whatever the target kind:
    // the server resolves the same splash for monsters and flagged players.
    const splash = splashRadius(channel.skill);
    if (splash > 0) {
      playRangeIndicator(this.combat.scene, target.x, target.y, splash, channel.skill.vfx?.color);
    }

    if (!this.combat.strikeChannelTarget(target, channel.skill)) return;

    channel.hitsLeft -= 1;
    channel.nextAt = now + channel.intervalMs;
    if (channel.hitsLeft <= 0) this.combat.endChannel();
  }

  /**
   * Land one strike of a channel on its resolved target.
   * @param {Object} target monster or peer
   * @param {Object} skill
   * @returns {boolean} false when the strike can no longer be delivered
   */
  strikeChannelTarget(target, skill) {
    if (!isPeerTarget(target)) {
      this.combat.damageEnemy(target, { skill: skill.id });
      return true;
    }

    const distance = Phaser.Math.Distance.Between(
      this.combat.player.x,
      this.combat.player.y,
      target.x,
      target.y
    );
    const attacker = {
      id: this.combat.localPlayerId,
      pkFlag: this.combat.player.pkFlag === true,
      faction: this.combat.player.faction
    };
    const defender = {
      id: target.id,
      pkFlag: target.pkFlag === true,
      faction: target.faction
    };
    if (!canPvpAttack(attacker, defender, distance, PVP_ATTACK_RANGE, this.combat.pvpMode?.() || "flag")) {
      this.combat.endChannel(`${target.displayName || "Đối thủ"} ở ngoài tầm chiêu thức.`);
      return false;
    }

    playSkillImpactVfx(this.combat.scene, target.x, target.y, skill);
    this.combat.syncPosition();
    this.combat.scene.networkClient?.sendPlayerHit?.({ targetId: target.id, skill: skill.id });
    return true;
  }

  /**
   * Stop the active flurry and release movement.
   * @param {string} [message] log line shown when the channel ended early
   */
  endChannel(message) {
    if (!this.combat.channel) return;
    this.combat.channel = null;
    this.combat.player.stopMovement?.();
    if (message) this.combat.ui.addLog(message);
  }

  /**
   * Resolve a skill cast against another player. The peer's HP is server-owned, so
   * this only reports the roll; the returned `player_hp` (or a dodge refusal) drives
   * the floating damage number.
   * @param {Object} skill
   * @param {Object} target
   * @param {{log?: boolean, sync?: boolean}} [options]
   * @returns {boolean} whether the hit was reported to the server
   */
  applySkillToPlayer(skill, target, { log = true, sync = true } = {}) {
    const distance = Phaser.Math.Distance.Between(
      this.combat.player.x,
      this.combat.player.y,
      target.x,
      target.y
    );
    const attacker = {
      id: this.combat.localPlayerId,
      pkFlag: this.combat.player.pkFlag === true,
      faction: this.combat.player.faction
    };
    const defender = {
      id: target.id,
      pkFlag: target.pkFlag === true,
      faction: target.faction
    };
    if (!canPvpAttack(attacker, defender, distance, PVP_ATTACK_RANGE, this.combat.pvpMode?.() || "flag")) {
      if (log) {
        this.combat.ui.addLog(`${target.displayName || "Đối thủ"} ở ngoài tầm chiêu thức.`);
      }
      return false;
    }

    playTargetMarker(this.combat.scene, target.x, target.y, skill.vfx?.color);

    if (sync) this.combat.syncPosition();
    this.combat.scene.networkClient?.sendPlayerHit?.({ targetId: target.id, skill: skill.id });

    if (log) {
      this.combat.ui.addLog(
        `${translate(skill.nameKey, undefined, skill.id)} trúng ${target.displayName || "đối thủ"}!`
      );
    }
    return true;
  }

  /**
   * Explain a skill that found nothing when the reason is our own PK flag.
   * @param {Object} skill
   */
  hintPeacefulDuelist(skill) {
    const mode = this.combat.pvpMode?.() || "flag";
    if (mayDuel(this.combat.player, mode)) return;

    const peers = this.combat.scene.remotePlayerManager?.getAll?.() || [];
    const near = findNearestPvpTarget(
      this.combat.player,
      peers,
      PVP_CAST_DISTANCE,
      mode
    );
    if (!near) return;

    this.combat.ui.addLog(
      `${near.displayName || "Đối thủ"} đã bật cờ PK — hãy bật cờ PK của bạn để ${translate(
        skill.nameKey,
        undefined,
        skill.id
      )} gây sát thương.`
    );
  }

  /**
   * Centre of an AoE cast: the clicked target, the cursor point, or the hero.
   * @param {Object} skill
   * @param {Object|null} preferredTarget
   * @param {{x:number,y:number}|null} aimPoint
   * @returns {{x:number,y:number}}
   */
  resolveCastCenter(skill, preferredTarget = null, aimPoint = null) {
    const aimedAt = preferredTarget || aimPoint;
    if (!aimedAt) return { x: this.combat.player.x, y: this.combat.player.y };
    return clampToRange(this.combat.player, aimedAt, this.combat.skillReach(skill));
  }

  /**
   * Enemies this cast can hit.
   * @param {Object} skill
   * @param {{x:number,y:number}|null} [center] AoE centre
   * @returns {Object[]}
   */
  resolveTargets(skill, center = null) {
    const alive = this.combat.enemyManager.getAlive();

    if (skill.radius > 0) {
      const origin = center || { x: this.combat.player.x, y: this.combat.player.y };
      const radiusSq = skill.radius * skill.radius;
      const targets = [];
      for (const wolf of alive) {
        const dx = wolf.x - origin.x;
        const dy = wolf.y - origin.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= radiusSq) {
          targets.push({ wolf, distSq });
        }
      }
      targets.sort((a, b) => a.distSq - b.distSq);
      return targets.map((t) => t.wolf);
    }

    const px = this.combat.player.x;
    const py = this.combat.player.y;
    const range = this.combat.skillReach(skill);
    const rangeSq = range * range;
    let nearest = null;
    let minSq = rangeSq;

    for (const wolf of alive) {
      const dx = wolf.x - px;
      const dy = wolf.y - py;
      const distSq = dx * dx + dy * dy;
      if (distSq <= minSq) {
        minSq = distSq;
        nearest = wolf;
      }
    }

    return nearest ? [nearest] : [];
  }

  /**
   * Flagged players inside a cast's area.
   * @param {Object} skill
   * @param {{x:number,y:number}|null} [center] AoE centre
   * @returns {Object[]}
   */
  resolvePeerTargets(skill, center = null) {
    const mode = this.combat.pvpMode?.() || "flag";
    if (!mayDuel(this.combat.player, mode)) return [];

    const peers = this.combat.scene.remotePlayerManager?.getAll?.() || [];
    const origin = center || { x: this.combat.player.x, y: this.combat.player.y };
    const distanceToCenter = (peer) =>
      Phaser.Math.Distance.Between(origin.x, origin.y, peer.x, peer.y);
    const legal = (peer) =>
      this.combat.isDuelTarget?.(peer) ?? peer?.pkFlag === true;
    return peers
      .filter(
        (peer) => isPeerTarget(peer) && legal(peer) && peer.container?.active !== false
      )
      .filter((peer) => distanceToCenter(peer) <= skill.radius)
      .sort((a, b) => distanceToCenter(a) - distanceToCenter(b));
  }

  /**
   * Turn the hero toward the primary target.
   * @param {Object|null} target
   */
  aimAt(target) {
    if (!target) return;
    const from = toIso(this.combat.player.x, this.combat.player.y);
    const to = toIso(target.x, target.y);
    const direction = directionFromVelocity(to.x - from.x, to.y - from.y);
    this.combat.player.faceDirection?.(direction);
  }

  /**
   * Apply a skill's timed effects to the caster (buff, heal).
   * @param {Object} skill
   * @param {number} now
   */
  applySelfEffects(skill, now) {
    const overheadSprite = skill.vfx?.type === "overhead" ? skill.vfx.overhead : null;
    this.combat.buffs.push(...selfBuffEntries(skill, now));

    if (skill.vfx?.type === "formation" && skill.vfx?.sprite) {
      if (typeof skill.vfx.scale === "number") {
        this.combat.player.showFormation?.(skill.vfx.sprite, skill.vfx.scale);
      } else {
        this.combat.player.showFormation?.(skill.vfx.sprite);
      }
    }
    if (overheadSprite) {
      this.combat.player.showOverhead?.(
        overheadSprite,
        skill.vfx.overheadScale,
        skill.vfx.overheadOffsetY
      );
    }
  }

  /**
   * Filter expired buffs and update active formation aura / overhead seal.
   * @param {number} now
   */
  updateBuffs(now) {
    if (this.combat.buffs.length === 0) return;

    let hasExpired = false;
    for (let i = 0; i < this.combat.buffs.length; i++) {
      if (this.combat.buffs[i].until <= now) {
        hasExpired = true;
        break;
      }
    }
    if (!hasExpired) return;

    this.combat.buffs = this.combat.buffs.filter((buff) => buff.until > now);
    const activeFormation = this.combat.buffs.find((buff) => buff.formationSprite);
    if (activeFormation) {
      if (typeof activeFormation.formationScale === "number") {
        this.combat.player.showFormation?.(
          activeFormation.formationSprite,
          activeFormation.formationScale
        );
      } else {
        this.combat.player.showFormation?.(activeFormation.formationSprite);
      }
    } else {
      this.combat.player.hideFormation?.();
    }

    const activeOverhead = this.combat.buffs.find((buff) => buff.overheadSprite);
    if (activeOverhead) {
      this.combat.player.showOverhead?.(
        activeOverhead.overheadSprite,
        activeOverhead.overheadScale,
        activeOverhead.overheadOffsetY
      );
    } else {
      this.combat.player.hideOverhead?.();
    }
  }

  /** Clear all active buffs and hide any buff formation rings or overhead seals. */
  clearBuffs() {
    this.combat.buffs = [];
    this.combat.player.hideFormation?.();
    this.combat.player.hideOverhead?.();
  }
}
