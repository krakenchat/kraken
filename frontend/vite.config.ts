import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://backend:3000",
        changeOrigin: true,
        secure: false, // Set to true if using HTTPS
      },
      // Proxy websocket requests
      "/socket.io": {
        target: "ws://localhost:3000",
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
