import { useContext } from "react";
import { SocketContext } from "../utils/SocketContext";

export function useSocket() {
  const socket = useContext(SocketContext);
  if (!socket) return null;
  return socket;
}
