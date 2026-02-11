import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

/**
 * Vite configuration for E2E testing
 *
 * This config is used when running E2E tests in Docker.
 * It proxies API requests to the backend-test container.
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
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
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: {
        enabled: false, // Disable PWA in E2E tests
        type: "module",
      },
    }),
  ],
  resolve: {
    alias: {
      "@kraken/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  base: "/",
  server: {
    host: "0.0.0.0",
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
