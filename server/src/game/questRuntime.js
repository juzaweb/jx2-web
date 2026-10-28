/**
 * Server-side newbie quest runtime.
 *
 * The shared state machine decides *what* is legal; this module performs the
 * side effects that belong to a live socket: proximity checks against the
 * server-owned position, ledger/bag payouts, persistence and syncing. Keeping it
 * out of `gameSocket.js` stops that file from growing another feature block, and
 * makes every quest rule testable without a WebSocket.
 */

import { questById } from "../../../src/game/quests/catalog.js";
import {
  acceptQuest,
  acceptRejection,
  activeQuest,
  recordTalk,
  turnInQuest,
  turnInRejection
} from "../../../src/game/quests/state.js";
import { findNpc } from "../../../src/game/maps/mapRegistry.js";
import { isInTalkRange } from "../../../src/game/npcRange.js";
import { toLedgerDong } from "../../../src/game/currency.js";
import { store } from "../data/playerDb.js";
import { consumeItem, grantItem, grantItems } from "./playerBag.js";

/** Trim a client string to the protocol limit. */
const clean = (value, maxLen = 64) =>
  typeof value === "string" ? value.trim().slice(0, maxLen) : "";

/**
 * The NPC definition for `npcId` on the player's current map, but only when the
 * server-owned hero position is close enough to talk to it.
 * @param {Object} player
 * @param {string} npcId
 * @returns {Object|null}
 */
export function questNpc(player, npcId) {
  const npc = findNpc(player?.mapId, npcId);
  if (!npc) return null;
  return isInTalkRange({ gx: npc.x, gy: npc.y }, player.x, player.y) ? npc : null;
}

/**
 * Pay a quest reward: EXP/silver through the ledger, items into the bag.
 * @param {Object} manager GameSocketManager
 * @param {WebSocket} ws
 * @param {Object} player
 * @param {{exp?:number, bac?:number, items?:Array<{id:string, qty:number}>}} [reward]
 */
export function payoutQuestReward(manager, ws, player, reward) {
  if (!player?.progress || !reward) return;
  const exp = Math.max(0, Math.floor(Number(reward.exp) || 0));
  const coins = toLedgerDong(reward.bac || 0);

  if (exp > 0 || coins > 0) {
    manager.creditReward(ws, player, { exp, coins });
    manager.persistProgress(player);
  }

  if (Array.isArray(reward.items) && reward.items.length > 0) {
    const itemsToGrant = reward.items.map((entry) => ({
      itemId: entry.id,
      amount: entry.qty || 1
    }));
    const granted = grantItems(player.characterId, itemsToGrant);
    if (granted.ok) manager.sendInventory(player, granted.bag);
  }
}

/** Persist the authoritative quest state. Best-effort, like the ledger. */
export function persistQuestState(player) {
  if (!player.characterId || !player.questState) return;
  try {
    store.setQuestState(player.characterId, player.questState);
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error("[Quest] Failed to persist quest state:", err.message);
    }
  }
}

/**
 * Push the player's quest state to its owner. The level rides along so the log
 * can show "Cần cấp X" without a second packet.
 * @param {Object} manager GameSocketManager
 * @param {Object} player
 */
export function sendQuestSync(manager, player) {
  const ws = manager.playerById.get(player.id)?.ws || null;
  manager.send(ws, {
    type: "quest_sync",
    payload: { ...player.questState, level: player.progress?.level ?? 1 }
  });
}

/**
 * @param {Object} manager GameSocketManager
 * @param {WebSocket} ws
 * @param {string} action
 * @param {string} reason
 */
function rejectQuest(manager, ws, action, reason) {
  manager.send(ws, { type: "quest_result", payload: { ok: false, action, reason } });
}

/**
 * Accept a newbie quest at its giver. The server owns the level gate, chain
 * order, the NPC identity and the distance check.
 * @param {Object} manager GameSocketManager
 * @param {WebSocket} ws
 * @param {{questId?:string, npcId?:string}} [payload]
 */
