import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Provider } from "react-redux";
import { store } from "./app/store.ts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "./App.tsx";
import { HashRouter } from "react-router-dom";
import { SocketProvider } from "./utils/SocketProvider";
import { initTelemetry } from "./services/telemetry";
import { configureApiClient } from "./api-client-config";

// Initialize telemetry before app renders
initTelemetry();

// Configure the generated API client (auth interceptors, base URL)
configureApiClient();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <HashRouter>
          <SocketProvider>
            <App />
          </SocketProvider>
        </HashRouter>
      </Provider>
    </QueryClientProvider>
  </StrictMode>
);
