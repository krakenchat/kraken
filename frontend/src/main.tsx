import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "./App.tsx";
import { HashRouter } from "react-router-dom";
import { initTelemetry } from "./services/telemetry";
import { configureApiClient } from "./api-client-config";
import { isElectron } from "./utils/platform";

// Initialize telemetry before app renders
initTelemetry();

// Configure the generated API client (auth interceptors, base URL)
configureApiClient();

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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>
);
