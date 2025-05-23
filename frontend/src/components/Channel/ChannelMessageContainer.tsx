import React from "react";
import { useGetMessagesByChannelQuery } from "../../features/messages/messagesApiSlice";
import MessageComponent from "../Message/MessageComponent";
import { Typography } from "@mui/material";
import MessageSkeleton from "../Message/MessageSkeleton";
import MessageInput from "../Message/MessageInput";
import { useProfileQuery } from "../../features/users/usersSlice";
import { useCommunityJoin } from "../../hooks/useCommunityJoin";
import { useParams } from "react-router-dom";
import { useChannelWebSocket } from "../../hooks/useChannelWebSocket";
import { useDispatch, useSelector } from "react-redux";
import {
  appendMessages,
  makeSelectMessagesByChannel,
} from "../../features/messages/messagesSlice";
import type { RootState } from "../../app/store";
import type { Message } from "../../types/message.type";

interface ChannelMessageContainerProps {
  channelId: string;
}

const ChannelMessageContainer: React.FC<ChannelMessageContainerProps> = ({
  channelId,
}) => {
  const { data, error, isLoading } = useGetMessagesByChannelQuery({
    channelId,
  });
  const dispatch = useDispatch();
  const { data: user } = useProfileQuery();
  const authorId = user?.id || "";

  // Get communityId from context
  const { communityId } = useParams<{
    communityId: string;
  }>();
  useCommunityJoin(communityId);
  useChannelWebSocket(communityId);

  // Sync RTK Query data to Redux slice
  React.useEffect(() => {
    if (data && data.messages) {
      dispatch(
        appendMessages({
          channelId,
          messages: data.messages,
          continuationToken: data.continuationToken,
        })
      );
    }
  }, [data, channelId, dispatch]);

  // Memoized selector instance per component instance
  const selectMessagesByChannel = React.useMemo(
    makeSelectMessagesByChannel,
    []
  );
  const messages: Message[] = useSelector((state: RootState) =>
    selectMessagesByChannel(state, channelId)
  );

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
      }}
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
    </div>
  );
};

export default ChannelMessageContainer;
