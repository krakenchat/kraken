import { useEffect, useRef } from "react";
import { useSocket } from "./useSocket";
import { ClientEvents } from "../types/client-events.enum";

/**
 * Hook to send presence heartbeat every 30 seconds to keep user marked as online
 */
export const usePresenceHeartbeat = (enabled: boolean = true) => {
  const socket = useSocket();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || !socket) return;

    // Send initial heartbeat
    socket.emit(ClientEvents.PRESENCE_ONLINE);

    // Set up interval to send heartbeat every 30 seconds
    intervalRef.current = setInterval(() => {
      socket.emit(ClientEvents.PRESENCE_ONLINE);
    }, 30000); // 30 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, socket]);

  return null; // This hook doesn't return any value
};