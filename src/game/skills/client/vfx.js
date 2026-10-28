/**
 * Skill VFX.
 *
 * A skill's `vfx` config either names a small reusable vector primitive or a
 * preloaded sprite-sheet texture (`vfx.sprite`). Vector effects are tweened and
 * destroyed; sprite effects play once and destroy themselves on completion, so
 * nothing is kept alive between casts.
 */

import { clampToRange } from "../../aim.js";
import { splashRadius } from "../../combatRules.js";
import { toIso, isoDepth } from "../../isoProjection.js";
import { directionVector } from "../../heroDirections.js";
import { ensureVfxTexture } from "../../lazyAssets.js";

const DEPTH_BONUS = 12;

/**
 * Convert a world position to screen space plus a depth value.
 * @param {number} x
 * @param {number} y
 */
const baseAt = (x, y) => ({ ...toIso(x, y), depth: isoDepth(x, y) });

/**
 * Distance along one axis until the direction hits the given bounds.
 * @param {number} origin
 * @param {number} direction
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function axisEdgeDistance(origin, direction, min, max) {
  if (direction > 1e-6) return (max - origin) / direction;
  if (direction < -1e-6) return (min - origin) / direction;
  return Infinity;
}

/**
 * Distance from the player to the edge of their camera in the facing direction.
 * @param {Phaser.Scene} scene
 * @param {{x:number,y:number}} player
 * @param {{x:number,y:number}} direction unit vector
 * @param {number} maxDistance catalog range cap
 * @returns {number}
 */
function cameraEdgeDistance(scene, player, direction, maxDistance) {
  const camera = scene.cameras?.main;
  if (!camera) return maxDistance;

  const view = camera.worldView;
  if (view && view.width > 0 && Number.isFinite(view.right) && Number.isFinite(view.bottom)) {
    const horizontal = axisEdgeDistance(player.x, direction.x, view.left, view.right);
    const vertical = axisEdgeDistance(player.y, direction.y, view.top, view.bottom);
    return Math.max(0, Math.min(maxDistance, horizontal, vertical));
  }

  const zoom = camera.zoom || 1;
  const halfWidth = (camera.width || 0) / (2 * zoom);
  const halfHeight = (camera.height || 0) / (2 * zoom);
  if (!halfWidth || !halfHeight) return maxDistance;
  const horizontal = Math.abs(direction.x) > 1e-6 ? halfWidth / Math.abs(direction.x) : Infinity;
  const vertical = Math.abs(direction.y) > 1e-6 ? halfHeight / Math.abs(direction.y) : Infinity;
  return Math.min(maxDistance, horizontal, vertical);
}

/**
 * Where a cast should land: the target, the aimed point, or the camera edge in
 * the facing direction when neither is supplied.
 * @param {Phaser.Scene} scene
 * @param {{x:number,y:number,facingDirection:number}} player
 * @param {{x:number,y:number}|null} target
 * @param {{x:number,y:number}|null} aimPoint
 * @param {number} maxRange
 * @returns {{x:number,y:number}}
 */
function resolveAimPoint(scene, player, target, aimPoint, maxRange) {
  const aimedAt = target || aimPoint;
  const aimDistance = aimedAt ? Math.hypot(aimedAt.x - player.x, aimedAt.y - player.y) : 0;
  if (aimedAt && aimDistance > 1) return clampToRange(player, aimedAt, maxRange);

  const direction = directionVector(player.facingDirection);
  const distance = cameraEdgeDistance(scene, player, direction, maxRange);
  return {
    x: player.x + direction.x * distance,
    y: player.y + direction.y * distance
  };
}

/**
 * Play a slam sheet: the first frames are the cast gesture at the hero, then the
 * remaining frames drop from above onto the strike area and fade on impact.
 * @param {Phaser.Scene} scene
 * @param {Object} skill
 * @param {import("../../player.js").Player} player
 * @param {Object|null} target
 * @param {{x:number,y:number}|null} aimPoint
 * @param {{key:string,frameCount:number,start:Object,scale:number,size:number}} art
 * @returns {boolean} true when the sprite actually played
 */
