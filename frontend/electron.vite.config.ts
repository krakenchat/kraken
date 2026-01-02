import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        // Don't externalize these - they need to be bundled for ESM compatibility
        exclude: ["electron-updater", "electron-audio-loopback"],
      }),
    ],
    build: {
      outDir: "out/main",
      lib: {
        entry: resolve(__dirname, "electron/main.ts"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/preload",
      lib: {
        entry: resolve(__dirname, "electron/preload.ts"),
      },
    },
  },
  renderer: {
    root: ".",
    build: {
      outDir: "out/renderer",
      rollupOptions: {
        input: resolve(__dirname, "index.html"),
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
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
    server: {
      proxy: {
        "/api": {
          target: "http://backend:3000",
          changeOrigin: true,
          secure: false,
        },
        "/socket.io": {
          target: "ws://backend:3000",
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  },
});
