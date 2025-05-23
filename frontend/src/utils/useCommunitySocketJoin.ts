import { useContext, useEffect } from "react";
import { SocketContext } from "./SocketContext";
import { ClientEvents } from "../types/client-events.enum";

export function useCommunitySocketJoin(communityId: string | undefined) {
  const socket = useContext(SocketContext);
  useEffect(() => {
    if (!socket || !communityId) return;
    socket.emit(ClientEvents.JOIN_ALL, communityId);
    // Optionally, add cleanup for leaving rooms if needed
    // return () => socket.emit(ClientEvents.LEAVE_ALL, communityId);
  }, [socket, communityId]);
}
