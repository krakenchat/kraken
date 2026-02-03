import { useEffect, useRef, useCallback, useContext } from "react";
import { SocketContext } from "../utils/SocketContext";
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
  const socket = useContext(SocketContext);
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

  // Set up Intersection Observer + MutationObserver for virtualized lists
  // The MutationObserver watches for dynamically added/removed message elements
  // (e.g., from react-virtuoso) and keeps the IntersectionObserver in sync.
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

    // Create intersection observer
    observerRef.current = new IntersectionObserver(handleIntersection, {
      root: null, // viewport
      rootMargin: "0px",
      threshold: 0.5, // 50% of message must be visible
    });

    // Helper to observe a single element if it has data-message-id
    const observeElement = (el: Element) => {
      if (el.hasAttribute("data-message-id")) {
        observerRef.current?.observe(el);
      }
      // Also check children (virtuoso may add wrapper divs)
      el.querySelectorAll("[data-message-id]").forEach((child) => {
        observerRef.current?.observe(child);
      });
    };

    // Observe all currently rendered message elements
    const root = containerRef?.current || document;
    const messageElements = root.querySelectorAll("[data-message-id]");
    messageElements.forEach((el) => {
      observerRef.current?.observe(el);
    });

    // Watch for dynamically added/removed elements (virtualization)
    let mutationObserver: MutationObserver | null = null;
    const observeRoot = containerRef?.current || document.body;
    mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            observeElement(node);
          }
        });
        mutation.removedNodes.forEach((node) => {
          if (node instanceof Element) {
            const msgId = node.getAttribute("data-message-id");
            if (msgId) {
              visibleMessagesRef.current.delete(msgId);
              observerRef.current?.unobserve(node);
            }
            node.querySelectorAll("[data-message-id]").forEach((child) => {
              const childId = child.getAttribute("data-message-id");
              if (childId) {
                visibleMessagesRef.current.delete(childId);
                observerRef.current?.unobserve(child);
              }
            });
          }
        });
      }
    });
    mutationObserver.observe(observeRoot, { childList: true, subtree: true });

    // Capture ref value for cleanup to avoid stale reference
    const visibleMessages = visibleMessagesRef.current;

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      visibleMessages.clear();
    };
  }, [enabled, containerRef, findLatestVisibleMessage, markAsRead]);

  return {
    markAsRead,
  };
};
