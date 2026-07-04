import React from "react";
import { Box } from "@mui/material";
import MessageComponent from "./MessageComponent";
import MessageSkeleton from "./MessageSkeleton";
import { UnreadMessageDivider } from "./UnreadMessageDivider";
import type { Message } from "../../types/message.type";
import { VoiceSessionType } from "../../contexts/VoiceContext";

export interface MessageListProps {
  /** Messages in chronological (oldest-first) render order. */
  orderedMessages: Message[];
  authorId: string;

  // Scroll/pagination wiring (owned by useBidirectionalScroll)
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  topSentinelRef: React.RefObject<HTMLDivElement | null>;
  bottomSentinelRef: React.RefObject<HTMLDivElement | null>;
  messageRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;

  // Loading skeletons
  isLoadingMore: boolean;
  isLoadingNewer?: boolean;

  // Unread divider
  unreadCount: number;
  lastReadIndex: number;

  // Search highlight
  highlightMessageId?: string;
  highlightSeq?: number;

  // Thread / reply handling
  contextId?: string;
  communityId?: string;
  directMessageGroupId?: string;
  onOpenThread?: (message: Message) => void;
  onQuoteReply?: (message: Message) => void;

  // Virtualization gate (for observability/testing; legacy path is non-virtual)
  isVirtualized?: boolean;
}

/**
 * Legacy (non-virtualized) message list: the scroll container, sentinels,
 * chronological message map, per-message refs, unread divider, and highlight
 * remount key. Extracted verbatim from MessageContainer so the virtualized
 * renderer can be slotted in behind the same gate without touching input,
 * typing indicator, member list, or the FABs.
 *
 * This component renders real DOM nodes for every message; scroll stabilization
 * is owned entirely by useBidirectionalScroll (the container uses
 * overflowAnchor: "none").
 */
const MessageList: React.FC<MessageListProps> = ({
  orderedMessages,
  authorId,
  scrollContainerRef,
  topSentinelRef,
  bottomSentinelRef,
  messageRefs,
  isLoadingMore,
  isLoadingNewer,
  unreadCount,
  lastReadIndex,
  highlightMessageId,
  highlightSeq,
  contextId,
  communityId,
  directMessageGroupId,
  onOpenThread,
  onQuoteReply,
  isVirtualized = false,
}) => {
  return (
    <Box
      ref={scrollContainerRef}
      data-testid="scroll-container"
      data-virtualized={isVirtualized}
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        // useBidirectionalScroll is the single owner of scroll
        // stabilization. Chrome suppresses native anchoring at
        // scrollTop===0 — exactly when older pages load — so it can't be
        // relied on and must not double-compensate with our manual logic.
        overflowAnchor: "none",
      }}
    >
      {/* Top sentinel: first in DOM = visual top. marginTop: 'auto'
          bottom-packs sparse channels (content shorter than the
          viewport sits at the visual bottom, like column-reverse did);
          once content overflows, the auto margin resolves to 0.
          Do NOT swap this for justifyContent: flex-end — that breaks
          scrolling in some engines. */}
      <Box ref={topSentinelRef} sx={{ height: '1px', flexShrink: 0, marginTop: 'auto' }} />

      {/* Loading skeleton at visual top for older messages */}
      {isLoadingMore && (
        <Box sx={{ p: 2, textAlign: "center" }}>
          <MessageSkeleton />
          <MessageSkeleton />
          <MessageSkeleton />
        </Box>
      )}

      {/* Messages oldest-first: DOM order = chronological order, so
          native text selection across messages highlights correctly */}
      {orderedMessages.map((message, index) => {
        const isHighlighted = highlightMessageId === message.id;
        // Show divider right after the last-read message, i.e. before
        // the first unread message.
        const showDividerBefore =
          unreadCount > 0 && lastReadIndex !== -1 && index === lastReadIndex + 1;

        // Composite key: when highlighted, include highlightSeq so React remounts
        // the element and restarts the CSS flash animation on re-clicks.
        const key = isHighlighted ? `${message.id}-hl-${highlightSeq}` : message.id;

        return (
          <React.Fragment key={key}>
            {showDividerBefore && (
              <UnreadMessageDivider unreadCount={unreadCount} />
            )}
            <div>
              <div
                data-message-id={message.id}
                ref={(el) => {
                  if (el) messageRefs.current.set(message.id, el);
                  else messageRefs.current.delete(message.id);
                }}
              >
                <MessageComponent
                  message={message}
                  isAuthor={message.authorId === authorId}
                  isSearchHighlight={isHighlighted}
                  contextId={contextId}
                  communityId={communityId}
                  onOpenThread={onOpenThread}
                  onQuoteReply={onQuoteReply}
                  contextType={directMessageGroupId ? VoiceSessionType.Dm : VoiceSessionType.Channel}
                />
              </div>
            </div>
          </React.Fragment>
        );
      })}

      <Box sx={{ px: 2, minHeight: 20 }} />

      {/* Loading skeleton at visual bottom for newer messages (anchored mode) */}
      {isLoadingNewer && (
        <Box sx={{ p: 2, textAlign: "center" }}>
          <MessageSkeleton />
          <MessageSkeleton />
          <MessageSkeleton />
        </Box>
      )}

      {/* Bottom sentinel: last in DOM = visual bottom */}
      <Box ref={bottomSentinelRef} sx={{ height: '1px', flexShrink: 0 }} />
    </Box>
  );
};

export default MessageList;
