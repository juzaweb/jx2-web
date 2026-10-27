import { createApp } from "./app.js";
import { config } from "./config.js";
import { initGameSocket } from "./websocket/gameSocket.js";
import { store as playerStore } from "./data/playerDb.js";
import { characterDb } from "./data/characterDb.js";
import { userDb } from "./data/userDb.js";
import { isTestMode } from "../../src/game/testMode.js";

const app = createApp();

/**
 * `node --watch` restarts the API on every edit, so the previous process may
 * still be holding the port. Retry briefly instead of crashing the whole dev
 * session with EADDRINUSE.
 */
const MAX_LISTEN_RETRIES = 25;
const LISTEN_RETRY_DELAY_MS = 200;

let server = null;
let gameSocket = null;
let listenAttempt = 0;

const logBanner = () => {
  console.log("==========================================");
  console.log(`🚀 Giang Ho API Server is running!`);
  console.log(`🌐 Local URL: http://localhost:${config.port}`);
  console.log(`🩺 Health:    http://localhost:${config.port}/api/health`);
  console.log(`🏆 Leader:    http://localhost:${config.port}/api/leaderboard`);
  console.log(`⚡ WebSocket: ws://localhost:${config.port}/ws`);
  console.log(`🗄️  Database:  ${config.dbPath}`);
  console.log("==========================================");

  // Test mode removes the skill cost gates and hands every character the GM
  // panel token, so a server that boots with it on is not a normal economy.
  if (isTestMode()) {
    console.warn("⚠️  TEST MODE IS ON: skills are free and every character holds the test GM token.");
    if (config.env === "production") {
      console.warn(
        "🚨 TEST MODE IS ON IN PRODUCTION: every player can use GM actions. Unset TEST_MODE / VITE_TEST_MODE."
      );
    }
  }
};

const listen = () => {
  server = app.listen(config.port, config.host, () => {
    logBanner();
    gameSocket = initGameSocket(server);
  });

  server.on("error", (error) => {
    if (error.code !== "EADDRINUSE" || listenAttempt >= MAX_LISTEN_RETRIES) {
      console.error(`\n[Server] Không thể khởi động: ${error.message}`);
      process.exit(1);
    }

    listenAttempt += 1;
    console.warn(
      `[Server] Cổng ${config.port} còn bận (lần thử ${listenAttempt}/${MAX_LISTEN_RETRIES}), thử lại sau ${LISTEN_RETRY_DELAY_MS}ms...`
    );
    setTimeout(listen, LISTEN_RETRY_DELAY_MS);
  });
};

listen();

/**
 * Close every SQLite handle so a restarting process never finds the file still
 * locked by this one.
 */
const closeDatabases = () => {
  for (const db of [playerStore, characterDb, userDb]) {
    try {
      db.close();
    } catch (error) {
      console.error(`[Server] Lỗi khi đóng database: ${error.message}`);
    }
  }
};

const handleShutdown = (signal) => {
  console.log(`\n[Server] Nhận tín hiệu ${signal}. Đang đóng server...`);
  if (gameSocket) gameSocket.close();

  if (!server || !server.listening) {
    closeDatabases();
    process.exit(0);
  }

  server.close(() => {
    console.log("[Server] Server đã đóng an toàn.");
    closeDatabases();
    process.exit(0);
  });

  // Force shutdown if taking too long
  setTimeout(() => {
    console.error("[Server] Đóng server cưỡng chế sau timeout.");
    closeDatabases();
    process.exit(1);
  }, 5000).unref();
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