function playSlamSpriteVfx(scene, skill, player, target, aimPoint, art) {
  const { key, frameCount, start, scale, size } = art;
  const castFrameCount = Math.min(2, frameCount);
  const impactStart = castFrameCount;
  const impactEnd = frameCount - 1;
  if (castFrameCount < 1 || impactStart > impactEnd) return false;

  const fps = Number(skill.vfx?.fps) || 12;
  const castKey = `${key}-slam-cast`;
  if (!scene.anims.exists(castKey)) {
    const frames = scene.anims.generateFrameNumbers(key, { start: 0, end: castFrameCount - 1 });
    if (!frames.length) return false;
    scene.anims.create({ key: castKey, frames, frameRate: fps, repeat: 0 });
  }

  // The cast gesture is intentionally small; only the descending/landing frames
  // grow into the full-size palm.
  const castScale = scale * (Number(skill.vfx?.castScale) || 0.4);
  const castSprite = scene.add
    .sprite(start.x, start.y - 26, key)
    .setOrigin(0.5, 0.62)
    .setDepth(start.depth + DEPTH_BONUS)
    .setScale(castScale);
  castSprite.play(castKey);
  castSprite.once("animationcomplete", () => castSprite.destroy());

  const maxRange = Number(skill.range) || Number(skill.radius) || 90;
  const aimedAt = target || aimPoint;
  // A slam with nothing to aim at lands on the hero (its AoE centre) instead of
  // flying to the camera edge like a projectile.
  const aim = aimedAt && Math.hypot(aimedAt.x - player.x, aimedAt.y - player.y) > 1
    ? resolveAimPoint(scene, player, target, aimPoint, maxRange)
    : { x: player.x, y: player.y };
  const end = baseAt(aim.x, aim.y);
  const dropHeight = Number(skill.vfx?.dropHeight) || Math.max(140, size * 0.8);
  const dropDuration = Number(skill.vfx?.dropDuration) || 280;
  // The landing frame blooms wider than the falling one so the ground impact
  // visually covers the AoE it resolves.
  const impactScale = Number(skill.vfx?.impactScale) || 1.5;

  const spawnImpact = () => {
    const impact = scene.add
      .sprite(end.x, end.y - 26 - dropHeight, key)
      // Anchor near the bottom so the landing art's dust/fingertips sit on the
      // strike point instead of sinking half the enlarged palm below it.
      .setOrigin(0.5, 0.9)
      .setDepth(end.depth + DEPTH_BONUS + 1)
      .setScale(scale)
      .setFrame(impactStart);

    scene.tweens.add({
      targets: impact,
      y: end.y - 26,
      duration: dropDuration,
      ease: "Quad.easeIn",
      onComplete: () => {
        impact.setFrame(impactEnd);
        impact.setScale(scale * impactScale * 0.85);
        scene.tweens.add({
          targets: impact,
          scale: scale * impactScale,
          duration: 140,
          ease: "Quad.easeOut"
        });
        scene.tweens.add({
          targets: impact,
          alpha: 0,
          delay: 140,
          duration: 240,
          onComplete: () => impact.destroy()
        });
      }
    });
  };

  // Let the cast gesture read before the palm descends.
  if (typeof scene.time?.delayedCall === "function") {
    scene.time.delayedCall((castFrameCount / fps) * 1000, spawnImpact);
  } else {
    spawnImpact();
  }
  return true;
}

/**
 * Play a catalog skill's sprite-sheet animation. Travelling sheets fly from the
 * caster toward the target (or the aimed point, or the camera edge when there is
 * neither); `type: "slam"` sheets cast in place and then drop onto that point.
 * @param {Phaser.Scene} scene
 * @param {Object} skill
 * @param {import("../../player.js").Player} player
 * @param {Object|null} target
 * @param {{x:number,y:number}|null} [aimPoint]
 * @returns {boolean} true when the sprite actually played
 */
