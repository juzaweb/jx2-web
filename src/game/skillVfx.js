/**
 * Skill VFX.
 *
 * A skill's `vfx` config either names a small reusable vector primitive or a
 * preloaded sprite-sheet texture (`vfx.sprite`). Vector effects are tweened and
 * destroyed; sprite effects play once and destroy themselves on completion, so
 * nothing is kept alive between casts.
 */

import { toIso, isoDepth } from "./isoProjection.js";
import { directionVector } from "./heroDirections.js";

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
 * Play a catalog skill's sprite-sheet animation as a projectile that travels
 * from the caster toward the target (or to the camera edge when there is none).
 * @param {Phaser.Scene} scene
 * @param {Object} skill
 * @param {import("./player.js").Player} player
 * @param {Object|null} target
 * @returns {boolean} true when the sprite actually played
 */
function playSpriteCastVfx(scene, skill, player, target) {
  const key = skill.vfx?.sprite;
  if (!key || !scene.textures.exists(key)) return false;

  const texture = scene.textures.get(key);
  const firstFrame = texture.get(0);
  if (!firstFrame) return false;

  const frameCount = Math.max(1, (texture.frameTotal || 1) - 1);
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
  const start = baseAt(player.x, player.y);
  const aim = target
    ? { x: target.x, y: target.y }
    : (() => {
        const direction = directionVector(player.facingDirection);
        const distance = cameraEdgeDistance(scene, player, direction, maxRange);
        return {
          x: player.x + direction.x * distance,
          y: player.y + direction.y * distance
        };
      })();
  const end = baseAt(aim.x, aim.y);
  const worldDistance = Math.hypot(aim.x - player.x, aim.y - player.y);
  const travelDuration = Math.max(220, Math.min(1200, worldDistance / 3));

  // Visual size is independent of travel range: a long-range strike must not
  // render a giant palm. `vfx.size` overrides the radius-derived default.
  const visualRadius = Number(skill.vfx?.size) || Number(skill.radius) || 90;
  const size = Math.max(120, visualRadius * 1.8) * (Number(skill.vfx?.scale) || 1);
  const frameWidth = firstFrame.width || firstFrame.cutWidth || 256;
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
 * Cast animation played at the hero's feet.
 * @param {Phaser.Scene} scene
 * @param {import("./player.js").Player} player
 * @param {Object} skill
 */
export function playSkillCastVfx(scene, player, skill, target = null) {
  if (!scene || !player?.sprite || !skill?.vfx) return;
  const p = baseAt(player.x, player.y);
  const color = skill.vfx.color || 0xffd166;
  const facingRight = player.visual?.scaleX >= 0;
  const cast = skill.vfx.cast;
  const targetPoint = target ? toIso(target.x, target.y) : null;
  const angle = targetPoint ? Math.atan2(targetPoint.y - p.y, targetPoint.x - p.x) : null;
  const degrees = angle === null ? (facingRight ? 0 : 180) : (angle * 180) / Math.PI;
  const offsetX = angle === null ? (facingRight ? 16 : -16) : Math.cos(angle) * 26;
  const offsetY = angle === null ? 0 : Math.sin(angle) * 26;

  if (skill.vfx.sprite && playSpriteCastVfx(scene, skill, player, target)) return;

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
