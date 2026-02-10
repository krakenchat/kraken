import { useContext, useEffect, useRef } from "react";
import { SocketContext } from "../utils/SocketContext";
import { ClientEvents } from '@kraken/shared';

export function useCommunityJoin(communityId: string | undefined) {
  const socket = useContext(SocketContext);
  // Track the previous community ID to leave rooms when switching communities
  const prevCommunityId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!socket) return;

    // Leave the previous community's rooms when switching communities
    if (prevCommunityId.current && prevCommunityId.current !== communityId) {
      socket.emit(ClientEvents.LEAVE_ALL, prevCommunityId.current);
    }

    // Join the new community's rooms
    if (communityId) {
      socket.emit(ClientEvents.JOIN_ALL, communityId);
    }

    // Update the previous community ID
    prevCommunityId.current = communityId;

    // Cleanup: Leave rooms when component unmounts
    return () => {
      if (communityId) {
        socket.emit(ClientEvents.LEAVE_ALL, communityId);
      }
    };
  }, [socket, communityId]);
}
