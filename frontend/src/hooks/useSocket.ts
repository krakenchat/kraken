import { useContext } from "react";
import { SocketContext } from "../utils/SocketContext";

export function useSocket() {
  const { socket } = useContext(SocketContext);
  return socket ?? null;
}

export function useSocketConnected(): boolean {
  const { isConnected } = useContext(SocketContext);
  return isConnected;
}
