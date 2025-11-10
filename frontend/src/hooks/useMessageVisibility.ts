import { useEffect, useRef, useCallback } from "react";
import { useSocketContext } from "../contexts/SocketContext";
import { ClientEvents } from "../types/client-events.enum";
import { MarkAsReadPayload } from "../types/read-receipt.type";

interface UseMessageVisibilityProps {
  channelId?: string;
  directMessageGroupId?: string;
  messages: Array<{ id: string }>;
  containerRef?: React.RefObject<HTMLElement>;
  enabled?: boolean;
}

/**
 * Hook to track message visibility using Intersection Observer
 * Automatically marks messages as read when they scroll into view
 */
export const useMessageVisibility = ({
  channelId,
  directMessageGroupId,
  messages,
  containerRef,
  enabled = true,
}: UseMessageVisibilityProps) => {
  const { socket } = useSocketContext();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibleMessagesRef = useRef<Set<string>>(new Set());
  const lastMarkedMessageIdRef = useRef<string | null>(null);
  const messagesRef = useRef(messages);

  // Keep messages ref updated
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Stable callback to mark messages as read
  const markAsRead = useCallback(
    (messageId: string) => {
      if (!socket || !enabled) return;
      if (!channelId && !directMessageGroupId) return;
      if (lastMarkedMessageIdRef.current === messageId) return;

      const payload: MarkAsReadPayload = {
        lastReadMessageId: messageId,
        ...(channelId ? { channelId } : { directMessageGroupId }),
      };

      socket.emit(ClientEvents.MARK_AS_READ, payload);
      lastMarkedMessageIdRef.current = messageId;
    },
    [socket, channelId, directMessageGroupId, enabled]
  );

  // Find the latest visible message using ref
  const findLatestVisibleMessage = useCallback(() => {
    if (visibleMessagesRef.current.size === 0) return null;

    let latestVisibleIndex = -1;
    let latestMessageId: string | null = null;

    messagesRef.current.forEach((message, index) => {
      if (visibleMessagesRef.current.has(message.id)) {
        if (latestVisibleIndex === -1 || index < latestVisibleIndex) {
          latestVisibleIndex = index;
          latestMessageId = message.id;
        }
      }
    });

    return latestMessageId;
  }, []); // No dependencies - uses refs

  // Set up Intersection Observer
  useEffect(() => {
    if (!enabled) return;

    // Handle intersection changes
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      let changed = false;

      entries.forEach((entry) => {
        const messageId = entry.target.getAttribute("data-message-id");
        if (!messageId) return;

        if (entry.isIntersecting) {
          if (!visibleMessagesRef.current.has(messageId)) {
            visibleMessagesRef.current.add(messageId);
            changed = true;
          }
        } else {
          if (visibleMessagesRef.current.has(messageId)) {
            visibleMessagesRef.current.delete(messageId);
            changed = true;
          }
        }
      });

      // If visibility changed, find and mark the latest visible message as read
      if (changed) {
        const latestVisible = findLatestVisibleMessage();
        if (latestVisible) {
          markAsRead(latestVisible);
        }
      }
    };

    // Create observer
    observerRef.current = new IntersectionObserver(handleIntersection, {
      root: null, // viewport
      rootMargin: "0px",
      threshold: 0.5, // 50% of message must be visible
    });

    // Observe all message elements, scoped to container if provided
    const root = containerRef?.current || document;
    const messageElements = root.querySelectorAll("[data-message-id]");
    messageElements.forEach((el) => {
      observerRef.current?.observe(el);
    });

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      // Capture ref value in cleanup to avoid stale reference
      const visibleMessages = visibleMessagesRef.current;
      visibleMessages.clear();
    };
  }, [enabled, containerRef, findLatestVisibleMessage, markAsRead, messages.length]);

  return {
    markAsRead,
  };
};