function playSpriteCastVfx(scene, skill, player, target, aimPoint = null) {
  const key = skill.vfx?.sprite;
  if (!key || !scene.textures.exists(key)) return false;

  const texture = scene.textures.get(key);
  const firstFrame = texture.get(0);
  if (!firstFrame) return false;

  const frameCount = Math.max(1, (texture.frameTotal || 1) - 1);
  const start = baseAt(player.x, player.y);
  const frameWidth = firstFrame.width || firstFrame.cutWidth || 256;
  const visualRadius = Number(skill.vfx?.size) || Number(skill.radius) || 90;
  const size = Math.max(120, visualRadius * 1.8) * (Number(skill.vfx?.scale) || 1);
  const scale = size / frameWidth;

  // Slam skills play the first two frames as the cast gesture, then drop the
  // remaining frames from above onto the strike area (e.g. Như Lai Thần Chưởng).
  if (skill.vfx?.type === "slam") {
    return playSlamSpriteVfx(scene, skill, player, target, aimPoint, {
      key,
      frameCount,
      start,
      scale,
      size
    });
  }

  const isStationary =
    skill.vfx?.type === "stationary" ||
    (skill.target === "self" && skill.vfx?.type !== "formation");
  if (isStationary) {
    const playKey = `${key}-play`;
    if (!scene.anims.exists(playKey)) {
      const frames = scene.anims.generateFrameNumbers(key, { start: 0, end: frameCount - 1 });
      if (!frames.length) return false;
      scene.anims.create({
        key: playKey,
        frames,
        frameRate: Number(skill.vfx?.fps) || 8,
        repeat: 0
      });
    }

    const sprite = scene.add
      .sprite(start.x, start.y, key)
      .setOrigin(0.5, 0.9)
      .setDepth(start.depth + DEPTH_BONUS - 1)
      .setScale(scale);

    sprite.play(playKey);
    sprite.once("animationcomplete", () => sprite.destroy());
    return true;
  }

  const travelFrameCount = Math.min(2, frameCount);
  const impactFrameCount = frameCount - travelFrameCount;
  const travelKey = `${key}-travel`;
  const impactKey = `${key}-impact`;

  if (!scene.anims.exists(travelKey)) {
    const frames = scene.anims.generateFrameNumbers(key, { start: 0, end: travelFrameCount - 1 });
    if (!frames.length) return false;
    scene.anims.create({
      key: travelKey,
      frames,
      frameRate: 8,
      repeat: -1,
      yoyo: travelFrameCount > 1
    });
  }
  if (impactFrameCount > 0 && !scene.anims.exists(impactKey)) {
    const frames = scene.anims.generateFrameNumbers(key, {
      start: travelFrameCount,
      end: frameCount - 1
    });
    if (!frames.length) return false;
    scene.anims.create({
      key: impactKey,
      frames,
      frameRate: Number(skill.vfx?.fps) || 12,
      repeat: 0
    });
  }

  const maxRange = Number(skill.range) || Number(skill.radius) || 90;
  const aim = resolveAimPoint(scene, player, target, aimPoint, maxRange);
  const end = baseAt(aim.x, aim.y);
  const worldDistance = Math.hypot(aim.x - player.x, aim.y - player.y);
  const travelDuration = Math.max(220, Math.min(1200, worldDistance / 3));

  // Visual size is independent of travel range: a long-range strike must not
  // render a giant palm. `vfx.size` overrides the radius-derived default.
  const sprite = scene.add
    .sprite(start.x, start.y - 26, key)
    .setOrigin(0.5, 0.62)
    .setDepth(Math.max(start.depth, end.depth) + DEPTH_BONUS)
    .setScale(size / frameWidth);

  scene.tweens.add({
    targets: sprite,
    x: end.x,
    y: end.y - 26,
    duration: travelDuration,
    ease: "Quad.easeOut",
    onComplete: () => {
      if (impactFrameCount <= 0) {
        sprite.destroy();
        return;
      }
      sprite.play(impactKey);
      sprite.once("animationcomplete", () => sprite.destroy());
    }
  });
  sprite.play(travelKey);
  return true;
}

