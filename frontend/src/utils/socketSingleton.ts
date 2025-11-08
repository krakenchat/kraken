import { io, Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "./SocketContext";
import { setCachedItem } from "../utils/storage";
import axios from "axios";
import { getWebSocketUrl, getApiUrl } from "../config/env";
import { getAuthToken } from "./auth";
import { logger } from "./logger";
import { isElectron } from "./platform";

let socketInstance: Socket<ServerToClientEvents, ClientToServerEvents> | null =
  null;
let connectPromise: Promise<
  Socket<ServerToClientEvents, ClientToServerEvents>
> | null = null;

export async function getSocketSingleton(): Promise<
  Socket<ServerToClientEvents, ClientToServerEvents>
> {
  if (socketInstance && socketInstance.connected) {
    return socketInstance;
  }
  if (connectPromise) {
    return connectPromise;
  }
  connectPromise = (async () => {
    let token = getAuthToken();

    // Try to refresh token
    try {
      const refreshUrl = getApiUrl("/auth/refresh");
      logger.dev("[Socket] Refreshing token at:", refreshUrl);

      // Check if we're in Electron and have a stored refresh token
      const isElectronApp = isElectron();

      let refreshResponse;
      if (isElectronApp) {
        const refreshToken = localStorage.getItem("refreshToken");
        if (refreshToken) {
          // For Electron, send refresh token in body
          refreshResponse = await axios.post<{ accessToken: string; refreshToken?: string }>(
            refreshUrl,
            { refreshToken }
          );
        } else {
          throw new Error("No refresh token available for Electron client");
        }
      } else {
        // For web clients, use cookie-based refresh
        refreshResponse = await axios.post<{ accessToken: string }>(
          refreshUrl,
          {},
          { withCredentials: true }
        );
      }

      if (refreshResponse?.data?.accessToken) {
        setCachedItem("accessToken", refreshResponse.data.accessToken);
        token = refreshResponse.data.accessToken;

        // Update stored refresh token for Electron
        if (isElectronApp && refreshResponse.data.refreshToken) {
          localStorage.setItem("refreshToken", refreshResponse.data.refreshToken);
        }

        logger.dev("[Socket] Token refreshed successfully");
      }
    } catch (error) {
      logger.error("[Socket] Error refreshing token:", error);
      token = null;
    }

    // Use configurable WebSocket URL from environment
    const url = getWebSocketUrl();
    logger.dev("[Socket] Connecting to WebSocket URL:", url);

    if (!token) {
      const error = new Error("No token available for socket connection. Please log in and configure server connection.");
      logger.error("[Socket]", error.message);
      throw error;
    }

    socketInstance = io(url, {
      transports: ["websocket"],
      auth: { token: `Bearer ${token}` },
    });
    return new Promise<Socket<ServerToClientEvents, ClientToServerEvents>>(
      (resolve, reject) => {
        socketInstance!.on("connect", () => {
          logger.dev("Socket connected " + socketInstance!.id);
          resolve(socketInstance!);
        });
        socketInstance!.on("connect_error", (err) => {
          reject(err);
        });
      }
    );
  })();
  return connectPromise;
}
