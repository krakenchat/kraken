import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";

import App from "./App.tsx";
import { HashRouter } from "react-router-dom";
import { configureApiClient } from "./api-client-config";
import { isElectron } from "./utils/platform";
import { queryClient } from "./queryClient";

// Configure the generated API client (auth interceptors, base URL)
configureApiClient();

// Capture the PWA install prompt as early as possible — the browser can
// fire beforeinstallprompt before React mounts (side-effect import)
import "./utils/installPrompt";

// Register service worker only in web browser (not Electron file:// context)
if (!isElectron()) {
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch((error) => {
      console.error("Failed to register service worker:", error);
    });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>
);
