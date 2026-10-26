import { verifySessionToken } from "../auth/session.js";

/**
 * Middleware to require a valid session token and optionally verify parameter ownership
 */
export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== "string") {
    return res.status(401).json({
      success: false,
      error: "Yêu cầu xác thực tài khoản."
    });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      success: false,
      error: "Định dạng token xác thực không hợp lệ."
    });
  }

  const token = parts[1];
  const userId = verifySessionToken(token);

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."
    });
  }

  req.userId = userId;

  // Ownership check if route contains a userId parameter
  if (req.params.userId && req.params.userId !== userId) {
    return res.status(403).json({
      success: false,
      error: "Bạn không có quyền truy cập thông tin của người dùng khác."
    });
  }

  next();
};
