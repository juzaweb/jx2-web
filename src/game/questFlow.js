/**
 * Client-side NPC dialog and quest command flow.
 *
 * The scene owns movement and proximity; this class only decides what happens
 * when the hero talks to a NPC and forwards the player's choices to the server.
 * The server is authoritative for accept/talk/turn-in; nothing here pays out.
 */

import { bridge, EVENTS } from "./bridge.js";

export class QuestFlow {
  /**
   * @param {{uiBridge: {addLog: Function}, networkClient: ?object,
   *   onShop?: (npc: object) => void}} deps
   */
  constructor({ uiBridge, networkClient, onShop = () => {} }) {
    this.uiBridge = uiBridge;
    this.networkClient = networkClient;
    this.onShop = onShop;
    /** NPC whose dialog is open, or null. */
    this.npc = null;

    this.unsubs = [
      bridge.on(EVENTS.ACTION_QUEST_ACCEPT, ({ questId } = {}) => this.accept(questId)),
      bridge.on(EVENTS.ACTION_QUEST_TALK, ({ npcId } = {}) => this.talk(npcId)),
      bridge.on(EVENTS.ACTION_QUEST_TURN_IN, ({ questId } = {}) => this.turnIn(questId))
    ];
  }

  /**
   * Open the dialog for a NPC. The panel itself is React-owned; the scene only
   * pauses and announces which NPC is being talked to.
   * @param {{id:string, name:string, role?:string, shop?:string}} npc
   */
  open(npc) {
    if (!npc?.id) return;
    this.npc = npc;
    bridge.emit(EVENTS.ACTION_SET_PAUSED, true);
    bridge.emit(EVENTS.NPC_DIALOG_OPENED, {
      npc: { id: npc.id, name: npc.name, role: npc.role || "quest", shop: npc.shop || null }
    });
  }

  /** Close the open dialog and release the scene. */
  close() {
    this.npc = null;
    bridge.emit(EVENTS.ACTION_SET_PAUSED, false);
    bridge.emit(EVENTS.NPC_DIALOG_CLOSED, null);
  }

  /**
   * Accept the quest currently offered by the open NPC.
   * @param {string} questId
   */
  accept(questId) {
    if (!questId || !this.npc?.id) return;
    this.uiBridge?.addLog(`${this.npc.name}: Hãy theo lời ta dặn.`, "near");
    this.networkClient?.sendQuestAccept?.({ questId, npcId: this.npc.id });
  }

  /**
   * Report a conversation for the active quest.
   * @param {string} [npcId] defaults to the open NPC
   */
  talk(npcId) {
    const id = npcId || this.npc?.id;
    if (!id) return;
    this.networkClient?.sendQuestTalk?.({ npcId: id });
  }

  /**
   * Turn in a ready quest at the open NPC.
   * @param {string} questId
   */
  turnIn(questId) {
    if (!questId || !this.npc?.id) return;
    this.networkClient?.sendQuestTurnIn?.({ questId, npcId: this.npc.id });
  }

  /** Open the real shop counter of the current NPC (Dược Sư only). */
  openShop() {
    if (!this.npc?.shop) return;
    const npc = this.npc;
    this.close();
    this.onShop(npc);
  }

  /** Release bridge subscriptions when the scene is torn down. */
  destroy() {
    this.unsubs.forEach((unsub) => unsub?.());
    this.unsubs = [];
    this.npc = null;
  }
}
