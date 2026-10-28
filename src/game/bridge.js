/**
 * Event Bridge to facilitate decoupled communication between Phaser game loop and React components.
 */
class GameEventBridge {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to an event
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Emit an event to all subscribers
   * @param {string} event
   * @param {*} data
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in GameBridge event handler for "${event}":`, err);
        }
      });
    }
  }

  /**
   * Clear all listeners
   */
  clear() {
    this.listeners.clear();
  }
}

export const bridge = new GameEventBridge();

export const EVENTS = {
  // Phaser -> React
  STATS_UPDATED: "STATS_UPDATED",
  LOG_ADDED: "LOG_ADDED",
  AUDIO_CHANGED: "AUDIO_CHANGED",
  /** Server-authoritative newbie quest state ({activeId, objectives, completed, level}). */
  QUESTS_UPDATED: "QUESTS_UPDATED",
  /** Nearest in-range NPC changed (payload: {npcId, name} | null). */
  NEARBY_NPC_CHANGED: "NEARBY_NPC_CHANGED",
  /** An NPC dialog opened in the scene (payload: {npc, lineKey, quest?}). */
  NPC_DIALOG_OPENED: "NPC_DIALOG_OPENED",
  NPC_DIALOG_CLOSED: "NPC_DIALOG_CLOSED",
  QUEST_LOG_TOGGLE: "QUEST_LOG_TOGGLE",
  COORDS_UPDATED: "COORDS_UPDATED",
  INVENTORY_UPDATED: "INVENTORY_UPDATED",
  EQUIPMENT_UPDATED: "EQUIPMENT_UPDATED",
  GAME_STARTED: "GAME_STARTED",
  GAME_PAUSED: "GAME_PAUSED",
  PK_CHANGED: "PK_CHANGED",
  SKILL_CAST: "SKILL_CAST",
  /**
   * Server-authoritative learned skills
   * (payload: { skills: string[], levels: Record<string, number> }).
   */
  SKILLS_UPDATED: "SKILLS_UPDATED",
  SHOP_OPENED: "SHOP_OPENED",
  SHOP_RESULT: "SHOP_RESULT",
  /** Socket gate state for the overlay (payload: {connected}). */
  NETWORK_STATE: "NETWORK_STATE",
  /**
   * The connection cannot recover on its own (rejected join / same character on
   * another device). Payload: {reason: "auth"|"character"|"superseded"}.
   */
  CONNECTION_ISSUE: "CONNECTION_ISSUE",
  /**
   * Target selected or updated in Phaser
   * (payload: { id, name, level, hp, maxHp, kind, isBoss } | null).
   */
  TARGET_UPDATED: "TARGET_UPDATED",

  // React -> Phaser
  ACTION_START: "ACTION_START",
  ACTION_ATTACK: "ACTION_ATTACK",
  ACTION_CAST_SKILL: "ACTION_CAST_SKILL",
  /** Ask the server to raise a skill by one level (payload: {skillId}). */
  ACTION_UPGRADE_SKILL: "ACTION_UPGRADE_SKILL",
  /** Newbie quest commands (payload: {questId?, npcId?}). */
  ACTION_QUEST_ACCEPT: "ACTION_QUEST_ACCEPT",
  ACTION_QUEST_TALK: "ACTION_QUEST_TALK",
  ACTION_QUEST_TURN_IN: "ACTION_QUEST_TURN_IN",
  /** Talk to the nearest in-range NPC (mobile button). */
  ACTION_INTERACT_NPC: "ACTION_INTERACT_NPC",
  /** Close the open NPC dialog, releasing the scene. */
  ACTION_CLOSE_NPC_DIALOG: "ACTION_CLOSE_NPC_DIALOG",
  /** Open the current NPC's real shop counter (Dược Sư). */
  ACTION_OPEN_NPC_SHOP: "ACTION_OPEN_NPC_SHOP",
  SET_QUICK_SLOTS: "SET_QUICK_SLOTS",
  ACTION_USE_POTION: "ACTION_USE_POTION",
  ACTION_BUY_ITEM: "ACTION_BUY_ITEM",
  ACTION_EQUIP_ITEM: "ACTION_EQUIP_ITEM",
  ACTION_UNEQUIP_SLOT: "ACTION_UNEQUIP_SLOT",
  ACTION_MOVE: "ACTION_MOVE",
  ACTION_CLEAR_TARGET: "ACTION_CLEAR_TARGET",
  ACTION_SAVE: "ACTION_SAVE",
  ACTION_RESET: "ACTION_RESET",
  ACTION_TOGGLE_AUDIO: "ACTION_TOGGLE_AUDIO",
  ACTION_SET_PAUSED: "ACTION_SET_PAUSED",
  ACTION_TOGGLE_PK: "ACTION_TOGGLE_PK",
  ACTION_REGISTER_MINIMAP: "ACTION_REGISTER_MINIMAP",
  ACTION_REQUEST_MINIMAP: "ACTION_REQUEST_MINIMAP",
  ACTION_REGISTER_CITY_MAP: "ACTION_REGISTER_CITY_MAP",
  ACTION_REQUEST_CITY_MAP: "ACTION_REQUEST_CITY_MAP",
  SET_PLAYER_NAME: "SET_PLAYER_NAME",
  SET_PLAYER_GENDER: "SET_PLAYER_GENDER",
  /** Ask the scene to use a weapon's skill kit (payload: weaponType). */
  SET_PLAYER_WEAPON: "SET_PLAYER_WEAPON",
  ACTION_CHAT: "ACTION_CHAT",
  ACTION_GM: "ACTION_GM",
  GM_MODAL_TOGGLE: "GM_MODAL_TOGGLE",
  /** Fired after the hero arrives on a new map (payload: {mapId, name}). */
  MAP_CHANGED: "MAP_CHANGED",
  /** Fired when the server refuses a portal move. */
  MAP_CHANGE_REJECTED: "MAP_CHANGE_REJECTED",
  /** Ask the scene to retry the socket now, bypassing reconnect backoff. */
  ACTION_RETRY_CONNECTION: "ACTION_RETRY_CONNECTION",
  /** Leave the world: stop the socket (and its auto-reconnect) until the next join. */
  ACTION_LEAVE_WORLD: "ACTION_LEAVE_WORLD"
};
