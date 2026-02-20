import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      // Use injectManifest for custom service worker with push notification handling
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw-custom.ts",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Kraken Chat",
        short_name: "Kraken",
        description: "A Discord-like voice chat application",
        theme_color: "#1a1a2e",
        background_color: "#1a1a2e",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
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
      "@kraken/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  // Use relative paths for Electron file:// protocol compatibility
  base: "./",
  server: {
    proxy: {
      "/api": {
        target: "http://backend:3000",
        changeOrigin: true,
        secure: false, // Set to true if using HTTPS
      },
      // Proxy websocket requests
      "/socket.io": {
        target: "ws://backend:3000",
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
