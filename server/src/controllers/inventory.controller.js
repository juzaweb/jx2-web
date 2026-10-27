import { characterDb } from "../data/characterDb.js";
import { userDb } from "../data/userDb.js";
import { syncCommandTokens } from "../game/commandTokens.js";

export const getInventory = (req, res, next) => {
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

    const inventory = syncCommandTokens(playerId, { isAdmin: userDb.isAdmin(ownerId) });

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
