import { io, Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "./SocketContext";
import { getCachedItem, setCachedItem } from "../utils/storage";
import axios from "axios";

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
    try {
      const refreshResponse = await axios.post<{ accessToken: string }>(
        "/api/auth/refresh"
      );
      if (refreshResponse.data?.accessToken) {
        setCachedItem("accessToken", refreshResponse.data.accessToken);
        token = refreshResponse.data.accessToken;
      }
    } catch (error) {
      console.error("Error refreshing token", error);
      token = null;
    }
    // Use environment variable for WebSocket URL, fallback to window origin (for K8s ingress) or localhost for development
    const url =
      import.meta.env.VITE_WS_URL ||
      (typeof window !== "undefined" && window.location.origin !== "null"
        ? window.location.origin
        : "http://localhost:3000");
    if (!token) {
      throw new Error("No token available for socket connection");
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
