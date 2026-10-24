export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  const statusCode = err.statusCode || 500;
  const isProd = process.env.NODE_ENV === "production";

  // Security hardening: hide internal 500 error details in production to avoid info leakage
  const message =
    isProd && statusCode === 500
      ? "Đã xảy ra lỗi máy chủ nội bộ"
      : err.message || "Đã xảy ra lỗi máy chủ nội bộ";

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(!isProd && { stack: err.stack })
  });
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint không tồn tại: ${req.method} ${req.originalUrl}`
  });
};