/**
 * Arrival blast: white-hot core flash, double crossed sword-qi slashes,
 * an inner shockwave, an expanding ring matching splash radius, and high-velocity
 * radial qi shards. Every piece is one-shot and removes itself when its tween ends.
 * @param {Phaser.Scene} scene
 * @param {Object} skill
 * @param {number} x screen X of the impact
 * @param {number} y screen Y of the impact
 * @param {number} depth
 */
function playSwordQiBlast(scene, skill, x, y, depth) {
  const color = skill.vfx?.color || 0x9be8ff;
  // Ground distance maps 1:1 to screen distance, so the splash radius is also the
  // on-screen radius: the ring ends exactly where the server stops hitting.
  const blastRadius = splashRadius(skill) || 90;

  // Fade helper: every piece is one-shot and removes itself when the tween ends.
  const spray = (config) => {
    scene.tweens.add({ ...config, onComplete: () => config.targets.destroy() });
  };

  // 1. White-hot Core Flash
  const core = scene.add.circle(x, y, 12, 0xffffff, 0.95).setDepth(depth + 3);
  spray({ targets: core, scale: 2.8, alpha: 0, duration: 160, ease: "Quad.easeOut" });

  // 2. High-energy Inner Shockwave Ring
  const innerRing = scene.add
    .circle(x, y, Math.round(blastRadius * 0.45), 0xdcf6ff, 0)
    .setStrokeStyle(4, 0xffffff, 0.95)
    .setScale(0.2)
    .setDepth(depth + 2);
  spray({ targets: innerRing, scale: 1.1, alpha: 0, duration: 240, ease: "Quad.easeOut" });

  // 3. Double Crossed Sword-Qi Slashes
  const slashPoints = [40, 0, 0, -4, -40, 0, 0, 4];
  const slashAngles = [Math.PI / 4, -Math.PI / 4];
  for (const slashAngle of slashAngles) {
    const slash = scene.add
      .polygon(x, y, slashPoints, 0xffffff, 0.9)
      .setStrokeStyle(2, color, 0.95)
      .setRotation(slashAngle)
      .setScale(0.3)
      .setDepth(depth + 2);
    spray({
      targets: slash,
      scaleX: 1.6,
      scaleY: 0.35,
      alpha: 0,
      duration: 220,
      ease: "Quad.easeOut"
    });
  }

  // 4. Splash Radius Ring: starts small and blooms out to the full splash radius.
  const ring = scene.add
    .circle(x, y, blastRadius, color, 0)
    .setStrokeStyle(3, color, 0.9)
    .setScale(0.25)
    .setDepth(depth);
  spray({ targets: ring, scale: 1, alpha: 0, duration: 380, ease: "Cubic.easeOut" });

  // 5. Radial Sword-Qi Shards: 8 sharp energy shards fanning out in 360 degrees
  const shardCount = 8;
  const shardReach = blastRadius * 0.72;
  for (let index = 0; index < shardCount; index += 1) {
    const angle = (Math.PI * 2 * index) / shardCount - Math.PI / 2;
    const shard = scene.add
      .circle(x, y, 4, color, 0.95)
      .setStrokeStyle(1.5, 0xffffff, 0.9)
      .setDepth(depth + 1);
    spray({
      targets: shard,
      x: x + Math.cos(angle) * shardReach,
      y: y + Math.sin(angle) * shardReach,
      scale: 0.15,
      alpha: 0,
      duration: 320,
      ease: "Quad.easeOut"
    });
  }
}

