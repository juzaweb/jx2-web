/**
 * Pure portal helpers shared by the scene and the tests.
 *
 * A portal is a ground rectangle inside a map. Stepping into it moves the hero to
 * another map. Two rules keep travel from looping:
 * - a portal only fires on entry, never while the hero stands inside it;
 * - after firing, travel is locked for a short window and the hero must be
 *   outside every portal before another one can fire again.
 */

/** Minimum delay between two map changes, in milliseconds. */
export const PORTAL_COOLDOWN_MS = 1200;

/**
 * @typedef {object} PortalRect
 * @property {number} x Top-left ground x
 * @property {number} y Top-left ground y
 * @property {number} w Width on the ground plane
 * @property {number} h Height on the ground plane
 */

/**
 * @typedef {object} PortalDefinition
 * @property {string} id Unique inside its map
 * @property {string} label Player-facing name of the destination
 * @property {PortalRect} rect Trigger area
 * @property {string} targetMapId
 * @property {{x:number, y:number}} targetSpawn Where the hero lands on arrival
 */

/**
 * @typedef {object} PortalState
 * @property {?string} insidePortalId Portal currently containing the hero
 * @property {boolean} armed False until the hero leaves every portal
 * @property {number} lockedUntil Timestamp before which nothing may fire
 */

/** Fresh portal state for a scene. */
export function createPortalState() {
  return { insidePortalId: null, armed: true, lockedUntil: 0 };
}

/**
 * @param {PortalRect|undefined} rect
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isInsideRect(rect, x, y) {
  if (!rect || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

/**
 * The portal containing a ground position, if any.
 * @param {{portals?: PortalDefinition[]}} map
 * @param {number} x
 * @param {number} y
 * @returns {?PortalDefinition}
 */
export function portalAt(map, x, y) {
  const portals = map?.portals;
  if (!Array.isArray(portals)) return null;
  return portals.find((portal) => isInsideRect(portal.rect, x, y)) || null;
}

/**
 * Advance the portal state machine by one frame.
 *
 * Returns the next state plus the portal to travel through (or null). The caller
 * performs the actual map change; this function never touches the scene.
 *
 * @param {PortalState} state
 * @param {PortalDefinition|null} portal Portal under the hero this frame
 * @param {number} now Current scene time in ms
 * @returns {{ state: PortalState, portal: PortalDefinition|null }}
 */
export function stepPortalTrigger(state, portal, now) {
  const current = state || createPortalState();

  // Standing outside every portal re-arms travel.
  if (!portal) {
    if (current.armed && current.insidePortalId === null) return { state: current, portal: null };
    return {
      state: { insidePortalId: null, armed: true, lockedUntil: current.lockedUntil },
      portal: null
    };
  }

  // Already inside this portal: entering is the only trigger.
  if (current.insidePortalId === portal.id) {
    return { state: { ...current, insidePortalId: portal.id }, portal: null };
  }

  const locked = !current.armed || now < current.lockedUntil;
  const nextState = {
    insidePortalId: portal.id,
    armed: false,
    lockedUntil: locked ? current.lockedUntil : now + PORTAL_COOLDOWN_MS
  };

  return { state: nextState, portal: locked ? null : portal };
}
