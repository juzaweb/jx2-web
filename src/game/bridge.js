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
  QUEST_UPDATED: "QUEST_UPDATED",
  COORDS_UPDATED: "COORDS_UPDATED",
  INVENTORY_UPDATED: "INVENTORY_UPDATED",
  EQUIPMENT_UPDATED: "EQUIPMENT_UPDATED",
  GAME_STARTED: "GAME_STARTED",
  GAME_PAUSED: "GAME_PAUSED",
  PK_CHANGED: "PK_CHANGED",

  // React -> Phaser
  ACTION_START: "ACTION_START",
  ACTION_ATTACK: "ACTION_ATTACK",
  ACTION_SKILL: "ACTION_SKILL",
  ACTION_USE_POTION: "ACTION_USE_POTION",
  ACTION_EQUIP_ITEM: "ACTION_EQUIP_ITEM",
  ACTION_UNEQUIP_SLOT: "ACTION_UNEQUIP_SLOT",
  ACTION_MOVE: "ACTION_MOVE",
  ACTION_SAVE: "ACTION_SAVE",
  ACTION_RESET: "ACTION_RESET",
  ACTION_TOGGLE_AUDIO: "ACTION_TOGGLE_AUDIO",
  ACTION_SET_PAUSED: "ACTION_SET_PAUSED",
  ACTION_TOGGLE_PK: "ACTION_TOGGLE_PK",
  ACTION_REGISTER_MINIMAP: "ACTION_REGISTER_MINIMAP",
  ACTION_REQUEST_MINIMAP: "ACTION_REQUEST_MINIMAP",
  SET_PLAYER_NAME: "SET_PLAYER_NAME",
  SET_PLAYER_GENDER: "SET_PLAYER_GENDER",
  ACTION_CHAT: "ACTION_CHAT"
};
