import React, { useMemo } from "react";
import MessageComponent from "./MessageComponent";
import { Box, Typography, Fab } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import MessageSkeleton from "./MessageSkeleton";
import { UnreadMessageDivider } from "./UnreadMessageDivider";
import type { Message } from "../../types/message.type";
import { useMessageVisibility } from "../../hooks/useMessageVisibility";
import { useReadReceipts } from "../../hooks/useReadReceipts";
import { useResponsive } from "../../hooks/useResponsive";
import { useBidirectionalScroll } from "../../hooks/useBidirectionalScroll";
import { useAnchoredModeTransition } from "../../hooks/useAnchoredModeTransition";
import { VoiceSessionType } from "../../contexts/VoiceContext";
import TypingIndicator from "./TypingIndicator";
import { shouldVirtualizeMessages } from "./virtualization";

interface MessageContainerProps {
  // Data
  messages: Message[];
  isLoading: boolean;
  error: unknown;
  authorId: string;

  // Pagination
  continuationToken?: string;
  isLoadingMore: boolean;
  onLoadMore?: () => Promise<void>;

  // Bidirectional pagination (anchored mode)
  onLoadNewer?: () => Promise<void>;
  isLoadingNewer?: boolean;
  hasNewer?: boolean;
  mode?: 'normal' | 'anchored';
  jumpToPresent?: () => void;

  // Message Input
  messageInput: React.ReactNode;

  // Member List
  memberListComponent?: React.ReactNode;
  showMemberList?: boolean;

  // Optional customization
  emptyStateMessage?: string;

  // Search highlight
  highlightMessageId?: string;
  highlightSeq?: number;

  // Thread handling
  contextId?: string;
  communityId?: string;
  onOpenThread?: (message: Message) => void;
  onQuoteReply?: (message: Message) => void;

  // Read receipts
  channelId?: string;
  directMessageGroupId?: string;
}

const MessageContainer: React.FC<MessageContainerProps> = ({
  messages,
  isLoading,
  error,
  authorId,
  continuationToken,
  isLoadingMore,
  onLoadMore,
  onLoadNewer,
  isLoadingNewer,
  hasNewer,
  mode = 'normal',
  jumpToPresent,
  messageInput,
  memberListComponent,
  showMemberList = true,
  emptyStateMessage = "No messages yet. Start the conversation!",
  highlightMessageId,
  highlightSeq,
  contextId,
  communityId,
  onOpenThread,
  onQuoteReply,
  channelId,
  directMessageGroupId,
}) => {
  const { isMobile } = useResponsive();

  // Context identity (channel or DM group) — used for read receipts and to
  // reset scroll positioning when switching contexts.
  const contextKey = channelId || directMessageGroupId;

  // The messages prop arrives newest-first (useMessages contract). Render
  // oldest-first so DOM order matches chronological order — native text
  // selection follows DOM order, so this is what makes cross-message
  // selection highlight correctly.
  const orderedMessages = useMemo(() => [...messages].reverse(), [messages]);

  // Virtualization gate. Evaluated here so both the scroll hooks and the render
  // branch agree on which path is active. The virtualized renderer does not
  // exist yet (steps 3+), so this currently always resolves to the legacy path;
  // wiring it now keeps the decision in one place.
  const isVirtualized = shouldVirtualizeMessages(messages.length, mode);

  const {
    scrollContainerRef,
    bottomSentinelRef,
    topSentinelRef,
    messageRefs,
    atBottom,
    scrollToBottom,
  } = useBidirectionalScroll({
    messages,
    mode,
    highlightMessageId,
    highlightSeq,
    resetKey: contextKey,
    onLoadMore,
    isLoadingMore,
    continuationToken,
    onLoadNewer,
    isLoadingNewer,
    hasNewer,
  });

  useAnchoredModeTransition({
    mode,
    atBottom,
    hasNewer,
    isLoadingNewer,
    jumpToPresent,
    scrollContainerRef,
  });

  // Auto-mark messages as read when they scroll into view
  useMessageVisibility({
    channelId,
    directMessageGroupId,
    messages,
    containerRef: scrollContainerRef,
    enabled: !isLoading && messages.length > 0,
  });

  // Read receipts - determine where to show unread divider
  const { lastReadMessageId: getLastReadMessageId, unreadCount: getUnreadCount } = useReadReceipts();
  const lastReadMessageId = getLastReadMessageId(contextKey);
  const unreadCount = getUnreadCount(contextKey);

  // Find the index of the last read message in the chronological (oldest-first)
  // render order; the divider goes right after it, before the first unread.
  const lastReadIndex = useMemo(() => {
    if (!lastReadMessageId) return -1;
    return orderedMessages.findIndex((msg) => msg.id === lastReadMessageId);
  }, [orderedMessages, lastReadMessageId]);

  const skeletonCount = 10;

  // Hide member list on mobile or when explicitly disabled
  const shouldShowMemberList = showMemberList && !isMobile && memberListComponent;

  if (isLoading) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "row",
          width: "100%",
        }}
      >
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            p: 2,
          }}
        >
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <MessageSkeleton key={i} />
          ))}
        </Box>
        {shouldShowMemberList && memberListComponent}
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "row",
          width: "100%",
        }}
      >
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 2,
          }}
        >
          <Typography color="error">Error loading messages</Typography>
        </Box>
        {shouldShowMemberList && memberListComponent}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        height: "100%",
        width: "100%",
        position: "relative",
      }}
    >
      {/* Message Area */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          position: "relative",
        }}
      >
        {messages.length > 0 ? (
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
        ) : (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography color="text.secondary">
              {emptyStateMessage}
            </Typography>
          </Box>
        )}

        {/* Other user typing indicator — floats above input, no layout shift */}
        <Box sx={{ position: 'relative', height: 0, zIndex: 1 }}>
          <TypingIndicator channelId={channelId} directMessageGroupId={directMessageGroupId} currentUserId={authorId} />
        </Box>

        {/* Input rendered outside scroll container — stable DOM, never unmounted by message changes */}
        <Box sx={{ flexShrink: 0 }}>
          {messageInput}
        </Box>

        {mode === 'anchored' && jumpToPresent ? (
          <Fab
            variant="extended"
            size="small"
            onClick={jumpToPresent}
            data-testid="jump-to-present-fab"
            sx={{
              position: "absolute",
              bottom: 80,
              right: 16,
              backgroundColor: "primary.main",
              "&:hover": { backgroundColor: "primary.dark" },
              color: "primary.contrastText",
            }}
          >
            <KeyboardArrowDownIcon sx={{ mr: 0.5 }} />
            Jump to Present
          </Fab>
        ) : !atBottom && (
          <Fab
            size="small"
            onClick={scrollToBottom}
            sx={{
              position: "absolute",
              bottom: 80,
              right: 16,
              backgroundColor: "primary.main",
              "&:hover": { backgroundColor: "primary.dark" },
            }}
          >
            <KeyboardArrowDownIcon />
          </Fab>
        )}
      </Box>

      {/* Member List */}
      {shouldShowMemberList && memberListComponent}
    </Box>
  );
};

export default MessageContainer;
