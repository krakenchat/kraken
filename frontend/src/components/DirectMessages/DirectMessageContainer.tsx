import React from "react";
import MessageContainer from "../Message/MessageContainer";
import DirectMessageInput from "./DirectMessageInput";
import { useProfileQuery } from "../../features/users/usersSlice";
import { useDirectMessages } from "../../hooks/useDirectMessages";
import { useDirectMessageWebSocket } from "../../hooks/useDirectMessageWebSocket";

interface DirectMessageContainerProps {
  dmGroupId: string;
}

const DirectMessageContainer: React.FC<DirectMessageContainerProps> = ({
  dmGroupId,
}) => {
  const { data: user } = useProfileQuery();
  const authorId = user?.id || "";
  
  // Use DM-specific WebSocket hook for sending messages
  const { sendDirectMessage } = useDirectMessageWebSocket();

  // Use the shared hook for DM messages
  const {
    messages,
    isLoading,
    error,
    continuationToken,
    isLoadingMore,
    onLoadMore,
  } = useDirectMessages(dmGroupId);

  const handleSendMessage = (messageContent: string, spans: any[]) => {
    console.log("[DirectMessageContainer] Received message to send:", { messageContent, spans, dmGroupId });
    // Send direct message via WebSocket
    console.log("[DirectMessageContainer] Calling sendDirectMessage...");
    sendDirectMessage(dmGroupId, spans);
    console.log("[DirectMessageContainer] sendDirectMessage called");
  };

  // Create the message input component
  const messageInput = (
    <DirectMessageInput
      dmGroupId={dmGroupId}
      onSendMessage={handleSendMessage}
      placeholder="Type a direct message..."
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

export default DirectMessageContainer;