export function handleQuestAccept(manager, ws, payload = {}) {
  const player = manager.players.get(ws);
  if (!player?.progress || !player.characterId) return;

  const quest = questById(clean(payload.questId));
  const npcId = clean(payload.npcId);
  if (!quest || quest.giver !== npcId) return rejectQuest(manager, ws, "accept", "unknown");
  if (!questNpc(player, npcId)) return rejectQuest(manager, ws, "accept", "range");

  const reason = acceptRejection(player.questState, quest, player.progress.level);
  if (reason) return rejectQuest(manager, ws, "accept", reason);

  const result = acceptQuest(player.questState, quest, player.progress.level);
  if (!result.ok) return rejectQuest(manager, ws, "accept", result.reason || "unknown");

  player.questState = result.state;
  persistQuestState(player);
  payoutQuestReward(manager, ws, player, quest.acceptReward);
  sendQuestSync(manager, player);
  manager.send(ws, {
    type: "quest_result",
    payload: { ok: true, action: "accept", questId: quest.id }
  });
}

/**
 * Record one conversation for the active quest. Repeat packets are idempotent
 * and pay nothing extra.
 * @param {Object} manager GameSocketManager
 * @param {WebSocket} ws
 * @param {{npcId?:string}} [payload]
 */
export function handleQuestTalk(manager, ws, payload = {}) {
  const player = manager.players.get(ws);
  if (!player?.progress || !player.characterId) return;

  const quest = activeQuest(player.questState);
  if (!quest) return rejectQuest(manager, ws, "talk", "no_active");

  const npcId = clean(payload.npcId);
  if (!questNpc(player, npcId)) return rejectQuest(manager, ws, "talk", "range");

  const result = recordTalk(player.questState, quest, npcId);
  if (!result.changed) return rejectQuest(manager, ws, "talk", "nothing");

  player.questState = result.state;
  persistQuestState(player);
  payoutQuestReward(manager, ws, player, result.target?.reward);
  sendQuestSync(manager, player);
  manager.send(ws, {
    type: "quest_result",
    payload: {
      ok: true,
      action: "talk",
      questId: quest.id,
      npcId,
      ready: result.ready
    }
  });
}

/**
 * Turn in a ready quest at its turn-in NPC. The letter item (if any) is
 * consumed, then the final reward is paid once.
 * @param {Object} manager GameSocketManager
 * @param {WebSocket} ws
 * @param {{questId?:string, npcId?:string}} [payload]
 */
export function handleQuestTurnIn(manager, ws, payload = {}) {
  const player = manager.players.get(ws);
  if (!player?.progress || !player.characterId) return;

  const quest = questById(clean(payload.questId));
  const npcId = clean(payload.npcId);
  if (!quest || quest.turnIn !== npcId) return rejectQuest(manager, ws, "turn_in", "unknown");
  if (!questNpc(player, npcId)) return rejectQuest(manager, ws, "turn_in", "range");

  const reason = turnInRejection(player.questState, quest);
  if (reason) return rejectQuest(manager, ws, "turn_in", reason);

  const result = turnInQuest(player.questState, quest);
  if (!result.ok) return rejectQuest(manager, ws, "turn_in", result.reason || "unknown");

  // Best-effort consumption: a missing letter must never block the turn-in.
  for (const entry of quest.consumeOnTurnIn || []) {
    const consumed = consumeItem(player.characterId, entry.id, entry.qty || 1);
    if (consumed.ok) manager.sendInventory(player, consumed.bag);
  }

  player.questState = result.state;
  persistQuestState(player);
  payoutQuestReward(manager, ws, player, quest.reward);
  sendQuestSync(manager, player);
  manager.send(ws, {
    type: "quest_result",
    payload: { ok: true, action: "turn_in", questId: quest.id }
  });
}
