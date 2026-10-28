import { describe, expect, it } from "vitest";

import { NPC_SPRITES } from "./npc.js";
import { CITY_NPC_IDENTITIES, cityNpc } from "./npcRoster.js";

describe("city NPC roster", () => {
  it("gives every identity a name, a known role and a real sprite sheet", () => {
    for (const [id, identity] of Object.entries(CITY_NPC_IDENTITIES)) {
      expect(identity.name, id).toBeTruthy();
      expect(["quest", "service"], id).toContain(identity.role);
      expect(NPC_SPRITES, `${id} sprite "${identity.sprite}"`).toHaveProperty(identity.sprite);
    }
  });

  it("keeps the pharmacy as the only shop counter", () => {
    for (const [id, identity] of Object.entries(CITY_NPC_IDENTITIES)) {
      if (id === "duoc-su") expect(identity.shop).toBe("pharmacy");
      else expect(identity.shop, id).toBeUndefined();
    }
  });

  it("places a copy, so callers cannot mutate the shared identity", () => {
    const first = cityNpc("da-tau", 10, 20);
    expect(first).toMatchObject({ id: "da-tau", x: 10, y: 20 });
    expect(first.name).toBe(CITY_NPC_IDENTITIES["da-tau"].name);

    first.name = "Hacked";
    expect(cityNpc("da-tau", 0, 0).name).toBe(CITY_NPC_IDENTITIES["da-tau"].name);
  });

  it("merges map-specific fields such as a building reference", () => {
    const npc = cityNpc("duoc-su", 1, 2, { building: "thuc-duoc-diem" });
    expect(npc).toMatchObject({
      id: "duoc-su",
      shop: "pharmacy",
      building: "thuc-duoc-diem",
      x: 1,
      y: 2
    });
  });

  it("rejects an unknown NPC id instead of spawning a nameless sprite", () => {
    expect(() => cityNpc("khong-ton-tai", 0, 0)).toThrow(TypeError);
  });
});
