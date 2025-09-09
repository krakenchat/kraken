import React from "react";
import MessageContainer from "../Message/MessageContainer";
import MessageInput from "../Message/MessageInput";
import { useProfileQuery } from "../../features/users/usersSlice";
import { useParams } from "react-router-dom";
import { useChannelMessages } from "../../hooks/useChannelMessages";

interface ChannelMessageContainerProps {
  channelId: string;
}

const ChannelMessageContainer: React.FC<ChannelMessageContainerProps> = ({
  channelId,
}) => {
  const { data: user } = useProfileQuery();
  const authorId = user?.id || "";

  // Get communityId from context
  const { communityId } = useParams<{
    communityId: string;
  }>();

  // Use the shared hook for channel messages
  const {
    messages,
    isLoading,
    error,
    continuationToken,
    isLoadingMore,
    onLoadMore,
  } = useChannelMessages(channelId);

  // Create the message input component
  const messageInput = (
    <MessageInput 
      channelId={channelId} 
      authorId={authorId} 
      communityId={communityId || ""}
    />
  );

  return (
    <MessageContainer
      messages={messages}
      isLoading={isLoading}
      error={error}
      authorId={authorId}
      continuationToken={continuationToken}
      isLoadingMore={isLoadingMore}
      onLoadMore={onLoadMore}
      messageInput={messageInput}
      emptyStateMessage="No messages yet. Start the conversation!"
    />
  );
};

export default ChannelMessageContainer;
