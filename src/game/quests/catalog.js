/**
 * Newbie quest chain ("Nhiệm vụ Tân thủ") shared by the client and the server.
 *
 * Every quest is pure data: NPC ids refer to `MARKET_NPCS`, objective targets are
 * talk-only, and rewards name catalog item ids. Neither side derives the chain
 * from this module alone — the server owns the authoritative state and the client
 * renders whatever it syncs — but both agree on what a quest means.
 *
 * Level geometry: a quest's total EXP payout (talk targets + turn-in) is sized to
 * carry the hero to the *next* quest's `minLevel`, so the chain never needs a
 * grind. See `questTotalExp` and `questPacingGap` below; `catalog.test.js` pins
 * the budget.
 */

/** Quest 1 id, also the legacy `quest_rewarded` migration anchor. */
export const FIRST_QUEST_ID = "tan-thu-1";

/**
 * @typedef {object} QuestReward
 * @property {number} [exp] EXP credited to the ledger
 * @property {number} [bac] silver quoted in bạc (server converts to đồng)
 * @property {Array<{id:string, qty:number}>} [items] catalog items granted
 */

/**
 * @typedef {object} QuestTalkTarget
 * @property {string} npcId market NPC the hero must talk to
 * @property {string} lineKey i18n key of that NPC's line
 * @property {QuestReward} [reward] paid the first time this NPC is heard
 */

/**
 * @typedef {object} QuestObjective
 * @property {string} id stable key inside the quest state
 * @property {string} labelKey i18n key of the tracker label
 * @property {QuestTalkTarget[]} targets
 */

/**
 * @typedef {object} QuestDefinition
 * @property {string} id
 * @property {number} order
 * @property {number} minLevel
 * @property {string} giver market NPC id that hands the quest out
 * @property {string} turnIn market NPC id that accepts the completed quest
 * @property {string} titleKey
 * @property {string} introKey
 * @property {string} progressKey
 * @property {string} turnInKey
 * @property {QuestReward} [acceptReward] granted as soon as the quest is accepted
 * @property {QuestObjective[]} objectives
 * @property {QuestReward} reward paid on turn-in
 * @property {Array<{id:string, qty:number}>} [consumeOnTurnIn] removed on turn-in
 */

