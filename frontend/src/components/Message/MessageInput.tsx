/**
 * MessageInput Component
 *
 * Wrapper component that routes to the appropriate message input implementation
 * based on context type (channel vs DM).
 *
 * This component maintains backward compatibility while delegating to specialized
 * components for better code organization and maintainability.
 */

import React from "react";
import { ChannelMessageInput } from "./ChannelMessageInput";
import { DmMessageInput } from "./DmMessageInput";
import type { UserMention, ChannelMention } from "../../utils/mentionParser";
import type { Span } from "../../types/message.type";

export interface MessageInputProps {
  contextType: 'channel' | 'dm';
  contextId: string;
  userMentions: UserMention[];
  channelMentions?: ChannelMention[];
  onSendMessage: (messageContent: string, spans: Span[], files?: File[]) => void;
  placeholder?: string;
  communityId?: string; // For channels to use mention autocomplete
}

export default function MessageInput({
  contextType,
  userMentions,
  channelMentions = [],
  onSendMessage,
  placeholder = "Type a message...",
  communityId,
}: MessageInputProps) {
  if (contextType === 'channel' && communityId) {
    return (
      <ChannelMessageInput
        communityId={communityId}
        userMentions={userMentions}
        channelMentions={channelMentions}
        onSendMessage={onSendMessage}
        placeholder={placeholder}
      />
    );
  }

  return (
    <DmMessageInput
      userMentions={userMentions}
      onSendMessage={onSendMessage}
      placeholder={placeholder}
    />
  );
}
