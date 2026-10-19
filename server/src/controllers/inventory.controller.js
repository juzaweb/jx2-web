import { store } from "../data/playerDb.js";

export const getInventory = async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const inventory = await store.getInventory(playerId);

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
