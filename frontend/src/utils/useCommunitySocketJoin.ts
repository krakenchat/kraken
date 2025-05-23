import { useContext, useEffect } from "react";
import { SocketContext } from "./SocketContext";
import { ClientEvents } from "../types/client-events.enum";

export function useCommunitySocketJoin(communityId: string | undefined) {
  const { socket, connected } = useContext(SocketContext) || {};
  useEffect(() => {
    if (!socket) {
      console.error("Socket not initialized");
      return;
    }
    if (!connected) {
      console.warn("Socket not connected, cannot emit JOIN_ALL");
      return;
    }

    if (!socket || !communityId) {
      return;
    } else {
      console.log("Emitting JOIN_ALL event with communityId:", communityId);
      socket.emit(ClientEvents.JOIN_ALL, communityId);
    }
    // Optionally, add cleanup for leaving rooms if needed
    // return () => socket.emit(ClientEvents.LEAVE_ALL, communityId);
  }, [socket, connected, communityId]);
}
