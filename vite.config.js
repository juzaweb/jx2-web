import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(() => {
  const backendPort = process.env.PORT || 5000;
  const frontendPort = parseInt(process.env.VITE_PORT, 10) || 3000;
  const apiBase = process.env.VITE_API_BASE || `http://localhost:${backendPort}/api`;

  return {
    plugins: [react()],
    server: {
      port: frontendPort,
      open: false,
      proxy: {
        "/api": {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true
        },
        "/ws": {
          target: `ws://localhost:${backendPort}`,
          ws: true
        }
      }
    },
    define: {
      "import.meta.env.VITE_API_BASE": JSON.stringify(apiBase)
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.{js,jsx}"]
    }
  };
});
