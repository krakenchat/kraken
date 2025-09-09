import React from "react";
import MessageContainerWrapper from "../Message/MessageContainerWrapper";
import MemberListContainer from "../Message/MemberListContainer";
import { useDirectMessages } from "../../hooks/useDirectMessages";
import { useDirectMessageWebSocket } from "../../hooks/useDirectMessageWebSocket";
import { useGetDmGroupQuery } from "../../features/directMessages/directMessagesApiSlice";
import type { UserMention } from "../../utils/mentionParser";

interface DirectMessageContainerProps {
  dmGroupId: string;
}

const DirectMessageContainer: React.FC<DirectMessageContainerProps> = ({
  dmGroupId,
}) => {
  // Use DM-specific WebSocket hook for sending messages
  const { sendDirectMessage } = useDirectMessageWebSocket();

  // Get DM group info to get members for mentions
  const { data: dmGroup } = useGetDmGroupQuery(dmGroupId);

  // Convert DM group members to mention format
  const userMentions: UserMention[] = React.useMemo(() => {
    return dmGroup?.members?.map((member) => ({
      id: member.user.id,
      username: member.user.username,
      displayName: member.user.displayName || undefined,
    })) || [];
  }, [dmGroup?.members]);

  // Get messages using the hook directly (not in callback)
  const messagesHookResult = useDirectMessages(dmGroupId);

  const handleSendMessage = (messageContent: string, spans: unknown[]) => {
    console.log("[DirectMessageContainer] Received message to send:", { messageContent, spans, dmGroupId });
    // Send direct message via WebSocket
    console.log("[DirectMessageContainer] Calling sendDirectMessage...");
    sendDirectMessage(dmGroupId, spans);
    console.log("[DirectMessageContainer] sendDirectMessage called");
  };

  // Create member list component for the DM group
  const memberListComponent = (
    <MemberListContainer
      contextType="dm"
      contextId={dmGroupId}
    />
  );

  return (
    <MessageContainerWrapper
      contextType="dm"
      contextId={dmGroupId}
      useMessagesHook={() => messagesHookResult}
      userMentions={userMentions}
      onSendMessage={handleSendMessage}
      memberListComponent={memberListComponent}
      placeholder="Type a direct message..."
      emptyStateMessage="No messages yet. Start the conversation!"
    />
  );
};

export default DirectMessageContainer;