import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

/**
 * Vite configuration for E2E testing
 *
 * This config is used when running E2E tests in Docker.
 * It proxies API requests to the backend-test container.
 *
 * Served over plain HTTP. The voice E2E runs the browser against
 * http://localhost:<port>, which browsers treat as a *secure context* (so
 * getUserMedia works) without any TLS — see frontend/e2e/voice/README.md.
 */

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw-custom.ts",
      includeAssets: ["favicon.ico", "favicon-32x32.png", "favicon-16x16.png", "apple-touch-icon.png"],
      manifest: {
        name: "Semaphore Chat",
        short_name: "Semaphore",
        description: "Self-hosted voice and text chat",
        theme_color: "#1a1a2e",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@semaphore-chat/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  base: "/",
  server: {
    host: "0.0.0.0",
    // Allow the in-network container hostname used by a dockerized Playwright
    // runner; Vite otherwise 403s unknown Hosts.
    allowedHosts: ["frontend-test", "localhost"],
    proxy: {
      // Proxy to backend-test container in Docker E2E network
      "/api": {
        target: "http://backend-test:3000",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: "ws://backend-test:3000",
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