/**
 * Sword-qi projectile: a multi-layered, razor-sharp crescent blade of energy leaves
 * the hero, flies to the aimed point and explodes into a slash blast.
 * Vector-drawn so a long reach (Kiếm Khí) reads as a thrown martial art with
 * intense speed, luminescence, and trail wake instead of a melee slash.
 * @param {Phaser.Scene} scene
 * @param {Object} skill
 * @param {import("../../player.js").Player} player
 * @param {Object|null} target
 * @param {{x:number,y:number}|null} aimPoint
 */
function playSwordQiProjectileVfx(scene, skill, player, target, aimPoint) {
  // Same fallback chain as the sprite cast path: a projectile with no reach still
  // needs a distance to fly.
  const maxRange = Number(skill.range) || Number(skill.radius) || 90;
  const aim = resolveAimPoint(scene, player, target, aimPoint, maxRange);
  const start = baseAt(player.x, player.y);
  const end = baseAt(aim.x, aim.y);
  const color = skill.vfx?.color || 0x9be8ff;
  const scale = Number(skill.vfx?.scale) || 1;

  // The flight is drawn on the ground plane, so the shard rides a little above
  // the feet and is turned to the screen-space angle of the throw.
  const lift = 24;
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const depth = Math.max(start.depth, end.depth) + DEPTH_BONUS;
  const y0 = start.y - lift;
  const x0 = start.x;

  // 1. Outer Translucent Qi Aura
  const auraPoints = [
    56, 0,
    26, -13,
    -2, -15,
    -26, -11,
    -48, -5,
    -34, 0,
    -48, 5,
    -26, 11,
    -2, 15,
    26, 13
  ];
  const aura = scene.add
    .polygon(x0, y0, auraPoints, color, 0.28)
    .setRotation(angle)
    .setScale(scale)
    .setDepth(depth - 1);

  // 2. Main Qi Blade: Aerodynamic razor crescent blade with barbed tail
  const bladePoints = [
    50, 0,
    22, -9,
    -2, -11,
    -24, -8,
    -42, -4,
    -30, 0,
    -42, 4,
    -24, 8,
    -2, 11,
    22, 9
  ];
  const blade = scene.add
    .polygon(x0, y0, bladePoints, color, 0.92)
    .setStrokeStyle(1.5, 0xdcf6ff, 0.95)
    .setRotation(angle)
    .setScale(scale)
    .setDepth(depth);

  // 3. Core Energy Spine: Slender white-hot spine along the center of the blade
  const coreSpinePoints = [
    42, 0,
    16, -3,
    -12, -2.5,
    -26, 0,
    -12, 2.5,
    16, 3
  ];
  const coreSpine = scene.add
    .polygon(x0, y0, coreSpinePoints, 0xffffff, 0.95)
    .setRotation(angle)
    .setScale(scale)
    .setDepth(depth + 1);

  // 4. Energy Glows: Inner white core and soft cyan halo
  const glow = scene.add
    .circle(x0, y0, 14 * scale, color, 0.3)
    .setDepth(depth - 1);
  const coreGlow = scene.add
    .circle(x0, y0, 7 * scale, 0xffffff, 0.5)
    .setDepth(depth);

  const worldDistance = Math.hypot(aim.x - player.x, aim.y - player.y);
  // 1.8 px/ms keeps every throw readable; the cap only bounds absurd reaches, so
  // it sits just above the longest shoot (Kiếm Khí's 1000 px ≈ 556 ms) instead
  // of compressing a long-range shard into a snap across the screen.
  const travelDuration = Math.max(160, Math.min(620, worldDistance / 1.8));
  const flying = [blade, aura, coreSpine, glow, coreGlow];

  scene.tweens.add({
    targets: flying,
    x: end.x,
    y: end.y - lift,
    duration: travelDuration,
    ease: "Quad.easeIn",
    onComplete: () => {
      for (const piece of flying) piece.destroy();
      playSwordQiBlast(scene, skill, end.x, end.y - lift, depth);
    }
  });
}

