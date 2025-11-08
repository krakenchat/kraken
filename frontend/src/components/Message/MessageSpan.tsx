/**
 * MessageSpan Component
 *
 * Renders individual message spans with appropriate styling.
 * Supports mentions (user, special, community, alias) and plain text.
 */

import React from "react";
import { Span, SpanType } from "../../types/message.type";

export interface MessageSpanProps {
  span: Span;
  index: number;
}

/**
 * Render a single message span with type-specific styling
 */
export const MessageSpan: React.FC<MessageSpanProps> = ({ span, index }) => {
  switch (span.type) {
    case SpanType.USER_MENTION:
      return (
        <span key={index} style={{ color: "#1976d2", fontWeight: 600 }}>
          {span.text || span.userId}
        </span>
      );
    case SpanType.SPECIAL_MENTION:
      return (
        <span key={index} style={{ color: "#388e3c", fontWeight: 600 }}>
          @{span.specialKind}
        </span>
      );
    case SpanType.COMMUNITY_MENTION:
      return (
        <span key={index} style={{ color: "#0288d1", fontWeight: 600 }}>
          {span.text || span.communityId}
        </span>
      );
    case SpanType.ALIAS_MENTION:
      return (
        <span key={index} style={{ color: "#fbc02d", fontWeight: 600 }}>
          {span.text || span.aliasId}
        </span>
      );
    case SpanType.PLAINTEXT:
    default:
      return <span key={index}>{span.text}</span>;
  }
};

/**
 * Render an array of message spans
 */
export const renderMessageSpans = (spans: Span[]): React.ReactNode => {
  return spans.map((span, idx) => <MessageSpan key={idx} span={span} index={idx} />);
};
