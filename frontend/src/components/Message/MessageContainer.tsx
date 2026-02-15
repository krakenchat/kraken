import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import MessageComponent from "./MessageComponent";
import { Typography, Fab, useMediaQuery, useTheme } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import MessageSkeleton from "./MessageSkeleton";
import { UnreadMessageDivider } from "./UnreadMessageDivider";
import type { Message } from "../../types/message.type";
import { useMessageVisibility } from "../../hooks/useMessageVisibility";
import { useReadReceipts } from "../../hooks/useReadReceipts";

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

  // Message Input
  messageInput: React.ReactNode;

  // Member List
  memberListComponent?: React.ReactNode;
  showMemberList?: boolean;

  // Optional customization
  emptyStateMessage?: string;

  // Search highlight
  highlightMessageId?: string;

  // Thread handling
  contextId?: string;
  communityId?: string;
  onOpenThread?: (message: Message) => void;

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
  messageInput,
  memberListComponent,
  showMemberList = true,
  emptyStateMessage = "No messages yet. Start the conversation!",
  highlightMessageId,
  contextId,
  communityId,
  onOpenThread,
  channelId,
  directMessageGroupId,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [atBottom, setAtBottom] = useState(true);

  // Messages are newest-first from the API; reverse for chronological display in Virtuoso
  const displayMessages = useMemo(() => [...messages].reverse(), [messages]);

  // Auto-mark messages as read when they scroll into view
  useMessageVisibility({
    channelId,
    directMessageGroupId,
    messages,
    containerRef: scrollContainerRef,
    enabled: !isLoading && messages.length > 0,
  });

  // Read receipts - determine where to show unread divider
  const contextKey = channelId || directMessageGroupId;
  const { lastReadMessageId: getLastReadMessageId, unreadCount: getUnreadCount } = useReadReceipts();
  const lastReadMessageId = getLastReadMessageId(contextKey);
  const unreadCount = getUnreadCount(contextKey);

  // Find the index of the last read message in the display (chronological) array
  const lastReadDisplayIndex = useMemo(() => {
    if (!lastReadMessageId) return -1;
    return displayMessages.findIndex((msg) => msg.id === lastReadMessageId);
  }, [displayMessages, lastReadMessageId]);

  // Scroll to highlighted message when it's available
  // Short delay lets Virtuoso stabilize layout before scrolling
  useEffect(() => {
    if (highlightMessageId && displayMessages.length > 0) {
      const idx = displayMessages.findIndex((m) => m.id === highlightMessageId);
      if (idx >= 0) {
        const timer = setTimeout(() => {
          virtuosoRef.current?.scrollToIndex({
            index: idx,
            align: "center",
            behavior: "smooth",
          });
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [highlightMessageId, displayMessages]);

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: displayMessages.length - 1,
      align: "end",
      behavior: "smooth",
    });
  }, [displayMessages.length]);

  // Load more when reaching the top of the list
  const handleStartReached = useCallback(() => {
    if (continuationToken && onLoadMore && !isLoadingMore) {
      onLoadMore();
    }
  }, [continuationToken, onLoadMore, isLoadingMore]);

  // Memoize Header to avoid Virtuoso DOM churn on re-renders
  const HeaderComponent = useMemo(
    () =>
      function VirtuosoHeader() {
        return isLoadingMore ? (
          <div style={{ padding: "16px", textAlign: "center" }}>
            <MessageSkeleton />
            <MessageSkeleton />
            <MessageSkeleton />
          </div>
        ) : null;
      },
    [isLoadingMore]
  );

  const skeletonCount = 10;

  // Hide member list on mobile or when explicitly disabled
  const shouldShowMemberList = showMemberList && !isMobile && memberListComponent;

  if (isLoading) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "row",
          width: "100%",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "16px",
          }}
        >
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <MessageSkeleton key={i} />
          ))}
        </div>
        {shouldShowMemberList && memberListComponent}
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "row",
          width: "100%",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <Typography color="error">Error loading messages</Typography>
        </div>
        {shouldShowMemberList && memberListComponent}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        height: "100%",
        width: "100%",
        position: "relative",
      }}
    >
      {/* Message Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          position: "relative",
        }}
      >
        {displayMessages.length > 0 ? (
          <Virtuoso
            ref={virtuosoRef}
            scrollerRef={(el) => {
              if (el instanceof HTMLDivElement) {
                (scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
              }
            }}
            style={{ flex: 1, minHeight: 0 }}
            data={displayMessages}
            initialTopMostItemIndex={displayMessages.length - 1}
            followOutput="smooth"
            alignToBottom
            atBottomStateChange={setAtBottom}
            startReached={handleStartReached}
            overscan={200}
            components={{
              Header: HeaderComponent,
            }}
            itemContent={(index, message) => {
              const isHighlighted = highlightMessageId === message.id;
              // Show divider after the last read message (before the first unread)
              const showDividerBeforeThis =
                unreadCount > 0 &&
                lastReadDisplayIndex >= 0 &&
                index === lastReadDisplayIndex + 1;

              return (
                <div style={{ padding: "0 16px" }}>
                  {showDividerBeforeThis && (
                    <UnreadMessageDivider unreadCount={unreadCount} />
                  )}
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
                      contextType={directMessageGroupId ? "dm" : "channel"}
                    />
                  </div>
                </div>
              );
            }}
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography color="text.secondary">
              {emptyStateMessage}
            </Typography>
          </div>
        )}

        {/* Input rendered outside Virtuoso — stable DOM, never unmounted by message changes */}
        <div style={{ padding: "0 16px 16px", flexShrink: 0 }}>
          {messageInput}
        </div>

        {!atBottom && (
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
      </div>

      {/* Member List */}
      {shouldShowMemberList && memberListComponent}
    </div>
  );
};

export default MessageContainer;
