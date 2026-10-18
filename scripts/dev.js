import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Ports configuration (supports environment variables or defaults)
const baseBackendPort = parseInt(process.env.PORT, 10) || 5000;
const baseFrontendPort =
  parseInt(process.env.VITE_PORT || process.env.CLIENT_PORT, 10) || 3000;
const MAX_PORT_SCAN = 20;

/**
 * Check whether a port is free on both IPv4 and IPv6 loopback.
 */
const isPortFree = (port) =>
  new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "0.0.0.0");
  });

/**
 * Find the first free port starting at `startPort`.
 */
const findAvailablePort = async (startPort) => {
  for (let port = startPort; port < startPort + MAX_PORT_SCAN; port += 1) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(
    `No free port found between ${startPort} and ${startPort + MAX_PORT_SCAN - 1}`
  );
};

const backendPort = await findAvailablePort(baseBackendPort);
const frontendPort = await findAvailablePort(baseFrontendPort);
const apiBase =
  process.env.VITE_API_BASE || `http://localhost:${backendPort}/api`;

console.log("\x1b[1m\x1b[32m%s\x1b[0m", "====================================================");
console.log("\x1b[1m\x1b[32m%s\x1b[0m", "   Giang Hồ (jx2-web) — Dev Environment Launcher   ");
console.log("\x1b[1m\x1b[32m%s\x1b[0m", "====================================================");
if (backendPort !== baseBackendPort) {
  console.log(
    `[Config] Backend API Port  : \x1b[36m${backendPort}\x1b[0m \x1b[90m(port ${baseBackendPort} busy, auto-shifted)\x1b[0m`
  );
} else {
  console.log(`[Config] Backend API Port  : \x1b[36m${backendPort}\x1b[0m`);
}
if (frontendPort !== baseFrontendPort) {
  console.log(
    `[Config] Frontend Web Port : \x1b[33m${frontendPort}\x1b[0m \x1b[90m(port ${baseFrontendPort} busy, auto-shifted)\x1b[0m`
  );
} else {
  console.log(`[Config] Frontend Web Port : \x1b[33m${frontendPort}\x1b[0m`);
}
console.log(`[Config] Client API Base   : \x1b[35m${apiBase}\x1b[0m`);
console.log("----------------------------------------------------\n");

/**
 * Pipe process output with colored prefix
 */
const pipeOutput = (child, prefix, colorCode) => {
  const formatData = (data) => {
    const lines = data.toString().split("\n");
    for (const line of lines) {
      if (line.trim().length > 0) {
        console.log(`${colorCode}${prefix}\x1b[0m ${line}`);
      }
    }
  };

  child.stdout.on("data", formatData);
  child.stderr.on("data", formatData);
};

// 1. Launch Backend API (Node with watch mode)
const backend = spawn(
  process.execPath,
  ["--watch", path.join(rootDir, "server/src/index.js")],
  {
    cwd: path.join(rootDir, "server"),
    env: {
      ...process.env,
      PORT: String(backendPort),
      NODE_ENV: "development",
    },
    stdio: ["ignore", "pipe", "pipe"],
  }
);

pipeOutput(backend, `[API ${backendPort}]`, "\x1b[36m");

// 2. Launch Frontend (Vite)
const viteBin = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");
const frontend = spawn(
  process.execPath,
  [viteBin, "--port", String(frontendPort)],
  {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(backendPort),
      VITE_PORT: String(frontendPort),
      VITE_API_BASE: apiBase,
    },
    stdio: ["ignore", "pipe", "pipe"],
  }
);

pipeOutput(frontend, `[GAME ${frontendPort}]`, "\x1b[33m");

// Graceful cleanup on exit
const cleanup = () => {
  console.log("\n\x1b[31m[Launcher] Shutting down services...\x1b[0m");
  try {
    backend.kill("SIGTERM");
  } catch {}
  try {
    frontend.kill("SIGTERM");
  } catch {}
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

backend.on("exit", (code) => {
  if (code !== null && code !== 0) {
    console.error(`\x1b[31m[API] Backend exited with code ${code}\x1b[0m`);
  }
});

frontend.on("exit", (code) => {
  if (code !== null && code !== 0) {
    console.error(`\x1b[31m[GAME] Frontend exited with code ${code}\x1b[0m`);
  }
});
