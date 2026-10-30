import { store } from "../data/playerDb.js";

const ALLOWED_SORT_FIELDS = ["level", "kills", "coins", "exp"];

export const getLeaderboard = async (req, res, next) => {
  try {
    const rawSortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : "level";
    const sortBy = ALLOWED_SORT_FIELDS.includes(rawSortBy) ? rawSortBy : "level";

    const rawLimit = parseInt(req.query.limit, 10);
    const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 10;

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
