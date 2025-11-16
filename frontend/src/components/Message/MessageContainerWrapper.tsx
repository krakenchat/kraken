import React from "react";
import MessageContainer from "../Message/MessageContainer";
import MessageInput from "./MessageInput";
import { useProfileQuery } from "../../features/users/usersSlice";
import type { Message, Span } from "../../types/message.type";
import type { UserMention, ChannelMention } from "../../utils/mentionParser";


export interface MessagesHookResult {
  messages: Message[];
  isLoading: boolean;
  error: unknown;
  continuationToken?: string;
  isLoadingMore: boolean;
  onLoadMore?: () => Promise<void>;
}

export interface MessageContainerWrapperProps {
  contextType: 'channel' | 'dm';
  contextId: string;
  communityId?: string;
  useMessagesHook: () => MessagesHookResult;
  userMentions: UserMention[];
  channelMentions?: ChannelMention[];
  onSendMessage: (messageContent: string, spans: Span[], files?: File[]) => void;
  memberListComponent?: React.ReactNode;
  placeholder?: string;
  emptyStateMessage?: string;
}

const MessageContainerWrapper: React.FC<MessageContainerWrapperProps> = ({
  contextType,
  contextId,
  communityId,
  useMessagesHook,
  userMentions,
  channelMentions,
  onSendMessage,
  memberListComponent,
  placeholder = "Type a message...",
  emptyStateMessage = "No messages yet. Start the conversation!",
}) => {
  const { data: user } = useProfileQuery();
  const authorId = user?.id || "";
  
  // Use the injected hook for messages
  const {
    messages,
    isLoading,
    error,
    continuationToken,
    isLoadingMore,
    onLoadMore,
  } = useMessagesHook();

  // Create the message input component
  const messageInput = (
    <MessageInput
      contextType={contextType}
      contextId={contextId}
      userMentions={userMentions}
      channelMentions={channelMentions}
      onSendMessage={onSendMessage}
      placeholder={placeholder}
      communityId={communityId}
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
      memberListComponent={memberListComponent}
      emptyStateMessage={emptyStateMessage}
    />
  );
};

export default MessageContainerWrapper;