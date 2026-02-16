import { useContext, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SocketContext } from "../utils/SocketContext";
import { ServerEvents, ClientEvents } from "@kraken/shared";

/**
 * Listen for community membership WebSocket events.
 * When the current user is added to a community, refresh the community list
 * and join the new community's socket rooms.
 */
export function useCommunityEvents() {
  const { socket } = useContext(SocketContext);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const handleMemberAdded = (data: { communityId: string; userId: string }) => {
      // Invalidate community list query to refetch
      queryClient.invalidateQueries({
        queryKey: [{ _id: "communityControllerFindAllMine" }],
      });

      // Join the new community's socket rooms so we receive events immediately
      socket.emit(ClientEvents.JOIN_ALL, data.communityId);
    };

    socket.on(ServerEvents.MEMBER_ADDED_TO_COMMUNITY, handleMemberAdded);

    return () => {
      socket.off(ServerEvents.MEMBER_ADDED_TO_COMMUNITY, handleMemberAdded);
    };
  }, [socket, queryClient]);
}
