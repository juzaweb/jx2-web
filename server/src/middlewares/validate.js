const PLAYER_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_NAME_LENGTH = 50;

/**
 * Validate playerId param
 */
export const validatePlayerId = (req, res, next) => {
  const { playerId } = req.params;
  if (!playerId || !PLAYER_ID_REGEX.test(playerId)) {
    return res.status(400).json({
      success: false,
      error: "Mã người chơi (playerId) không hợp lệ. Chỉ chấp nhận chữ, số, gạch ngang và gạch dưới (1-64 ký tự)."
    });
  }
  next();
};

/**
 * Validate Inventory update payload
 */
export const validateInventoryPayload = (req, res, next) => {
  const body = req.body;
  const inventory = body.inventory !== undefined ? body.inventory : body;

  if (!inventory || typeof inventory !== "object" || Array.isArray(inventory)) {
    return res.status(400).json({
      success: false,
      error: "Dữ liệu inventory không hợp lệ. Phải là một object dạng { [itemId]: quantity } hoặc { inventory: { ... } }."
    });
  }

  for (const [itemId, qty] of Object.entries(inventory)) {
    if (typeof qty !== "number" || !Number.isFinite(qty) || qty < 0) {
      return res.status(400).json({
        success: false,
        error: `Số lượng vật phẩm '${itemId}' phải là số không âm hợp lệ.`
      });
    }
  }

  req.validatedInventory = inventory;
  next();
};

/**
 * Validate Leaderboard score submission payload
 */
export const validateLeaderboardPayload = (req, res, next) => {
  const { playerId, playerName, level, kills, coins, exp } = req.body || {};

  if (!playerId || typeof playerId !== "string" || !PLAYER_ID_REGEX.test(playerId)) {
    return res.status(400).json({
      success: false,
      error: "Mã người chơi (playerId) không hợp lệ (1-64 ký tự chữ, số, gạch ngang, gạch dưới)."
    });
  }

  if (playerName !== undefined && (typeof playerName !== "string" || playerName.length > MAX_NAME_LENGTH)) {
    return res.status(400).json({
      success: false,
      error: `Tên người chơi (playerName) phải là chuỗi tối đa ${MAX_NAME_LENGTH} ký tự.`
    });
  }

  const numericFields = { level, kills, coins, exp };
  for (const [key, val] of Object.entries(numericFields)) {
    if (val !== undefined && (typeof val !== "number" || !Number.isFinite(val) || val < 0)) {
      return res.status(400).json({
        success: false,
        error: `Trường ${key} phải là số không âm hợp lệ.`
      });
    }
  }

  next();
};
