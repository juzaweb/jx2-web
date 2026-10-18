import { store } from "../data/store.js";

export const getLeaderboard = async (req, res, next) => {
  try {
    const { sortBy = "level", limit = 10 } = req.query;
    const leaderboard = await store.getLeaderboard(sortBy, limit);

    res.json({
      success: true,
      data: {
        sortBy,
        total: leaderboard.length,
        rankings: leaderboard
      }
    });
  } catch (err) {
    next(err);
  }
};

export const submitScore = async (req, res, next) => {
  try {
    const { playerId, playerName, level, kills, coins, exp } = req.body;

    const safePlayerName = (typeof playerName === "string" && playerName.trim())
      ? playerName.trim().slice(0, 50)
      : `Thiếu Hiệp ${playerId.slice(0, 5)}`;

    const entry = {
      playerId,
      playerName: safePlayerName,
      level: Math.max(1, Math.floor(Number(level) || 1)),
      kills: Math.max(0, Math.floor(Number(kills) || 0)),
      coins: Math.max(0, Math.floor(Number(coins) || 0)),
      exp: Math.max(0, Math.floor(Number(exp) || 0)),
      updatedAt: Date.now()
    };

    const updated = await store.updateLeaderboardEntry(entry);

    res.json({
      success: true,
      message: "Cập nhật bảng xếp hạng thành công",
      data: updated
    });
  } catch (err) {
    next(err);
  }
};
