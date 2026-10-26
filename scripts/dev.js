import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// CLI arguments parsing and forward support for Vite
const rawArgs = process.argv.slice(2);
const viteForwardArgs = [];

let cliFrontendPort = null;
let isHostEnabled = Boolean(process.env.HOST);
let hostValue = process.env.HOST || null;

for (let i = 0; i < rawArgs.length; i += 1) {
  const arg = rawArgs[i];

  if (arg === "--host") {
    isHostEnabled = true;
    const nextArg = rawArgs[i + 1];
    if (nextArg && !nextArg.startsWith("-")) {
      hostValue = nextArg;
      viteForwardArgs.push(arg, nextArg);
      i += 1;
    } else {
      viteForwardArgs.push(arg);
    }
  } else if (arg.startsWith("--host=")) {
    isHostEnabled = true;
    hostValue = arg.slice("--host=".length);
    viteForwardArgs.push(arg);
  } else if (arg === "--port") {
    const nextArg = rawArgs[i + 1];
    if (nextArg && !nextArg.startsWith("-")) {
      const parsed = parseInt(nextArg, 10);
      if (!Number.isNaN(parsed)) cliFrontendPort = parsed;
      i += 1;
    }
  } else if (arg.startsWith("--port=")) {
    const parsed = parseInt(arg.slice("--port=".length), 10);
    if (!Number.isNaN(parsed)) cliFrontendPort = parsed;
  } else {
    viteForwardArgs.push(arg);
  }
}

// If HOST env var was set but --host flag was not passed in args, inject it
const hasHostInForwardArgs = viteForwardArgs.some(
  (arg) => arg === "--host" || arg.startsWith("--host=")
);
if (isHostEnabled && !hasHostInForwardArgs) {
  if (hostValue && hostValue !== "true") {
    viteForwardArgs.push(`--host=${hostValue}`);
  } else {
    viteForwardArgs.push("--host");
  }
}

// Ports configuration (supports environment variables or defaults)
const baseBackendPort = parseInt(process.env.PORT, 10) || 5000;
const baseFrontendPort =
  cliFrontendPort ||
  parseInt(process.env.VITE_PORT || process.env.CLIENT_PORT, 10) ||
  3000;
const MAX_PORT_SCAN = 20;

/**
 * Detect the primary non-internal IPv4 address for LAN access.
 */
const getLanIp = () => {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
  } catch {
    // Ignore interface discovery errors
  }
  return null;
};

/**
 * Check whether a port is free on the given loopback address.
 */
const isAddressFree = (port, host) =>
  new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, host);
  });

/**
 * Check whether a port is free on both IPv4 and IPv6 loopback.
 *
 * We bind the loopback addresses explicitly instead of 0.0.0.0 because on
 * Windows a wildcard bind succeeds even when another process already owns
 * 127.0.0.1:<port> — that hides real conflicts (e.g. OrcaSlicer listening on
 * 127.0.0.1:5000 swallowed every request to localhost:5000).
 */
const isPortFree = async (port) => {
  for (const host of ["127.0.0.1", "::1"]) {
    if (!(await isAddressFree(port, host))) return false;
  }
  return true;
};

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

const lanIp = getLanIp();
const backendPort = await findAvailablePort(baseBackendPort);
const frontendPort = await findAvailablePort(baseFrontendPort);
const apiBase =
  process.env.VITE_API_BASE ||
  (isHostEnabled ? "/api" : `http://localhost:${backendPort}/api`);

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
if (isHostEnabled) {
  const displayHost = hostValue && hostValue !== "true" ? hostValue : "0.0.0.0";
  console.log(`[Config] Network Host      : \x1b[32m${displayHost}\x1b[0m`);
  if (lanIp) {
    console.log(`[Config] Network URL       : \x1b[1m\x1b[32mhttp://${lanIp}:${frontendPort}\x1b[0m`);
  }
}
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
const viteArgs = [viteBin, "--port", String(frontendPort), ...viteForwardArgs];
const frontend = spawn(
  process.execPath,
  viteArgs,
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

/**
 * Terminate a child process together with its descendants.
 *
 * `node --watch` runs the real server as a grandchild, and Vite spawns esbuild,
 * so killing only the direct child on Windows leaves the grandchild alive. That
 * orphan keeps port 5000/3000 bound and the next `npm run dev` silently shifts
 * to another port (or fails with EADDRINUSE). `taskkill /T` removes the tree.
 * @param {import("node:child_process").ChildProcess|null} child
 */
const killTree = (child) => {
  if (!child || child.pid === undefined || child.exitCode !== null || child.killed) return;

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }

  try {
    child.kill("SIGTERM");
  } catch {
    // The process already exited between the check and the signal.
  }
};

let shuttingDown = false;

// Graceful cleanup on exit
const cleanup = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\n\x1b[31m[Launcher] Shutting down services...\x1b[0m");
  killTree(backend);
  killTree(frontend);
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", () => {
  killTree(backend);
  killTree(frontend);
});

backend.on("exit", (code) => {
  if (code !== null && code !== 0) {
    console.error(`\x1b[31m[API] Backend exited with code ${code}\x1b[0m`);
  }
  // `node --watch` keeps the watcher alive across restarts, so a non-zero exit
  // means the whole service is gone: never leave the other half orphaned.
  if (!shuttingDown) cleanup();
});

frontend.on("exit", (code) => {
  if (code !== null && code !== 0) {
    console.error(`\x1b[31m[GAME] Frontend exited with code ${code}\x1b[0m`);
  }
  if (!shuttingDown) cleanup();
});
