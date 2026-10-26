import { store } from "../data/playerDb.js";
import { characterDb } from "../data/characterDb.js";
import { userDb } from "../data/userDb.js";

export const getInventory = async (req, res, next) => {
  try {
    const { playerId } = req.params;

    // Only the owning account may read a character's bag.
    const ownerId = characterDb.getOwner(playerId);
    if (!ownerId || ownerId !== req.userId) {
      return res.status(403).json({
        success: false,
        error: "Bạn không có quyền truy cập túi đồ của nhân vật này."
      });
    }

    let inventory = await store.getInventory(playerId);

    if (userDb.isAdmin(ownerId) && !inventory["lenh-bai-gm"]) {
      inventory = { ...inventory, "lenh-bai-gm": 1 };
      await store.setInventory(playerId, inventory);
    }

    res.json({
      success: true,
      data: {
        playerId,
        inventory
      }
    });
  } catch (err) {
    next(err);
  }
};