/**
 * Cast animation played at the hero's feet.
 *
 * Works for any caster that exposes `x`, `y` and `facingDirection` — the local
 * hero and a remote peer alike — so both sides render identical art.
 * @param {Phaser.Scene} scene
 * @param {{x:number,y:number,facingDirection?:number}} player
 * @param {Object} skill
 * @param {{x:number,y:number}|null} [target]
 * @param {{x:number,y:number}|null} [aimPoint]
 */
export function playSkillCastVfx(scene, player, skill, target = null, aimPoint = null) {
  if (!scene || !player || !skill?.vfx) return;
  // Sprite VFX sheets download on first use; a not-yet-ready sheet simply skips
  // its visual for this cast instead of blocking the skill.
  ensureVfxTexture(scene, skill.vfx.sprite);
  const p = baseAt(player.x, player.y);
  const color = skill.vfx.color || 0xffd166;
  // Facing decides which way an unaimed gesture points. Direction 2 (screen
  // right) is the default used by every hero rig. Read it from the shared
  // facing index rather than the rig scale, which never flips.
  const facingRight = directionVector(player.facingDirection ?? 2).x >= 0;
  const cast = skill.vfx.cast;
  const aimedAt = target || aimPoint;
  const targetPoint = aimedAt ? toIso(aimedAt.x, aimedAt.y) : null;
  const angle = targetPoint ? Math.atan2(targetPoint.y - p.y, targetPoint.x - p.x) : null;
  const degrees = angle === null ? (facingRight ? 0 : 180) : (angle * 180) / Math.PI;
  const offsetX = angle === null ? (facingRight ? 16 : -16) : Math.cos(angle) * 26;
  const offsetY = angle === null ? 0 : Math.sin(angle) * 26;

  if (skill.vfx.type !== "formation" && skill.vfx.sprite && playSpriteCastVfx(scene, skill, player, target, aimPoint)) {
    return;
  }

  // Baseline pulse so every cast is visibly telegraphed, whatever its type.
  const pulse = scene.add
    .circle(p.x, p.y - 6, 18, color, 0.25)
    .setStrokeStyle(3, color, 0.9)
    .setDepth(p.depth + DEPTH_BONUS - 1);
  scene.tweens.add({
    targets: pulse,
    scale: 2.2,
    alpha: 0,
    duration: 300,
    onComplete: () => pulse.destroy()
  });

  // A thrown art owns its own flight and impact, so it replaces the gesture arc.
  // Keyed on the concrete projectile kind: an unknown kind falls through to the
  // regular cast branches instead of silently drawing a sword.
  if (skill.vfx.projectile === "sword") {
    playSwordQiProjectileVfx(scene, skill, player, target, aimPoint);
    return;
  }

  if (cast === "slash") {
    const arc = scene.add
      .arc(p.x + offsetX * 0.6, p.y - 7 + offsetY * 0.4, 34, degrees - 70, degrees + 70, false, color, 0.85)
      .setStrokeStyle(5, 0xfff2cf, 0.95)
      .setDepth(p.depth + DEPTH_BONUS);
    scene.tweens.add({ targets: arc, alpha: 0, scale: 1.4, duration: 190, onComplete: () => arc.destroy() });
    return;
  }

  if (cast === "kick") {
    const streak = scene.add
      .rectangle(p.x + offsetX, p.y - 4 + offsetY, 38, 6, color, 0.8)
      .setDepth(p.depth + DEPTH_BONUS);
    if (angle !== null) streak.setRotation(angle);
    else streak.setAngle(facingRight ? -12 : 12);
    scene.tweens.add({ targets: streak, alpha: 0, scaleX: 1.5, duration: 200, onComplete: () => streak.destroy() });
    return;
  }

  if (cast === "shockwave") {
    const ring = scene.add
      .circle(p.x, p.y - 2, 20, color, 0.18)
      .setStrokeStyle(4, color, 0.9)
      .setDepth(p.depth + DEPTH_BONUS - 2);
    scene.tweens.add({ targets: ring, scale: 3.4, alpha: 0, duration: 320, onComplete: () => ring.destroy() });
    return;
  }

  if (cast === "aura") {
    const aura = scene.add
      .circle(p.x, p.y - 24, 26, color, 0.14)
      .setStrokeStyle(3, color, 0.85)
      .setDepth(p.depth + DEPTH_BONUS - 2);
    scene.tweens.add({
      targets: aura,
      scale: 1.5,
      y: aura.y - 14,
      alpha: 0,
      duration: 520,
      onComplete: () => aura.destroy()
    });
  }
}

