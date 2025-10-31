import { io, Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "./SocketContext";
import { getCachedItem, setCachedItem } from "../utils/storage";
import axios from "axios";
import { getWebSocketUrl, getApiUrl } from "../config/env";

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
    let token = getCachedItem<string>("accessToken");

    // Try to refresh token
    try {
      const refreshUrl = getApiUrl("/auth/refresh");
      console.log("[Socket] Refreshing token at:", refreshUrl);

      const refreshResponse = await axios.post<{ accessToken: string }>(
        refreshUrl,
        {},
        { withCredentials: true }
      );
      if (refreshResponse.data?.accessToken) {
        setCachedItem("accessToken", refreshResponse.data.accessToken);
        token = refreshResponse.data.accessToken;
        console.log("[Socket] Token refreshed successfully");
      }
    } catch (error) {
      console.error("[Socket] Error refreshing token:", error);
      token = null;
    }

    // Use configurable WebSocket URL from environment
    const url = getWebSocketUrl();
    console.log("[Socket] Connecting to WebSocket URL:", url);

    if (!token) {
      const error = new Error("No token available for socket connection. Please log in and configure server connection.");
      console.error("[Socket]", error.message);
      throw error;
    }

    socketInstance = io(url, {
      transports: ["websocket"],
      auth: { token: `Bearer ${token}` },
    });
    return new Promise<Socket<ServerToClientEvents, ClientToServerEvents>>(
      (resolve, reject) => {
        socketInstance!.on("connect", () => {
          console.log("Socket connected " + socketInstance!.id);
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
