import { useContext } from "react";
import { SocketContext } from "./SocketContext";

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("Socket not available in context");
  return ctx;
}
