import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  useGetMessagesByChannelQuery,
  useLazyGetMessagesByChannelQuery,
} from "../../features/messages/messagesApiSlice";
import MessageComponent from "../Message/MessageComponent";
import { Typography } from "@mui/material";
import MessageSkeleton from "../Message/MessageSkeleton";
import MessageInput from "../Message/MessageInput";
import { useProfileQuery } from "../../features/users/usersSlice";
import { useParams } from "react-router-dom";
import { useChannelWebSocket } from "../../hooks/useChannelWebSocket";
import { useSelector } from "react-redux";
import {
  makeSelectMessagesByChannel,
  makeSelectContinuationTokenByChannel,
} from "../../features/messages/messagesSlice";
import type { RootState } from "../../app/store";
import type { Message } from "../../types/message.type";

interface ChannelMessageContainerProps {
  channelId: string;
}

const ChannelMessageContainer: React.FC<ChannelMessageContainerProps> = ({
  channelId,
}) => {
  const { error, isLoading } = useGetMessagesByChannelQuery({
    channelId,
  });
  const { data: user } = useProfileQuery();
  const authorId = user?.id || "";
  const channelRef = useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Get communityId from context
  const { communityId } = useParams<{
    communityId: string;
  }>();
  useChannelWebSocket(communityId);

  // Note: RTK Query now automatically syncs data to Redux slice via onQueryStarted

  // Memoized selector instances per component instance
  const selectMessagesByChannel = React.useMemo(
    makeSelectMessagesByChannel,
    []
  );
  const selectContinuationTokenByChannel = React.useMemo(
    makeSelectContinuationTokenByChannel,
    []
  );

  const messages: Message[] = useSelector((state: RootState) =>
    selectMessagesByChannel(state, channelId)
  );
  const continuationToken = useSelector((state: RootState) =>
    selectContinuationTokenByChannel(state, channelId)
  );

  // RTK Query lazy query for loading more messages
  const [loadMoreMessages] = useLazyGetMessagesByChannelQuery();

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !continuationToken) {
      return;
    }

    console.log("🚀 Loading more messages with token:", continuationToken);
    setIsLoadingMore(true);

    try {
      await loadMoreMessages({
        channelId,
        continuationToken,
        limit: 25,
      }).unwrap();
    } catch (error) {
      console.error("Failed to load more messages:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [channelId, continuationToken, isLoadingMore, loadMoreMessages]);

  useEffect(() => {
    const handleScroll = () => {
      if (!channelRef.current || isLoadingMore) return;

      const el = channelRef.current;

      // For flex-direction: column-reverse, scrollTop will be 0 when at the "bottom"
      // (which is visually the top due to reverse direction)
      // We want to detect when user scrolls to the actual bottom (oldest messages)
      const scrolledToBottom =
        Math.abs(el.scrollTop) + el.clientHeight >= el.scrollHeight - 10;

      if (scrolledToBottom && continuationToken) {
        console.log("🚀 Scrolled to bottom, loading more messages...");
        handleLoadMore();
      } else if (scrolledToBottom && !continuationToken) {
        console.log("📄 Reached the end - no more messages to load");
      }
    };

    const element = channelRef.current;
    if (element) {
      element.addEventListener("scroll", handleScroll, { passive: true });
      return () => {
        element.removeEventListener("scroll", handleScroll);
      };
    }
  }, [handleLoadMore, isLoadingMore, continuationToken]);

  if (isLoading) {
    // Estimate how many skeletons to fill the viewport (e.g., 18px+8px per message, 100vh)
    // We'll use 24 as a safe default for most screens
    const skeletonCount = 24;
    return (
      <div
        className="channel-message-container"
        style={{
          display: "flex",
          flexDirection: "column-reverse",
          gap: 0,
          height: "100%",
          width: "100%",
          overflow: "hidden", // Prevent scrollbars while loading
        }}
      >
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <MessageSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (error)
    return <Typography color="error">Error loading messages</Typography>;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column-reverse",
        height: "100%",
        width: "100%",
        position: "relative",
        overflowY: "auto", // Enable vertical scrolling
        overflowX: "hidden", // Prevent horizontal scrolling
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
        <MessageInput channelId={channelId} authorId={authorId} />
      </div>
      {messages.map((msg: Message) => (
        <MessageComponent key={msg.id} message={msg} />
      ))}
      {isLoadingMore && (
        <div style={{ padding: "16px", textAlign: "center" }}>
          <MessageSkeleton />
          <MessageSkeleton />
          <MessageSkeleton />
        </div>
      )}
    </div>
  );
};

export default ChannelMessageContainer;
