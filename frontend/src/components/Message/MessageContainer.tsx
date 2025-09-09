import React, { useEffect, useRef, useState, useCallback } from "react";
import MessageComponent from "./MessageComponent";
import { Typography, Fab } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import MessageSkeleton from "./MessageSkeleton";
import type { Message } from "../../types/message.type";

interface MessageContainerProps {
  // Data
  messages: Message[];
  isLoading: boolean;
  error: any;
  authorId: string;
  
  // Pagination
  continuationToken?: string;
  isLoadingMore: boolean;
  onLoadMore?: () => Promise<void>;
  
  // Message Input
  messageInput: React.ReactNode;
  
  // Optional customization
  emptyStateMessage?: string;
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
  emptyStateMessage = "No messages yet. Start the conversation!",
}) => {
  const channelRef = useRef<HTMLDivElement>(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

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

  if (isLoading) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "16px",
        }}
      >
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <MessageSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
        }}
      >
        <Typography color="error">Error loading messages</Typography>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column-reverse",
        height: "100%",
        width: "100%",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column-reverse",
          height: "100%",
          width: "100%",
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
          messages.map((message) => (
            <MessageComponent
              key={message.id}
              message={message}
              isAuthor={message.authorId === authorId}
            />
          ))
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
  );
};

export default MessageContainer;