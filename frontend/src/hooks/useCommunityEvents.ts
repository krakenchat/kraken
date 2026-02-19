import { useContext, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SocketContext } from "../utils/SocketContext";
import { ServerEvents } from "@kraken/shared";

/**
 * Listen for community membership WebSocket events.
 * When the current user is added to a community, refresh the community list.
 * Room subscriptions are handled server-side — no client emit needed.
 */
export function useCommunityEvents() {
  const { socket } = useContext(SocketContext);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const handleMemberAdded = () => {
      queryClient.invalidateQueries({
        queryKey: [{ _id: "communityControllerFindAllMine" }],
      });
    };

    socket.on(ServerEvents.MEMBER_ADDED_TO_COMMUNITY, handleMemberAdded);

    return () => {
      socket.off(ServerEvents.MEMBER_ADDED_TO_COMMUNITY, handleMemberAdded);
    };
  }, [socket, queryClient]);
}
