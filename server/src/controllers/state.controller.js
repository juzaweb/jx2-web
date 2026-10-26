/**
 * One-time import of a legacy local save (bag + worn gear).
 *
 * Before the server owned the bag, the browser stored it in localStorage and
 * pushed it through `PUT /api/inventory`. That endpoint is gone; this one lets an
 * existing player carry their items over exactly once, authenticated and
 * validated against the shared catalog.
 */

import { store } from "../data/playerDb.js";
import { characterDb } from "../data/characterDb.js";
import { sanitizeEquipment } from "../../../src/game/equipment.js";
import { normalizeBag, readBag, readEquipment, writeBag, writeEquipment } from "../game/playerBag.js";

/**
 * Merge two bags, taking the larger stack per item. The server bag already holds
 * the starter kit, so summing would duplicate it; taking the max carries the
 * legacy stacks without minting free units.
 * @param {Record<string, number>} serverBag
 * @param {Record<string, number>} importedBag
 * @returns {Record<string, number>}
 */
const mergeBags = (serverBag, importedBag) => {
  const merged = { ...serverBag };
  for (const [id, qty] of Object.entries(importedBag)) {
    merged[id] = Math.max(merged[id] || 0, qty);
  }
  return merged;
};

export const importState = async (req, res, next) => {
  try {
    const userId = req.userId;
    const characterId = typeof req.body?.characterId === "string" ? req.body.characterId : "";

    if (!characterId || !characterDb.ownsCharacter(userId, characterId)) {
      return res.status(403).json({
        success: false,
        error: "Nhân vật không thuộc tài khoản này."
      });
    }

    if (store.isStateImported(characterId)) {
      return res.json({
        success: true,
        imported: false,
        data: {
          characterId,
          inventory: readBag(characterId),
          equipment: readEquipment(characterId)
        }
      });
    }

    const importedBag = normalizeBag(req.body?.inventory);
    const importedEquipment = sanitizeEquipment(req.body?.equipment);

    const inventory = writeBag(characterId, mergeBags(readBag(characterId), importedBag));
    // Only slots the legacy save actually filled may win: `sanitizeEquipment`
    // returns every slot (null when absent), so spreading it wholesale would
    // unequip gear the server already had.
    const equipment = { ...readEquipment(characterId) };
    for (const [slot, itemId] of Object.entries(importedEquipment)) {
      if (typeof itemId === "string") equipment[slot] = itemId;
    }
    const writtenEquipment = writeEquipment(characterId, equipment);

    store.markStateImported(characterId);

    res.json({
      success: true,
      imported: true,
      data: { characterId, inventory, equipment: writtenEquipment }
    });
  } catch (err) {
    next(err);
  }
};