/**
 * Impact animation played where the hit lands.
 * @param {Phaser.Scene} scene
 * @param {number} x world X
 * @param {number} y world Y
 * @param {Object} skill
 */
export function playSkillImpactVfx(scene, x, y, skill) {
  if (!scene || !skill?.vfx || !skill.vfx.impact) return;
  const p = baseAt(x, y);
  const color = skill.vfx.color || 0xffd166;

  if (skill.vfx.impact === "spark" || skill.vfx.impact === "burst") {
    const big = skill.vfx.impact === "burst";
    const ring = scene.add
      .circle(p.x, p.y - 14, big ? 18 : 12, color, 0.3)
      .setStrokeStyle(big ? 5 : 3, 0xfff6df, 0.95)
      .setDepth(p.depth + DEPTH_BONUS);
    scene.tweens.add({
      targets: ring,
      scale: big ? 2.6 : 1.8,
      alpha: 0,
      duration: big ? 300 : 200,
      onComplete: () => ring.destroy()
    });
    return;
  }

  if (skill.vfx.impact === "dust") {
    const dust = scene.add.ellipse(p.x, p.y, 26, 10, 0xc4b998, 0.5).setDepth(p.depth + DEPTH_BONUS - 1);
    scene.tweens.add({ targets: dust, scaleX: 1.8, scaleY: 1.4, alpha: 0, duration: 260, onComplete: () => dust.destroy() });
  }
}

/**
 * Show the area a cast will cover, so the player can see who is in range.
 * @param {Phaser.Scene} scene
 * @param {number} x world X
 * @param {number} y world Y
 * @param {number} radius world radius
 * @param {number} [color]
 */
export function playRangeIndicator(scene, x, y, radius, color = 0xffd166) {
  if (!scene) return;
  const p = baseAt(x, y);
  // Ground circles render as 2:1 diamonds in this projection, so draw an ellipse
  // whose width equals the world radius and whose height is half of it.
  const ring = scene.add
    .ellipse(p.x, p.y, radius, radius * 0.5, color, 0.08)
    .setStrokeStyle(2, color, 0.55)
    .setDepth(p.depth - 1);
  scene.tweens.add({
    targets: ring,
    alpha: 0,
    duration: 380,
    onComplete: () => ring.destroy()
  });
}

/**
 * Flash a marker under a target that is about to be hit.
 * @param {Phaser.Scene} scene
 * @param {number} x world X
 * @param {number} y world Y
 * @param {number} [color]
 */
export function playTargetMarker(scene, x, y, color = 0xffd166) {
  if (!scene) return;
  const p = baseAt(x, y);
  const ring = scene.add
    .circle(p.x, p.y, 16, color, 0.18)
    .setStrokeStyle(3, color, 0.95)
    .setDepth(p.depth + DEPTH_BONUS);
  scene.tweens.add({
    targets: ring,
    scale: 1.7,
    alpha: 0,
    duration: 260,
    onComplete: () => ring.destroy()
  });
}
