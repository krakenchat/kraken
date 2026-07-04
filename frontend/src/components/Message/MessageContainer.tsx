import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box, Typography, Fab } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import MessageSkeleton from "./MessageSkeleton";
import MessageList from "./MessageList";
import VirtualMessageList, { type VirtualMessageListHandle } from "./VirtualMessageList";
import type { Message } from "../../types/message.type";
import { useMessageVisibility } from "../../hooks/useMessageVisibility";
import { useReadReceipts } from "../../hooks/useReadReceipts";
import { useResponsive } from "../../hooks/useResponsive";
import { useBidirectionalScroll } from "../../hooks/useBidirectionalScroll";
import { useAnchoredModeTransition } from "../../hooks/useAnchoredModeTransition";
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

  // Virtualization gate, two-phase. `wantVirtualized` is the raw decision;
  // `virtualActive` is the rendered reality. When the gate first flips to
  // virtual mid-session (the user just paginated past the threshold, i.e. is
  // reading history), a layout effect below captures the current reading
  // position from the still-mounted legacy DOM before activating the virtual
  // renderer — otherwise the virtual list would re-home to the bottom and yank
  // the reader away from where they were.
  const wantVirtualized = shouldVirtualizeMessages(messages.length, mode);
  const [virtualActive, setVirtualActive] = useState(wantVirtualized);
  const transitionAnchorRef = useRef<{ id: string; offsetTop: number } | null>(null);
  const isVirtualized = virtualActive;

  const {
    scrollContainerRef,
    bottomSentinelRef,
    topSentinelRef,
    messageRefs,
    atBottom: legacyAtBottom,
    scrollToBottom: legacyScrollToBottom,
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
    // Disable the manual scroll math entirely in the virtualized path —
    // virtua owns scrollTop there (prepend/stick-to-bottom/growth compensation).
    disabled: isVirtualized,
  });

  // Virtualized-path scroll state. virtua reports atBottom via a callback and
  // exposes scrollToBottom through an imperative handle; both are lifted here so
  // the FABs work identically regardless of which renderer is active.
  const virtualListRef = useRef<VirtualMessageListHandle>(null);
  const [virtualAtBottom, setVirtualAtBottom] = useState(true);
  const scrollToVirtualBottom = useCallback(() => {
    virtualListRef.current?.scrollToBottom();
  }, []);

  const atBottom = isVirtualized ? virtualAtBottom : legacyAtBottom;
  const scrollToBottom = isVirtualized ? scrollToVirtualBottom : legacyScrollToBottom;

  // Phase 2 of the virtualization gate: activate/deactivate the virtual
  // renderer one commit after the raw decision changes. On legacy → virtual,
  // capture the topmost visible message and its viewport offset from the legacy
  // DOM (still mounted in this commit) so VirtualMessageList can restore the
  // reading position instead of re-homing to the bottom. When the user is
  // pinned to the bottom (threshold crossed by incoming messages, or a fresh
  // mount with a large cache), no anchor is captured and the virtual list
  // mounts at the bottom, which is correct.
  useLayoutEffect(() => {
    if (wantVirtualized === virtualActive) return;
    if (wantVirtualized) {
      let anchor: { id: string; offsetTop: number } | null = null;
      const container = scrollContainerRef.current;
      if (container && !legacyAtBottom) {
        const containerTop = container.getBoundingClientRect().top;
        for (const el of container.querySelectorAll("[data-message-id]")) {
          const rect = el.getBoundingClientRect();
          if (rect.bottom > containerTop + 1) {
            const id = el.getAttribute("data-message-id");
            if (id) anchor = { id, offsetTop: rect.top - containerTop };
            break;
          }
        }
      }
      transitionAnchorRef.current = anchor;
    } else {
      transitionAnchorRef.current = null;
    }
    setVirtualActive(wantVirtualized);
  }, [wantVirtualized, virtualActive, legacyAtBottom, scrollContainerRef]);

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
          isVirtualized ? (
            <VirtualMessageList
              ref={virtualListRef}
              orderedMessages={orderedMessages}
              authorId={authorId}
              isLoadingMore={isLoadingMore}
              continuationToken={continuationToken}
              onLoadMore={onLoadMore}
              unreadCount={unreadCount}
              lastReadIndex={lastReadIndex}
              highlightMessageId={highlightMessageId}
              highlightSeq={highlightSeq}
              contextId={contextId}
              communityId={communityId}
              directMessageGroupId={directMessageGroupId}
              onOpenThread={onOpenThread}
              onQuoteReply={onQuoteReply}
              resetKey={contextKey}
              initialAnchor={transitionAnchorRef.current}
              onAtBottomChange={setVirtualAtBottom}
            />
          ) : (
            <MessageList
              orderedMessages={orderedMessages}
              authorId={authorId}
              scrollContainerRef={scrollContainerRef}
              topSentinelRef={topSentinelRef}
              bottomSentinelRef={bottomSentinelRef}
              messageRefs={messageRefs}
              isLoadingMore={isLoadingMore}
              isLoadingNewer={isLoadingNewer}
              unreadCount={unreadCount}
              lastReadIndex={lastReadIndex}
              highlightMessageId={highlightMessageId}
              highlightSeq={highlightSeq}
              contextId={contextId}
              communityId={communityId}
              directMessageGroupId={directMessageGroupId}
              onOpenThread={onOpenThread}
              onQuoteReply={onQuoteReply}
              isVirtualized={isVirtualized}
            />
          )
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
