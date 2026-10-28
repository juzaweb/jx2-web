import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// The player DB opens its file at import time, so point it at a throwaway path
// before the dynamic import.
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "jx2-quest-test-"));
process.env.DB_PATH = path.join(dir, "quest.sqlite");
process.env.NODE_ENV = "test";

const { PlayerDatabase } = await import("../src/data/playerDb.js");
const { acceptQuest, emptyQuestState, recordTalk, turnInQuest } = await import(
  "../../src/game/quests/state.js"
);
const { questById } = await import("../../src/game/quests/catalog.js");

test.after(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

test("quest state survives a database round-trip", () => {
  const db = new PlayerDatabase(":memory:");
  const quest = questById("tan-thu-1");

  const empty = db.getQuestState("char_quest");
  assert.equal(empty.activeId, null);
  assert.deepEqual(empty.completed, []);

  const accepted = acceptQuest(emptyQuestState(), quest, 1).state;
  db.setQuestState("char_quest", accepted);

  const loaded = db.getQuestState("char_quest");
  assert.equal(loaded.activeId, "tan-thu-1");
  assert.equal(loaded.version, 1);

  // A full playthrough persists the completed chain.
  let state = loaded;
  for (const target of quest.objectives[0].targets) {
    state = recordTalk(state, quest, target.npcId).state;
  }
  const done = turnInQuest(state, quest).state;
  db.setQuestState("char_quest", done);

  assert.deepEqual(db.getQuestState("char_quest").completed, ["tan-thu-1"]);
  assert.equal(db.getQuestState("char_quest").activeId, null);
  db.close();
});

test("malformed stored quest JSON is normalized, never thrown", () => {
  const db = new PlayerDatabase(":memory:");
  db.setProgress("char_junk", { level: 1, exp: 0, coins: 0, kills: 0 });
  db.db
    .prepare("UPDATE saves SET quest_state = ? WHERE player_id = ?")
    .run('{"activeId":"not-a-quest","completed":["tan-thu-1"],"objectives":[]}', "char_junk");

  const state = db.getQuestState("char_junk");
  assert.equal(state.activeId, null);
  assert.deepEqual(state.completed, ["tan-thu-1"]);
  db.close();
});

test("the legacy reward flag seeds the first quest as completed", async () => {
  const legacyPath = path.join(dir, "legacy.sqlite");
  const first = new PlayerDatabase(legacyPath);
  first.setProgress("char_legacy", { level: 1, exp: 0, coins: 0, kills: 0 });
  first.db
    .prepare("UPDATE saves SET quest_rewarded = 1, quest_state = '{}' WHERE player_id = ?")
    .run("char_legacy");
  first.db.exec("PRAGMA user_version = 7");
  first.close();

  const reopened = new PlayerDatabase(legacyPath);
  assert.deepEqual(reopened.getQuestState("char_legacy").completed, ["tan-thu-1"]);
  reopened.close();
});
