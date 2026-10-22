import express from "express";
import cors from "cors";
import { config } from "./config.js";
import healthRoutes from "./routes/health.routes.js";
import leaderboardRoutes from "./routes/leaderboard.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import userRoutes from "./routes/user.routes.js";
import characterRoutes from "./routes/character.routes.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";

export const createApp = () => {
  const app = express();

  // Security hardening: hide Express framework signature
  app.disable("x-powered-by");

  // Secure CORS setup
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server, curl, same-origin)
      if (!origin) {
        return callback(null, true);
      }

      const rawOrigins = config.clientOrigin || "*";
      const allowedOrigins = rawOrigins
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      if (allowedOrigins.includes("*")) {
        // Wildcard origin: forbid dynamic origin reflection in production when credentials are enabled
        if (config.env === "production") {
          return callback(null, false);
        }
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
  }));

  // JSON Body Parser
  app.use(express.json({ limit: "1mb" }));

  // Request Logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (process.env.NODE_ENV !== "test") {
        console.log(`[API] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
      }
    });
    next();
  });

  // Mount API Routes
  app.use("/api", healthRoutes);
  app.use("/api", leaderboardRoutes);
  app.use("/api", inventoryRoutes);
  app.use("/api", userRoutes);
  app.use("/api", characterRoutes);

  // Fallbacks
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
