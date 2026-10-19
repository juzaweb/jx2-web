import { buildHero, poseFor, limbPivots } from "./heroRig.js";
import { normalizeGender } from "./gender.js";
import { EQUIPMENT_SLOT_KEYS } from "./equipment.js";

/** Distance from the rig container origin down to the character's feet (ground). */
export const HERO_FOOT_Y = 41;

/** Peak leg swing (radians) around the hip at a full side-on view. */
const LEG_ANGLE = 0.42;
/** Peak arm swing (radians) around the shoulder. */
const ARM_ANGLE = 0.4;
/** Arms keep a little swing head-on, where the swing axis points at the camera. */
const ARM_DEPTH_FLOOR = 0.35;
/** Foot lift (rig units) for the stepping leg, mostly for head-on views. */
const STEP_LIFT = 4;

/**
 * Phaser adapter for the vector hero rig (see heroRig.js).
 *
 * Builds the rig's primitives into a container of Phaser shapes and rebuilds it
 * only when the direction or equipped slots change. Walking is then applied each
 * frame by pivoting the tagged limb groups (`animate`), so per-frame motion
 * costs a handful of position writes instead of a rebuild.
 *
 * Rig space has its origin at the character's feet, so the container sits at
 * {@link HERO_FOOT_Y} — the same ground offset the shadow uses.
 */
export class HeroRigView {
  /**
   * @param {Phaser.Scene} scene
   * @param {{ footOffsetY?: number }} [opts]
   */
  constructor(scene, { footOffsetY = HERO_FOOT_Y } = {}) {
    this.scene = scene;
    this.container = scene.add.container(0, footOffsetY);
    this.key = null;
    this.gender = "male";
    this.pose = poseFor(0);
    /** group name -> [{ obj, baseX, baseY }] */
    this.groups = {};
    /** While an attack pose is playing, the walk cycle must not overwrite it. */
    this.acting = false;
    this.actionTween = null;
  }

  /**
   * Show the hero facing `direction` wearing `equipment`. Rebuilds only on
   * change. Equipment is the slot -> item map used by the game (falsy = empty).
   * @param {number} direction
   * @param {Record<string, string|null|undefined>} [equipment]
   * @param {"male"|"female"} [gender]
   */
  set(direction, equipment = {}, gender = "male") {
    const g = normalizeGender(gender);
    const key = `${g}|${direction}|${slotSignature(equipment)}`;
    if (key === this.key) return;
    this.key = key;
    this.gender = g;
    this.pose = poseFor(direction);
    this.actionTween?.stop();
    this.actionTween = null;
    this.acting = false;

    this.container.removeAll(true);
    this.groups = {};
    for (const primitive of buildHero({ direction, equipment, gender: g })) {
      const child = createPrimitive(this.scene, primitive);
      if (!child) continue;
      this.container.add(child);
      if (primitive.group) {
        (this.groups[primitive.group] ??= []).push({
          obj: child,
          baseX: child.x,
          baseY: child.y
        });
      }
    }
  }

  /**
   * Apply the walk cycle for a phase (radians). Limbs pivot around their joints
   * (hip / shoulder); the swing flattens out head-on, where the legs instead step
   * in place. Arms counter-swing. Pass 0 to return to the neutral pose.
   * @param {number} phase
   */
  animate(phase) {
    if (this.acting) return;
    const swing = Math.sin(phase);
    const { depth } = this.pose;
    const pivots = limbPivots(this.pose, this.gender);

    const legAngle = swing * LEG_ANGLE * depth;
    const armAngle = swing * ARM_ANGLE * Math.max(depth, ARM_DEPTH_FLOOR);
    const step = (1 - depth) * STEP_LIFT;

    this.pivot("legR", legAngle, pivots.legR, 0, -Math.max(0, swing) * step);
    this.pivot("legL", -legAngle, pivots.legL, 0, -Math.max(0, -swing) * step);
    this.pivot("armR", -armAngle, pivots.armR);
    this.pivot("armL", armAngle, pivots.armL);
  }

