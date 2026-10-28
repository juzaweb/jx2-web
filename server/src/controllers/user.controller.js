import { userDb } from "../data/userDb.js";
import { createSessionToken } from "../auth/session.js";

/**
 * Handle user registration
 */
export const registerUser = async (req, res, next) => {
  try {
    const { username, password, displayName } = req.body || {};

    if (
      !username ||
      !password ||
      typeof username !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        error: "Vui lòng nhập đầy đủ tài khoản và mật khẩu hợp lệ."
      });
    }

    const user = await userDb.register(username, password, displayName);
    const token = createSessionToken(user.id);

    return res.status(201).json({
      success: true,
      message: "Đăng ký tài khoản thành công!",
      data: {
        user,
        token
      }
    });
  } catch (error) {
    if (error.code === "USER_EXISTS") {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }
    if (error.code === "INVALID_USERNAME" || error.code === "INVALID_PASSWORD") {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
};

/**
 * Handle user login
 */
export const loginUser = async (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    if (
      !username ||
      !password ||
      typeof username !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        error: "Vui lòng nhập đầy đủ tài khoản và mật khẩu hợp lệ."
      });
    }

    const user = await userDb.login(username, password);
    const token = createSessionToken(user.id);

    return res.status(200).json({
      success: true,
      message: "Đăng nhập thành công!",
      data: {
        user,
        token
      }
    });
  } catch (error) {
    if (error.code === "INVALID_CREDENTIALS") {
      return res.status(401).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
};

/**
 * Get current user profile
 */
export const getProfile = async (req, res, next) => {
  try {
    const requestedUserId = req.query.userId || req.headers["x-user-id"];

    // Verify ownership if a specific userId parameter or header was passed
    if (requestedUserId && requestedUserId !== req.userId) {
      return res.status(403).json({
        success: false,
        error: "Bạn không có quyền truy cập thông tin của người dùng khác."
      });
    }

    const userId = req.userId || requestedUserId;
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "Thiếu thông tin nhận diện người dùng (userId)."
      });
    }

    const user = userDb.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy thông tin tài khoản."
      });
    }

    return res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if a username is available for registration
 */
export const checkUsernameAvailability = async (req, res, next) => {
  try {
    const username = (req.query.username || "").trim();
    if (!username) {
      return res.status(400).json({
        success: false,
        error: "Thiếu tham số tên tài khoản."
      });
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return res.status(200).json({
        success: true,
        data: {
          available: false,
          reason: "Tài khoản phải gồm 3-30 ký tự chữ cái, số hoặc dấu gạch dưới."
        }
      });
    }

    const taken = userDb.hasUsername(username);
    return res.status(200).json({
      success: true,
      data: {
        available: !taken,
        reason: taken ? "Tài khoản này đã có người đăng ký." : "Tài khoản có thể sử dụng."
      }
    });
  } catch (error) {
    next(error);
  }
};

