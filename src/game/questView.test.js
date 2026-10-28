import { describe, expect, it } from "vitest";
import { activeQuestView, npcDialogView, questLogRows } from "./questView.js";
import { acceptQuest, emptyQuestState, recordTalk } from "./quests/state.js";
import { questById } from "./quests/catalog.js";

const q1 = questById("tan-thu-1");

describe("quest views", () => {
  it("returns null with no active quest", () => {
    expect(activeQuestView(emptyQuestState())).toBeNull();
    expect(activeQuestView(null)).toBeNull();
    expect(questLogRows(null, 1)).toHaveLength(6);
  });

  it("tracks the active objective progress", () => {
    let state = acceptQuest(emptyQuestState(), q1, 1).state;
    const first = q1.objectives[0].targets[0];
    state = recordTalk(state, q1, first.npcId).state;

    const view = activeQuestView(state);
    expect(view.quest.id).toBe(q1.id);
    expect(view.labelKey).toBe(q1.objectives[0].labelKey);
    expect(view.done).toBe(1);
    expect(view.total).toBe(6);
    expect(view.ready).toBe(false);
  });

  it("offers the quest at Dã Tẩu and the next target line at a shop", () => {
    const state = acceptQuest(emptyQuestState(), q1, 1).state;

    const giver = npcDialogView(state, 1, "da-tau");
    expect(giver.available).toBeNull();
    expect(giver.isTurnInNpc).toBe(true);

    const shop = npcDialogView(state, 1, "chu-tiem-vu-khi");
    expect(shop.targetLineKey).toBe("quests.tanThu1.talk.weapon");
    expect(shop.available).toBeNull();

    const fresh = npcDialogView(emptyQuestState(), 1, "da-tau");
    expect(fresh.available.id).toBe(q1.id);
  });

  it("marks one log row per quest, locked or available", () => {
    const rows = questLogRows(emptyQuestState(), 1);
    expect(rows).toHaveLength(6);
    expect(rows[0].status).toBe("available");
    expect(rows[1].status).toBe("locked");
    expect(rows[1].lockReason).toBe("chain");
  });
});
