/**
 * Pure quest state machine for the newbie chain.
 *
 * The server stores the returned shape in `saves.quest_state` and treats it as
 * authoritative; the client only renders the synced copy. Keeping every rule
 * here (and free of transport/Phaser) is what lets both sides agree on when a
 * quest is available, ready or done.
 *
 * Shape:
 * ```js
 * {
 *   activeId: "tan-thu-1" | null,
 *   objectives: {
 *     "tan-thu-1": { shops: { targets: { "chu-tiem-vu-khi": true } } }
 *   },
 *   completed: ["..."],
 *   version: 1
 * }
 * ```
 */

import { QUEST_BY_ID, previousQuest, questById } from "./catalog.js";

export const QUEST_STATE_VERSION = 1;

/** Keys that would poison a plain object if copied from persisted JSON. */
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** @returns {ReturnType<typeof emptyQuestState>} */
export function emptyQuestState() {
  return {
    version: QUEST_STATE_VERSION,
    activeId: null,
    objectives: {},
    completed: []
  };
}

/** Backwards-friendly name used by planned feature docs. */
export const createEmptyQuestState = emptyQuestState;

/**
 * Coerce anything persisted or received into a safe quest state. Unknown quest
 * and objective ids are dropped, completed ids are de-duplicated, and an active
 * quest that is also completed is cleared.
 * @param {*} raw
 * @returns {ReturnType<typeof emptyQuestState>}
 */
export function normalizeQuestState(raw) {
  const base = emptyQuestState();
  if (!isPlainObject(raw)) return base;

  const objectives = {};
  if (isPlainObject(raw.objectives)) {
    for (const [questId, objectiveMap] of Object.entries(raw.objectives)) {
      if (DANGEROUS_KEYS.has(questId) || !QUEST_BY_ID[questId]) continue;
      if (!isPlainObject(objectiveMap)) continue;

      const quest = QUEST_BY_ID[questId];
      const cleanedObjectives = {};
      for (const objective of quest.objectives) {
        const entry = objectiveMap[objective.id];
        if (!isPlainObject(entry) || !isPlainObject(entry.targets)) continue;

        const targets = {};
        for (const target of objective.targets) {
          if (entry.targets[target.npcId] === true) targets[target.npcId] = true;
        }
        if (Object.keys(targets).length > 0) cleanedObjectives[objective.id] = { targets };
      }
      if (Object.keys(cleanedObjectives).length > 0) objectives[questId] = cleanedObjectives;
    }
  }

  const completed = [];
  if (Array.isArray(raw.completed)) {
    for (const id of raw.completed) {
      if (typeof id === "string" && QUEST_BY_ID[id] && !completed.includes(id)) completed.push(id);
    }
  }

  const activeId =
    typeof raw.activeId === "string" &&
    QUEST_BY_ID[raw.activeId] &&
    !completed.includes(raw.activeId)
      ? raw.activeId
      : null;

  return { version: QUEST_STATE_VERSION, activeId, objectives, completed };
}

/**
 * Whether the previous quest in the chain has been turned in.
 * @param {ReturnType<typeof emptyQuestState>} state
 * @param {string} questId
 * @returns {boolean}
 */
export function chainUnlocked(state, questId) {
  const previous = previousQuest(questId);
  return !previous || state.completed.includes(previous.id);
}

/**
 * Why the hero cannot accept a quest, or null when they can.
 * @param {ReturnType<typeof emptyQuestState>} state
 * @param {import("./catalog.js").QuestDefinition|null} quest
 * @param {number} level
 * @returns {"unknown"|"done"|"active"|"level"|"chain"|null}
 */
export function acceptRejection(state, quest, level) {
  if (!quest) return "unknown";
  if (state.completed.includes(quest.id)) return "done";
  if (state.activeId) return "active";
  if (!chainUnlocked(state, quest.id)) return "chain";
  if (!Number.isFinite(level) || level < quest.minLevel) return "level";
  return null;
}

/**
 * @param {ReturnType<typeof emptyQuestState>} state
 * @param {import("./catalog.js").QuestDefinition|null} quest
 * @param {number} level
 * @returns {boolean}
 */
export function canAccept(state, quest, level) {
  return acceptRejection(state, quest, level) === null;
}

/**
 * Accept a quest. Pure: returns a new state, or the same one with a reason.
 * @param {ReturnType<typeof emptyQuestState>} state
 * @param {import("./catalog.js").QuestDefinition|null} quest
 * @param {number} level
 * @returns {{ok:boolean, state:ReturnType<typeof emptyQuestState>, reason?:string}}
 */
export function acceptQuest(state, quest, level) {
  const reason = acceptRejection(state, quest, level);
  if (reason) return { ok: false, state, reason };

  const next = normalizeQuestState(state);
  next.activeId = quest.id;
  next.objectives[quest.id] = next.objectives[quest.id] || {};
  return { ok: true, state: next };
}

/**
 * @param {ReturnType<typeof emptyQuestState>} state
 * @returns {import("./catalog.js").QuestDefinition|null}
 */
export function activeQuest(state) {
  return questById(state.activeId);
}

