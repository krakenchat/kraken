import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import fs from "fs";

/**
 * Vite configuration for E2E testing
 *
 * This config is used when running E2E tests in Docker.
 * It proxies API requests to the backend-test container.
 */

// Self-signed cert (committed, test-only) so the e2e frontend is served over
// HTTPS. An https origin is a *secure context* regardless of hostname, which is
// what unlocks navigator.mediaDevices/getUserMedia for the in-Docker Playwright
// voice run (http://frontend-test:5173 is NOT secure; https is). Loaded only if
// present so a plain `vite` invocation without certs still works over http.
const e2eCertDir = path.resolve(__dirname, "e2e/certs");
const e2eHttps =
  fs.existsSync(path.join(e2eCertDir, "e2e-key.pem")) &&
  fs.existsSync(path.join(e2eCertDir, "e2e-cert.pem"))
    ? {
        key: fs.readFileSync(path.join(e2eCertDir, "e2e-key.pem")),
        cert: fs.readFileSync(path.join(e2eCertDir, "e2e-cert.pem")),
      }
    : undefined;

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
    // Serve over HTTPS (self-signed) so the origin is a secure context →
    // getUserMedia works for the dockerized voice E2E. Playwright connects with
    // ignoreHTTPSErrors. Falls back to http if the certs aren't present.
    https: e2eHttps,
    // Allow the in-network container hostname (e.g. https://frontend-test:5173)
    // used by the dockerized Playwright runner; Vite otherwise 403s unknown Hosts.
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
