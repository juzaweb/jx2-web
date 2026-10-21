import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendPort = process.env.PORT || env.PORT || 5000;
  const frontendPort = parseInt(process.env.VITE_PORT || env.VITE_PORT, 10) || 3000;
  const rawApiBase = process.env.VITE_API_BASE || env.VITE_API_BASE;
  const apiBase =
    rawApiBase || (mode === "production" ? "/api" : `http://localhost:${backendPort}/api`);

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        includeAssets: ["favicon.ico", "apple-touch-icon.png"],
        manifest: {
          name: "Giang Hồ — HTML5 RPG (VL2 Edition)",
          short_name: "Giang Hồ",
          description: "A small browser-playable wuxia RPG inspired by classic Vietnamese martial-arts MMORPGs.",
          theme_color: "#0f0b08",
          background_color: "#0f0b08",
          display: "standalone",
          orientation: "any",
          icons: [
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png"
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png"
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable"
            }
          ]
        }
      })
    ],
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
