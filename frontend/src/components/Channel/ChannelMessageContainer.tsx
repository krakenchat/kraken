import React from "react";
import MessageContainerWrapper from "../Message/MessageContainerWrapper";
import MemberListContainer from "../Message/MemberListContainer";
import { useParams } from "react-router-dom";
import { useChannelMessages } from "../../hooks/useChannelMessages";
import { useSendMessageSocket } from "../../hooks/useSendMessageSocket";
import { useGetMembersForCommunityQuery } from "../../features/membership/membershipApiSlice";
import { useGetMentionableChannelsQuery } from "../../features/channel/channelApiSlice";
import { useProfileQuery } from "../../features/users/usersSlice";
import type { UserMention, ChannelMention } from "../../utils/mentionParser";

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

  const sendMessage = useSendMessageSocket(() => {});

  // Fetch community members and channels for mention resolution
  const { data: memberData = [] } = useGetMembersForCommunityQuery(communityId || "");
  const { data: channelData = [] } = useGetMentionableChannelsQuery(communityId || "");

  // Convert to mention format
  const userMentions: UserMention[] = React.useMemo(() => 
    memberData.map((member) => ({
      id: member.user!.id,
      username: member.user!.username,
      displayName: member.user!.displayName || undefined,
    })), [memberData]);

  const channelMentions: ChannelMention[] = React.useMemo(() =>
    channelData.map((channel) => ({
      id: channel.id,
      name: channel.name,
    })), [channelData]);

  // Get messages using the hook directly (not in callback)
  const messagesHookResult = useChannelMessages(channelId);
  
  // For channel messages, we'll pass the hook function itself and let UnifiedMessageInput handle it

  const handleSendMessage = (messageContent: string, spans: unknown[]) => {
    const msg = {
      channelId,
      authorId,
      spans,
      attachments: [],
      reactions: [],
      sentAt: new Date().toISOString(),
    };
    sendMessage(msg);
  };

  // Create member list component for the channel
  const memberListComponent = (
    <MemberListContainer
      contextType="channel"
      contextId={channelId}
      communityId={communityId}
    />
  );

  return (
    <MessageContainerWrapper
      contextType="channel"
      contextId={channelId}
      communityId={communityId}
      useMessagesHook={() => messagesHookResult}
      userMentions={userMentions}
      channelMentions={channelMentions}
      onSendMessage={handleSendMessage}
      memberListComponent={memberListComponent}
      placeholder="Type a message... Use @ for members, @here, @channel"
      emptyStateMessage="No messages yet. Start the conversation!"
    />
  );
};

export default ChannelMessageContainer;