/** @type {ReadonlyArray<QuestDefinition>} */
export const QUESTS = Object.freeze([
  {
    id: FIRST_QUEST_ID,
    order: 1,
    minLevel: 1,
    giver: "da-tau",
    turnIn: "da-tau",
    titleKey: "quests.tanThu1.title",
    introKey: "quests.tanThu1.intro",
    progressKey: "quests.tanThu1.progress",
    turnInKey: "quests.tanThu1.turnIn",
    acceptReward: { items: [{ id: "giang-ho-chi-nam", qty: 1 }] },
    objectives: [
      {
        id: "shops",
        type: "talk",
        labelKey: "quests.tanThu1.objective.shops",
        targets: [
          {
            npcId: "chu-tiem-vu-khi",
            lineKey: "quests.tanThu1.talk.weapon",
            reward: { exp: 10, items: [{ id: "dao-lang-khach", qty: 1 }] }
          },
          {
            npcId: "chu-tiem-do-nam",
            lineKey: "quests.tanThu1.talk.maleClothes",
            reward: { exp: 10, items: [{ id: "ao-lang-khach", qty: 1 }] }
          },
          {
            npcId: "chu-tiem-do-nu",
            lineKey: "quests.tanThu1.talk.femaleClothes",
            reward: { exp: 10, items: [{ id: "quan-lang-khach", qty: 1 }] }
          },
          {
            npcId: "chu-tiem-trang-suc",
            lineKey: "quests.tanThu1.talk.jewelry",
            reward: { exp: 10, items: [{ id: "non-lang-khach", qty: 1 }] }
          },
          {
            npcId: "duoc-su",
            lineKey: "quests.tanThu1.talk.pharmacy",
            reward: { exp: 10, items: [{ id: "kim-sang-duoc", qty: 20 }] }
          },
          {
            npcId: "chu-tiem-tap-hoa",
            lineKey: "quests.tanThu1.talk.grocery",
            reward: { exp: 10, items: [{ id: "hoi-thanh-phu", qty: 2 }] }
          }
        ]
      }
    ],
    reward: { exp: 400, bac: 50 }
  },

  {
    id: "tan-thu-2",
    order: 2,
    minLevel: 4,
    giver: "da-tau",
    turnIn: "da-tau",
    titleKey: "quests.tanThu2.title",
    introKey: "quests.tanThu2.intro",
    progressKey: "quests.tanThu2.progress",
    turnInKey: "quests.tanThu2.turnIn",
    objectives: [
      {
        id: "masters",
        type: "talk",
        labelKey: "quests.tanThu2.objective.masters",
        targets: [
          {
            npcId: "ve-binh-thanh-mon",
            lineKey: "quests.tanThu2.talk.guard",
            reward: { exp: 150 }
          },
          {
            npcId: "vo-su",
            lineKey: "quests.tanThu2.talk.master",
            reward: { exp: 150 }
          },
          {
            npcId: "thu-kho",
            lineKey: "quests.tanThu2.talk.keeper",
            reward: { exp: 150 }
          }
        ]
      }
    ],
    reward: { exp: 400, bac: 100, items: [{ id: "kim-sang-duoc", qty: 20 }] }
  },

  {
    id: "tan-thu-3",
    order: 3,
    minLevel: 6,
    giver: "da-tau",
    turnIn: "da-tau",
    titleKey: "quests.tanThu3.title",
    introKey: "quests.tanThu3.intro",
    progressKey: "quests.tanThu3.progress",
    turnInKey: "quests.tanThu3.turnIn",
    objectives: [
      {
        id: "friends",
        type: "talk",
        labelKey: "quests.tanThu3.objective.friends",
        targets: [
          {
            npcId: "chu-tuu-lau",
            lineKey: "quests.tanThu3.talk.tavern",
            reward: { exp: 100 }
          },
          {
            npcId: "tieu-su",
            lineKey: "quests.tanThu3.talk.escort",
            reward: { exp: 100 }
          }
        ]
      }
    ],
    reward: { exp: 1400, bac: 150 }
  },

  {
    id: "tan-thu-4",
    order: 4,
    minLevel: 8,
    giver: "da-tau",
    turnIn: "da-tau",
    titleKey: "quests.tanThu4.title",
    introKey: "quests.tanThu4.intro",
    progressKey: "quests.tanThu4.progress",
    turnInKey: "quests.tanThu4.turnIn",
    objectives: [
      {
        id: "scholar",
        type: "talk",
        labelKey: "quests.tanThu4.objective.scholar",
        targets: [
          {
            npcId: "bach-hieu-sinh",
            lineKey: "quests.tanThu4.talk.scholar",
            reward: { exp: 300 }
          }
        ]
      }
    ],
    reward: { exp: 1100, bac: 80, items: [{ id: "kim-sang-duoc", qty: 20 }] }
  },

  {
    id: "tan-thu-5",
    order: 5,
    minLevel: 9,
    giver: "da-tau",
    turnIn: "da-tau",
    titleKey: "quests.tanThu5.title",
    introKey: "quests.tanThu5.intro",
    progressKey: "quests.tanThu5.progress",
    turnInKey: "quests.tanThu5.turnIn",
    objectives: [
      {
        id: "story",
        type: "talk",
        labelKey: "quests.tanThu5.objective.story",
        targets: [
          {
            npcId: "da-tau",
            lineKey: "quests.tanThu5.talk.daTau",
            reward: { exp: 300 }
          }
        ]
      }
    ],
    reward: { exp: 1700, bac: 200 }
  },

  {
    id: "tan-thu-6",
    order: 6,
    minLevel: 10,
    giver: "da-tau",
    turnIn: "trieu-dien-nien",
    titleKey: "quests.tanThu6.title",
    introKey: "quests.tanThu6.intro",
    progressKey: "quests.tanThu6.progress",
    turnInKey: "quests.tanThu6.turnIn",
    acceptReward: { items: [{ id: "thu-cua-da-tau", qty: 1 }] },
    objectives: [
      {
        id: "letter",
        type: "talk",
        labelKey: "quests.tanThu6.objective.letter",
        targets: [
          {
            npcId: "trieu-dien-nien",
            lineKey: "quests.tanThu6.talk.trieuDienNien",
            reward: { exp: 0 }
          }
        ]
      }
    ],
    consumeOnTurnIn: [{ id: "thu-cua-da-tau", qty: 1 }],
    reward: { exp: 1500, bac: 500, items: [{ id: "nu-nhi-hong", qty: 10 }] }
  }
]);

/** Quest ids in chain order. */
export const QUEST_CHAIN = QUESTS.map((quest) => quest.id);

/** @type {Readonly<Record<string, QuestDefinition>>} */
export const QUEST_BY_ID = Object.freeze(
  Object.fromEntries(QUESTS.map((quest) => [quest.id, quest]))
);

/**
 * @param {string} id
 * @returns {QuestDefinition|null}
 */
export function questById(id) {
  return typeof id === "string" ? QUEST_BY_ID[id] || null : null;
}

/**
 * The quest that follows `id`, or null at the end of the chain.
 * @param {string} id
 * @returns {QuestDefinition|null}
 */
export function nextQuest(id) {
  const index = QUEST_CHAIN.indexOf(id);
  if (index < 0 || index === QUEST_CHAIN.length - 1) return null;
  return QUEST_BY_ID[QUEST_CHAIN[index + 1]];
}

/**
 * The quest before `id`, or null for the first quest.
 * @param {string} id
 * @returns {QuestDefinition|null}
 */
export function previousQuest(id) {
  const index = QUEST_CHAIN.indexOf(id);
  if (index <= 0) return null;
  return QUEST_BY_ID[QUEST_CHAIN[index - 1]];
}

/**
 * Total EXP every quest payout grants (talk targets + turn-in). Accept rewards
 * carry items only, so they do not contribute.
 * @param {QuestDefinition} quest
 * @returns {number}
 */
export function questTotalExp(quest) {
  const targetExp = (quest.objectives || []).reduce(
    (sum, objective) =>
      sum + (objective.targets || []).reduce((inner, target) => inner + (target.reward?.exp || 0), 0),
    0
  );
  return targetExp + (quest.reward?.exp || 0);
}
