import { store } from "../data/playerDb.js";

export const getLeaderboard = async (req, res, next) => {
  try {
    const { sortBy = "level", limit = 10 } = req.query;
    const leaderboard = await store.getLeaderboard(sortBy, limit);
    const total = await store.countLeaderboard();

    res.json({
      success: true,
      data: {
        sortBy,
        total,
        rankings: leaderboard
      }
    });
  } catch (err) {
    next(err);
  }
};
