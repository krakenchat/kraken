import { useEffect } from "react";
import { useSocket } from "./useSocket";
import { ClientEvents } from "@kraken/shared";

/**
 * On socket connect (initial + reconnect), emit SUBSCRIBE_ALL so the server
 * joins this client to every room it needs. This replaces the old per-community
 * JOIN_ALL/LEAVE_ALL pattern, ensuring messages are received regardless of
 * which page the user is viewing.
 */
export function useAutoSubscribe() {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const subscribe = () => {
      socket.emit(ClientEvents.SUBSCRIBE_ALL);
    };

    // If already connected, subscribe immediately
    if (socket.connected) {
      subscribe();
    }

    // Subscribe on every (re)connect
    socket.on("connect", subscribe);

    return () => {
      socket.off("connect", subscribe);
    };
  }, [socket]);
}
