import { useContext, useEffect } from "react";
import { SocketContext } from "../utils/SocketContext";
import { ClientEvents } from "../types/client-events.enum";

export function useCommunityJoin(communityId: string | undefined) {
  const socket = useContext(SocketContext);
  useEffect(() => {
    if (!socket || !communityId) return;
    socket.emit(ClientEvents.JOIN_ALL, communityId);
    // Optionally, add cleanup for leaving rooms if needed
    // return () => socket.emit(ClientEvents.LEAVE_ALL, communityId);
  }, [socket, communityId]);
}
