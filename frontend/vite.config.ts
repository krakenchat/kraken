import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "prompt": a waiting SW is surfaced via UpdateToast and applied on user
      // consent (SKIP_WAITING message) instead of silently reloading mid-session.
      registerType: "prompt",
      injectRegister: false,
      // Use injectManifest for custom service worker with push notification handling
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw-custom.ts",
      includeAssets: ["favicon.ico", "favicon-32x32.png", "favicon-16x16.png", "apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "Semaphore Chat",
        short_name: "Semaphore Chat",
        description: "Self-hosted voice and text chat",
        theme_color: "#1a1a2e",
        background_color: "#1a1a2e",
        display: "standalone",
        display_override: ["standalone"],
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        categories: ["social"],
        shortcuts: [
          {
            name: "Messages",
            short_name: "Messages",
            description: "Open direct messages",
            url: "/#/direct-messages",
          },
          {
            name: "Notifications",
            short_name: "Notifications",
            description: "Open notifications",
            url: "/#/notifications",
          },
        ],
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      injectManifest: {
        // Increase limit for large bundles (default is 2MB)
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 6MB
      },
      devOptions: {
        enabled: true, // Enable PWA in dev mode for testing
        type: "module",
      },
    }),
  ],
  resolve: {
    alias: {
      "@semaphore-chat/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  // Use relative paths for Electron file:// protocol compatibility
  base: "./",
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_BACKEND_URL || "http://backend:3000",
        changeOrigin: true,
        secure: false, // Set to true if using HTTPS
      },
      // Proxy websocket requests
      "/socket.io": {
        target: (() => {
          const url = new URL(process.env.VITE_BACKEND_URL || "http://backend:3000");
          url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
          return url.toString().replace(/\/$/, "");
        })(),
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
