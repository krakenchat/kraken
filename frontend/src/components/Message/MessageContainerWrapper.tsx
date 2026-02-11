import React from "react";
import MessageContainer from "../Message/MessageContainer";
import MessageInput from "./MessageInput";
import { useQuery } from "@tanstack/react-query";
import { userControllerGetProfileOptions } from "../../api-client/@tanstack/react-query.gen";
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
  highlightMessageId?: string;
  onOpenThread?: (message: Message) => void;
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
  highlightMessageId,
  onOpenThread,
}) => {
  const { data: user } = useQuery(userControllerGetProfileOptions());
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
      highlightMessageId={highlightMessageId}
      contextId={contextId}
      communityId={communityId}
      onOpenThread={onOpenThread}
      channelId={contextType === 'channel' ? contextId : undefined}
      directMessageGroupId={contextType === 'dm' ? contextId : undefined}
    />
  );
};

export default MessageContainerWrapper;