/**
 * The active objective entry of a quest, or an empty object when none exists.
 * @param {ReturnType<typeof emptyQuestState>} state
 * @param {import("./catalog.js").QuestDefinition} quest
 * @param {import("./catalog.js").QuestObjective} objective
 * @returns {{targets?: Record<string, true>}}
 */
function objectiveEntry(state, quest, objective) {
  return state.objectives?.[quest.id]?.[objective.id] || {};
}

/**
 * Whether the hero has already heard a talk target.
 * @param {ReturnType<typeof emptyQuestState>} state
 * @param {import("./catalog.js").QuestDefinition} quest
 * @param {import("./catalog.js").QuestObjective} objective
 * @param {string} npcId
 * @returns {boolean}
 */
export function isTargetDone(state, quest, objective, npcId) {
  return objectiveEntry(state, quest, objective).targets?.[npcId] === true;
}

/**
 * Record one conversation. Unknown NPCs are ignored, and repeat conversations
 * are idempotent (no reward is paid twice).
 * @param {ReturnType<typeof emptyQuestState>} state
 * @param {import("./catalog.js").QuestDefinition} quest
 * @param {string} npcId
 * @returns {{changed:boolean, state:ReturnType<typeof emptyQuestState>,
 *   objective?: import("./catalog.js").QuestObjective,
 *   target?: import("./catalog.js").QuestTalkTarget,
 *   ready:boolean}}
 */
export function recordTalk(state, quest, npcId) {
  const ready = isQuestReady(state, quest);
  if (!quest || state.activeId !== quest.id) return { changed: false, state, ready };

  for (const objective of quest.objectives) {
    const target = objective.targets.find((entry) => entry.npcId === npcId);
    if (!target || isTargetDone(state, quest, objective, npcId)) continue;

    const next = normalizeQuestState(state);
    const entry = ((next.objectives[quest.id] ||= {})[objective.id] ||= { targets: {} });
    entry.targets[npcId] = true;
    return {
      changed: true,
      state: next,
      objective,
      target,
      ready: isQuestReady(next, quest)
    };
  }

  return { changed: false, state, ready };
}

/**
 * Progress of one objective: how many talk targets were heard.
 * @param {ReturnType<typeof emptyQuestState>} state
 * @param {import("./catalog.js").QuestDefinition} quest
 * @param {import("./catalog.js").QuestObjective} objective
 * @returns {{done:number, total:number}}
 */
export function objectiveProgress(state, quest, objective) {
  const total = objective.targets.length;
  const done = objective.targets.filter((target) =>
    isTargetDone(state, quest, objective, target.npcId)
  ).length;
  return { done, total };
}

/**
 * Whether every objective (hence every talk target) is complete.
 * @param {ReturnType<typeof emptyQuestState>} state
 * @param {import("./catalog.js").QuestDefinition|null} quest
 * @returns {boolean}
 */
export function isQuestReady(state, quest) {
  if (!quest) return false;
  if (state.activeId !== quest.id) return false;
  return quest.objectives.every((objective) => {
    const { done, total } = objectiveProgress(state, quest, objective);
    return total > 0 && done === total;
  });
}

/**
 * Why a quest cannot be turned in, or null when it can.
 * @param {ReturnType<typeof emptyQuestState>} state
 * @param {import("./catalog.js").QuestDefinition|null} quest
 * @returns {"unknown"|"inactive"|"incomplete"|null}
 */
export function turnInRejection(state, quest) {
  if (!quest) return "unknown";
  if (state.activeId !== quest.id) return "inactive";
  if (!isQuestReady(state, quest)) return "incomplete";
  return null;
}

/**
 * Mark a ready quest as completed and clear its active entry.
 * @param {ReturnType<typeof emptyQuestState>} state
 * @param {import("./catalog.js").QuestDefinition|null} quest
 * @returns {{ok:boolean, state:ReturnType<typeof emptyQuestState>, reason?:string}}
 */
export function turnInQuest(state, quest) {
  const reason = turnInRejection(state, quest);
  if (reason) return { ok: false, state, reason };

  const next = normalizeQuestState(state);
  next.activeId = null;
  delete next.objectives[quest.id];
  if (!next.completed.includes(quest.id)) next.completed.push(quest.id);
  return { ok: true, state: next };
}

/**
 * UI-facing status of one quest.
 * @param {ReturnType<typeof emptyQuestState>} state
 * @param {import("./catalog.js").QuestDefinition} quest
 * @param {number} level
 * @returns {"done"|"ready"|"active"|"available"|"locked"}
 */
export function questStatus(state, quest, level) {
  if (state.completed.includes(quest.id)) return "done";
  if (state.activeId === quest.id) return isQuestReady(state, quest) ? "ready" : "active";
  if (canAccept(state, quest, level)) return "available";
  return "locked";
}

/**
 * Why a quest is locked, for the log's "Cần cấp X" chip. Null when not locked.
 * @param {ReturnType<typeof emptyQuestState>} state
 * @param {import("./catalog.js").QuestDefinition} quest
 * @param {number} level
 * @returns {"level"|"chain"|null}
 */
export function lockReason(state, quest, level) {
  if (questStatus(state, quest, level) !== "locked") return null;
  if (!chainUnlocked(state, quest.id)) return "chain";
  return "level";
}

