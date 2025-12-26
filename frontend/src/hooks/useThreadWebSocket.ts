/**
 * useThreadWebSocket Hook
 *
 * Listens for thread-related WebSocket events and updates Redux state.
 * Should be used in components that display threads.
 */

import { useEffect, useContext } from "react";
import { useDispatch } from "react-redux";
import { SocketContext } from "../utils/SocketContext";
import { ServerEvents } from "../types/server-events.enum";
import {
  addThreadReply,
  updateThreadReply,
  deleteThreadReply,
} from "../features/threads/threadsSlice";
import { Message } from "../types/message.type";

interface NewThreadReplyPayload {
  reply: Message;
  parentMessageId: string;
}

interface DeleteThreadReplyPayload {
  parentMessageId: string;
  replyId: string;
}

/**
 * Hook to handle real-time thread updates via WebSocket.
 * Call this in components that display thread replies.
 */
export function useThreadWebSocket() {
  const socket = useContext(SocketContext);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!socket) return;

    const handleNewThreadReply = (payload: NewThreadReplyPayload) => {
      dispatch(
        addThreadReply({
          parentMessageId: payload.parentMessageId,
          reply: payload.reply,
        })
      );
    };

    const handleUpdateThreadReply = (payload: NewThreadReplyPayload) => {
      dispatch(
        updateThreadReply({
          parentMessageId: payload.parentMessageId,
          reply: payload.reply,
        })
      );
    };

    const handleDeleteThreadReply = (payload: DeleteThreadReplyPayload) => {
      dispatch(
        deleteThreadReply({
          parentMessageId: payload.parentMessageId,
          replyId: payload.replyId,
        })
      );
    };

    socket.on(ServerEvents.NEW_THREAD_REPLY, handleNewThreadReply);
    socket.on(ServerEvents.UPDATE_THREAD_REPLY, handleUpdateThreadReply);
    socket.on(ServerEvents.DELETE_THREAD_REPLY, handleDeleteThreadReply);

    return () => {
      socket.off(ServerEvents.NEW_THREAD_REPLY, handleNewThreadReply);
      socket.off(ServerEvents.UPDATE_THREAD_REPLY, handleUpdateThreadReply);
      socket.off(ServerEvents.DELETE_THREAD_REPLY, handleDeleteThreadReply);
    };
  }, [socket, dispatch]);
}

export default useThreadWebSocket;
