import { useContext } from "react";
import { SocketContext } from "./SocketContext";

export function useSocket() {
  const socket = useContext(SocketContext);
  if (!socket) throw new Error("Socket not available in context");
  return socket;
}
