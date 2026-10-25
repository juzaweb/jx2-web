import { store } from "../data/playerDb.js";
import { characterDb } from "../data/characterDb.js";
import { userDb } from "../data/userDb.js";

export const getInventory = async (req, res, next) => {
  try {
    const { playerId } = req.params;
    let inventory = await store.getInventory(playerId);

    const ownerId = characterDb.getOwner(playerId);
    if (ownerId && userDb.isAdmin(ownerId)) {
      if (!inventory["lenh-bai-gm"]) {
        inventory = { ...inventory, "lenh-bai-gm": 1 };
        await store.setInventory(playerId, inventory);
      }
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

export const updateInventory = async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const inventory = req.validatedInventory || req.body.inventory || req.body;

    const updated = await store.setInventory(playerId, inventory);

    res.json({
      success: true,
      message: "Cập nhật túi đồ thành công",
      data: {
        playerId,
        inventory: updated
      }
    });
  } catch (err) {
    next(err);
  }
};
