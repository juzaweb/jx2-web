import { characterDb, isValidUserId, MAX_CHARACTER_SLOTS } from "../data/characterDb.js";

/**
 * List active characters owned by a user.
 */
export const listCharacters = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isValidUserId(userId)) {
      return res.status(400).json({
        success: false,
        error: "Mã tài khoản (userId) không hợp lệ."
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        characters: characterDb.listByUser(userId),
        maxSlots: MAX_CHARACTER_SLOTS,
        deletedCount: characterDb.countDeletedByUser(userId)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new character for a user.
 */
export const createCharacter = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isValidUserId(userId)) {
      return res.status(400).json({
        success: false,
        error: "Mã tài khoản (userId) không hợp lệ."
      });
    }

    const { name, gender, appearance } = req.body || {};
    const character = characterDb.create(userId, name, gender, appearance);

    return res.status(201).json({
      success: true,
      message: "Tạo nhân vật thành công!",
      data: {
        character,
        maxSlots: MAX_CHARACTER_SLOTS
      }
    });
  } catch (error) {
    if (error.code === "INVALID_NAME" || error.code === "INVALID_USER" || error.code === "INVALID_GENDER") {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error.code === "NAME_TAKEN" || error.code === "SLOT_LIMIT") {
      return res.status(409).json({ success: false, error: error.message });
    }
    next(error);
  }
};

/**
 * Soft-delete a character so it can be restored later.
 */
export const deleteCharacter = async (req, res, next) => {
  try {
    const { userId, characterId } = req.params;
    if (!isValidUserId(userId) || !characterId) {
      return res.status(400).json({
        success: false,
        error: "Thông tin xoá nhân vật không hợp lệ."
      });
    }

    const deleted = characterDb.softDelete(userId, characterId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy nhân vật để xoá."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Đã xoá nhân vật.",
      data: {
        characters: characterDb.listByUser(userId),
        deletedCount: characterDb.countDeletedByUser(userId)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Restore the most recently deleted character for a user.
 */
export const restoreCharacter = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isValidUserId(userId)) {
      return res.status(400).json({
        success: false,
        error: "Mã tài khoản (userId) không hợp lệ."
      });
    }

    const character = characterDb.restoreLast(userId);
    if (!character) {
      return res.status(404).json({
        success: false,
        error: "Không có nhân vật nào để khôi phục."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Khôi phục nhân vật thành công!",
      data: {
        character,
        characters: characterDb.listByUser(userId),
        deletedCount: characterDb.countDeletedByUser(userId)
      }
    });
  } catch (error) {
    if (error.code === "SLOT_LIMIT" || error.code === "NAME_TAKEN") {
      return res.status(409).json({ success: false, error: error.message });
    }
    next(error);
  }
};
