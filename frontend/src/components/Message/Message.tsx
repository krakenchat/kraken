import React from "react";
import { Typography } from "@mui/material";
import type { Message as MessageType, Span } from "../../types/message.type";
import { SpanType } from "../../types/message.type";

interface MessageProps {
  message: MessageType;
}

function renderSpan(span: Span, idx: number) {
  switch (span.type) {
    case SpanType.USER_MENTION:
      return (
        <span key={idx} style={{ color: "#1976d2", fontWeight: 600 }}>
          @{span.text || span.userId}
        </span>
      );
    case SpanType.SPECIAL_MENTION:
      return (
        <span key={idx} style={{ color: "#388e3c", fontWeight: 600 }}>
          @{span.text || span.specialKind}
        </span>
      );
    case SpanType.CHANNEL_MENTION:
      return (
        <span key={idx} style={{ color: "#7b1fa2", fontWeight: 600 }}>
          #{span.text || span.channelId}
        </span>
      );
    case SpanType.COMMUNITY_MENTION:
      return (
        <span key={idx} style={{ color: "#0288d1", fontWeight: 600 }}>
          @{span.text || span.communityId}
        </span>
      );
    case SpanType.ALIAS_MENTION:
      return (
        <span key={idx} style={{ color: "#fbc02d", fontWeight: 600 }}>
          @{span.text || span.aliasId}
        </span>
      );
    case SpanType.PLAINTEXT:
    default:
      return <span key={idx}>{span.text}</span>;
  }
}

function MessageComponent({ message }: MessageProps) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {message.authorId}
      </Typography>
      <Typography variant="body1">
        {message.spans.map((span, idx) => renderSpan(span, idx))}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {new Date(message.sentAt).toLocaleString()}
      </Typography>
    </div>
  );
}

export default MessageComponent;
