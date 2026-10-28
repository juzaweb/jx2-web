/**
 * Read-only view helpers that turn the synced quest state into render-ready data
 * for the HUD tracker, the quest log and the NPC dialog. Pure: no bridge, no
 * Phaser, no DOM — components pass the state in and translate the keys with `t`.
 */

import { QUESTS } from "./quests/catalog.js";
import {
  activeQuest,
  isQuestReady,
  isTargetDone,
  lockReason,
  normalizeQuestState,
  objectiveProgress,
  questStatus,
  canAccept
} from "./quests/state.js";

/**
 * The pinned objective of the active quest, or null when nothing is running.
 * @param {object} state
 * @returns {{quest:object, labelKey:string, done:number, total:number, ready:boolean}|null}
 */
export function activeQuestView(state) {
  const safe = normalizeQuestState(state);
  const quest = activeQuest(safe);
  if (!quest) return null;

  const objective = quest.objectives[0];
  const { done, total } = objectiveProgress(safe, quest, objective);
  return {
    quest,
    labelKey: objective.labelKey,
    done,
    total,
    ready: isQuestReady(safe, quest)
  };
}

/**
 * Every chain row for the quest log.
 * @param {object} state
 * @param {number} level
 * @returns {Array<{quest:object, status:string, lockReason:string|null,
 *   objectives:Array<{labelKey:string, done:number, total:number}>}>}
 */
export function questLogRows(state, level) {
  const safe = normalizeQuestState(state);
  return QUESTS.map((quest) => ({
    quest,
    status: questStatus(safe, quest, level),
    lockReason: lockReason(safe, quest, level),
    objectives: quest.objectives.map((objective) => ({
      labelKey: objective.labelKey,
      ...objectiveProgress(safe, quest, objective)
    }))
  }));
}

/**
 * What an NPC should say/offer right now.
 * @param {object} state
 * @param {number} level
 * @param {string} npcId
 * @returns {{available:object|null, active:object|null, targetLineKey:string|null,
 *   turnIn:object|null, isTurnInNpc:boolean}}
 */
export function npcDialogView(state, level, npcId) {
  const safe = normalizeQuestState(state);
  const available =
    QUESTS.find((quest) => quest.giver === npcId && canAccept(safe, quest, level)) || null;

  const active = activeQuest(safe);
  let targetLineKey = null;
  if (active && safe.activeId === active.id) {
    for (const objective of active.objectives) {
      const target = objective.targets.find((entry) => entry.npcId === npcId);
      if (target && !isTargetDone(safe, active, objective, npcId)) {
        targetLineKey = target.lineKey;
        break;
      }
    }
  }

  const turnIn = active && active.turnIn === npcId && isQuestReady(safe, active) ? active : null;

  return {
    available,
    active,
    targetLineKey,
    turnIn,
    isTurnInNpc: Boolean(active && active.turnIn === npcId)
  };
}
