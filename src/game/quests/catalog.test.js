import { describe, expect, it } from "vitest";
import {
  FIRST_QUEST_ID,
  QUESTS,
  QUEST_CHAIN,
  nextQuest,
  questById,
  questTotalExp
} from "../quests/catalog.js";
import {
  acceptQuest,
  emptyQuestState,
  isQuestReady,
  normalizeQuestState,
  questStatus,
  recordTalk,
  turnInQuest
} from "../quests/state.js";
import { nextExpForLevel } from "../progression.js";
import { MARKET_NPCS } from "../marketLayout.js";
import { getItemById } from "../items.js";

/** EXP needed to walk from `fromLevel` to `toLevel` with an empty bar. */
const expBetween = (fromLevel, toLevel) => {
  let total = 0;
  for (let level = fromLevel; level < toLevel; level += 1) {
    total += nextExpForLevel(level);
  }
  return total;
};

describe("newbie quest catalog", () => {
  it("chains six quests in order and links them", () => {
    expect(QUEST_CHAIN).toEqual([
      "tan-thu-1",
      "tan-thu-2",
      "tan-thu-3",
      "tan-thu-4",
      "tan-thu-5",
      "tan-thu-6"
    ]);
    QUESTS.forEach((quest, index) => {
      expect(quest.order).toBe(index + 1);
      const next = nextQuest(quest.id);
      if (index < QUESTS.length - 1) expect(next?.id).toBe(QUESTS[index + 1].id);
      else expect(next).toBeNull();
    });
  });

  it("keeps the reference level gates", () => {
    expect(QUESTS.map((quest) => quest.minLevel)).toEqual([1, 4, 6, 8, 9, 10]);
  });

  it("pays enough EXP to reach the next quest's level without grinding", () => {
    for (let index = 0; index < QUESTS.length - 1; index += 1) {
      const quest = QUESTS[index];
      const next = QUESTS[index + 1];
      const needed = expBetween(quest.minLevel, next.minLevel);
      expect(questTotalExp(quest), `${quest.id} must reach level ${next.minLevel}`).toBeGreaterThanOrEqual(
        needed
      );
    }
  });

  it("only targets NPCs that exist in Biện Kinh", () => {
    const ids = new Set(MARKET_NPCS.map((npc) => npc.id));
    for (const quest of QUESTS) {
      expect(ids.has(quest.giver), `${quest.id} giver`).toBe(true);
      expect(ids.has(quest.turnIn), `${quest.id} turn-in`).toBe(true);
      for (const objective of quest.objectives) {
        expect(objective.type).toBe("talk");
        for (const target of objective.targets) {
          expect(ids.has(target.npcId), `${quest.id} -> ${target.npcId}`).toBe(true);
        }
      }
    }
  });

  it("only rewards items that exist in the catalog", () => {
    const ids = [];
    for (const quest of QUESTS) {
      ids.push(...(quest.acceptReward?.items || []));
      ids.push(...(quest.reward?.items || []));
      ids.push(...(quest.consumeOnTurnIn || []));
      for (const objective of quest.objectives) {
        for (const target of objective.targets) {
          ids.push(...(target.reward?.items || []));
        }
      }
    }
    for (const { id } of ids) {
      expect(getItemById(id), id).not.toBeNull();
    }
  });

  it("has no monster objectives", () => {
    const types = QUESTS.flatMap((quest) => quest.objectives.map((objective) => objective.type));
    expect(new Set(types)).toEqual(new Set(["talk"]));
  });
});

describe("quest state machine", () => {
  const first = questById(FIRST_QUEST_ID);

  it("gates a quest by level and chain order", () => {
    const state = emptyQuestState();
    expect(questStatus(state, first, 1)).toBe("available");
    expect(questStatus(state, questById("tan-thu-2"), 1)).toBe("locked");
    expect(questStatus(state, questById("tan-thu-2"), 4)).toBe("locked");
    expect(questStatus(state, first, 0)).toBe("locked");
  });

  it("accepts, records every talk target once, then turns in", () => {
    const accepted = acceptQuest(emptyQuestState(), first, 1);
    expect(accepted.ok).toBe(true);
    expect(accepted.state.activeId).toBe(first.id);

    let state = accepted.state;
    for (const target of first.objectives[0].targets) {
      const heard = recordTalk(state, first, target.npcId);
      expect(heard.changed).toBe(true);
      state = heard.state;

      // Repeat conversation is idempotent.
      const again = recordTalk(state, first, target.npcId);
      expect(again.changed).toBe(false);
      expect(again.state).toBe(state);
    }

    expect(isQuestReady(state, first)).toBe(true);
    const done = turnInQuest(state, first);
    expect(done.ok).toBe(true);
    expect(done.state.activeId).toBeNull();
    expect(done.state.completed).toEqual([first.id]);
    expect(questStatus(done.state, first, 1)).toBe("done");
  });

  it("refuses to turn in an incomplete or inactive quest", () => {
    expect(turnInQuest(emptyQuestState(), first).reason).toBe("inactive");

    const accepted = acceptQuest(emptyQuestState(), first, 1).state;
    expect(turnInQuest(accepted, first).reason).toBe("incomplete");
  });

  it("keeps only one active quest and refuses chains out of order", () => {
    const active = acceptQuest(emptyQuestState(), first, 1).state;
    expect(acceptQuest(active, questById("tan-thu-2"), 10).reason).toBe("active");

    const fresh = emptyQuestState();
    expect(acceptQuest(fresh, questById("tan-thu-2"), 10).reason).toBe("chain");
  });

  it("sanitizes persisted junk without throwing", () => {
    const state = normalizeQuestState({
      activeId: "tan-thu-1",
      completed: ["tan-thu-1", "tan-thu-1", "unknown", 42],
      objectives: {
        "tan-thu-1": { shops: { targets: { "chu-tiem-vu-khi": true, bogus: true } } },
        unknown: { shops: { targets: {} } }
      }
    });
    expect(state.activeId).toBeNull(); // also completed -> cleared
    expect(state.completed).toEqual(["tan-thu-1"]);
    expect(state.objectives["tan-thu-1"].shops.targets).toEqual({ "chu-tiem-vu-khi": true });
    expect(state.objectives.unknown).toBeUndefined();
  });
});
