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
        maxSlots: MAX_CHARACTER_SLOTS
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

    const { name, sect } = req.body || {};
    const character = characterDb.create(userId, name, sect);

    return res.status(201).json({
      success: true,
      message: "Tạo nhân vật thành công!",
      data: {
        character,
        maxSlots: MAX_CHARACTER_SLOTS
      }
    });
  } catch (error) {
    if (
      error.code === "INVALID_NAME" ||
      error.code === "INVALID_USER" ||
      error.code === "INVALID_SECT"
    ) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error.code === "NAME_TAKEN" || error.code === "SLOT_LIMIT") {
      return res.status(409).json({ success: false, error: error.message });
    }
    next(error);
  }
};

/**
 * Permanently delete a character.
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

    const deleted = characterDb.remove(userId, characterId);
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
        characters: characterDb.listByUser(userId)
      }
    });
  } catch (error) {
    next(error);
  }
};
