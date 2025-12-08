import React, { useEffect, useRef, useState, useCallback } from "react";
import MessageComponent from "./MessageComponent";
import { Typography, Fab, useMediaQuery, useTheme } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import MessageSkeleton from "./MessageSkeleton";
import type { Message } from "../../types/message.type";

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
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const channelRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

  // Scroll to highlighted message when it's available
  useEffect(() => {
    if (highlightMessageId && messages.length > 0) {
      const messageEl = messageRefs.current.get(highlightMessageId);
      if (messageEl) {
        messageEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [highlightMessageId, messages]);

  const scrollToBottom = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.scrollTop = 0; // For column-reverse, 0 is the bottom
      setShowJumpToBottom(false);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!channelRef.current || isLoadingMore) return;

      const el = channelRef.current;

      // For flex-direction: column-reverse, scrollTop will be 0 when at the "bottom"
      const isAtBottom = Math.abs(el.scrollTop) < 50;
      setShowJumpToBottom(!isAtBottom);

      // Load more messages when scrolled to top (which is visually the "top" of old messages)
      const isNearTop = Math.abs(el.scrollTop) >= el.scrollHeight - el.clientHeight - 100;
      if (isNearTop && continuationToken && onLoadMore && !isLoadingMore) {
        onLoadMore();
      }
    };

    const scrollEl = channelRef.current;
    if (scrollEl) {
      scrollEl.addEventListener("scroll", handleScroll);
      return () => scrollEl.removeEventListener("scroll", handleScroll);
    }
  }, [continuationToken, isLoadingMore, onLoadMore]);

  // Auto-scroll when new messages arrive (if user is at bottom)
  useEffect(() => {
    if (!showJumpToBottom && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, showJumpToBottom, scrollToBottom]);

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
          flexDirection: "column-reverse",
          height: "100%",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column-reverse",
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            padding: "16px",
          }}
          ref={channelRef}
        >
        <div
          style={{
            position: "sticky",
            bottom: 0,
            background: "inherit",
            zIndex: 2,
          }}
        >
          {messageInput}
        </div>

        {messages && messages.length > 0 ? (
          messages.map((message) => {
            const isHighlighted = highlightMessageId === message.id;
            return (
              <div
                // Add highlightMessageId to key to force re-mount and replay animation
                key={isHighlighted ? `${message.id}-highlight` : message.id}
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
                />
              </div>
            );
          })
        ) : (
          <div
            style={{
              height: "100%",
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

        {isLoadingMore && (
          <div style={{ padding: "16px", textAlign: "center" }}>
            <MessageSkeleton />
            <MessageSkeleton />
            <MessageSkeleton />
          </div>
        )}
      </div>

        {showJumpToBottom && (
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