import { createApp } from "./app.js";
import { config } from "./config.js";
import { initGameSocket } from "./websocket/gameSocket.js";

const app = createApp();

const server = app.listen(config.port, config.host, () => {
  console.log("==========================================");
  console.log(`🚀 Giang Ho API Server is running!`);
  console.log(`🌐 Local URL: http://localhost:${config.port}`);
  console.log(`🩺 Health:    http://localhost:${config.port}/api/health`);
  console.log(`🏆 Leader:    http://localhost:${config.port}/api/leaderboard`);
  console.log(`⚡ WebSocket: ws://localhost:${config.port}/ws`);
  console.log(`🗄️  Database:  ${config.dbPath}`);
  console.log("==========================================");
});

const gameSocket = initGameSocket(server);

const handleShutdown = (signal) => {
  console.log(`\n[Server] Nhận tín hiệu ${signal}. Đang đóng server...`);
  gameSocket.close();
  server.close(() => {
    console.log("[Server] Server đã đóng an toàn.");
    process.exit(0);
  });

  // Force shutdown if taking too long
  setTimeout(() => {
    console.error("[Server] Đóng server cưỡng chế sau timeout.");
    process.exit(1);
  }, 5000).unref();
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
