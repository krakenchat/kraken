import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Provider } from "react-redux";
import { store } from "./app/store.ts";

import App from "./App.tsx";
import { HashRouter } from "react-router-dom";
import { SocketProvider } from "./utils/SocketProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <HashRouter>
        <SocketProvider>
          <App />
        </SocketProvider>
      </HashRouter>
    </Provider>
  </StrictMode>
);