  /**
   * Play a short melee action pose derived from a skill's VFX type.
   * @param {"slash"|"kick"|"shockwave"|"aura"|string} kind
   */
  attack(kind = "slash") {
    const pose = {
      slash: "punch",
      kick: "kick",
      shockwave: "palm",
      aura: "channel"
    }[kind] || "punch";

    this.actionTween?.stop();
    this.acting = true;
    const counter = { t: 0 };
    this.actionTween = this.scene.tweens.add({
      targets: counter,
      t: 1,
      duration: pose === "kick" ? 130 : 110,
      yoyo: true,
      ease: "Quad.easeOut",
      onUpdate: () => this.applyActionPose(pose, counter.t),
      onComplete: () => {
        this.actionTween = null;
        this.acting = false;
        this.applyActionPose(pose, 0);
      }
    });
  }

  /**
   * Pose the limbs for an action at progress `t` (0 idle, 1 full extension).
   * @param {"punch"|"kick"|"palm"|"channel"} pose
   * @param {number} t
   */
  applyActionPose(pose, t) {
    const pivots = limbPivots(this.pose, this.gender);
    const k = Math.max(0, Math.min(1, t));

    // Start from neutral so an interrupted pose never leaves a limb stuck.
    this.pivot("legR", 0, pivots.legR);
    this.pivot("legL", 0, pivots.legL);
    this.pivot("armR", 0, pivots.armR);
    this.pivot("armL", 0, pivots.armL);

    if (pose === "punch") {
      this.pivot("armR", -1.35 * k, pivots.armR);
      this.pivot("armL", 0.45 * k, pivots.armL);
    } else if (pose === "kick") {
      this.pivot("legR", -1.2 * k, pivots.legR);
      this.pivot("armL", 0.55 * k, pivots.armL);
      this.pivot("armR", 0.2 * k, pivots.armR);
    } else if (pose === "palm") {
      this.pivot("armR", -1.0 * k, pivots.armR);
      this.pivot("armL", 1.0 * k, pivots.armL);
    } else if (pose === "channel") {
      this.pivot("armR", -0.4 * k, pivots.armR);
      this.pivot("armL", 0.4 * k, pivots.armL);
    }
  }

  /**
   * Rotate a limb group by `angle` around a joint, then nudge by (dx, dy).
   * Points/polys are stored in absolute rig coordinates, so each object is
   * rotated about its own origin and shifted so the joint stays fixed.
   */
  pivot(group, angle, joint, dx = 0, dy = 0) {
    const members = this.groups[group];
    if (!members) return;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Translation that keeps the joint stationary under R(angle).
    const jx = joint.x - (joint.x * cos - joint.y * sin);
    const jy = joint.y - (joint.x * sin + joint.y * cos);

    for (const { obj, baseX, baseY } of members) {
      obj.rotation = angle;
      obj.x = baseX * cos - baseY * sin + jx + dx;
      obj.y = baseX * sin + baseY * cos + jy + dy;
    }
  }

  destroy() {
    this.actionTween?.stop();
    this.actionTween = null;
    if (this.container) {
      this.container.destroy(true);
      this.container = null;
    }
  }
}

/** Compact change key for the equipped slots (only presence matters, not item). */
function slotSignature(equipment = {}) {
  return EQUIPMENT_SLOT_KEYS.map((slot) => (equipment[slot] ? "1" : "0")).join("");
}

function createPrimitive(scene, p) {
  const alpha = p.alpha ?? 1;
  let obj;

  switch (p.kind) {
    case "poly":
      // Origin (0,0) keeps the polygon's points in absolute rig coordinates;
      // Phaser otherwise offsets points by the shape's bbox centre (displayOrigin).
      obj = scene.add.polygon(0, 0, p.points, p.fill, alpha);
      obj.setOrigin(0, 0);
      break;
    case "rect":
      obj = scene.add.rectangle(p.x, p.y, p.w, p.h, p.fill, alpha);
      break;
    case "ellipse":
      obj = scene.add.ellipse(p.x, p.y, p.w, p.h, p.fill, alpha);
      break;
    case "circle":
      obj = scene.add.circle(p.x, p.y, p.r, p.fill, alpha);
      break;
    case "line":
      obj = scene.add.line(0, 0, p.x1, p.y1, p.x2, p.y2, p.stroke, alpha);
      obj.setOrigin(0, 0);
      break;
    default:
      return null;
  }

  if (p.kind === "line") {
    obj.setLineWidth(p.lineWidth ?? 1);
  } else if (p.stroke) {
    obj.setStrokeStyle(p.lineWidth ?? 1, p.stroke, alpha);
  }
  return obj;
}
