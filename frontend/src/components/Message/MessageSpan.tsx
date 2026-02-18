/**
 * MessageSpan Component
 *
 * Renders individual message spans with appropriate styling.
 * Supports mentions (user, special, community, alias) and plain text.
 */

import React from "react";
import { useTheme } from "@mui/material/styles";
import { Span, SpanType } from "../../types/message.type";
import { MarkdownRenderer } from "./MarkdownRenderer";

export interface MessageSpanProps {
  span: Span;
  index: number;
}

/**
 * Render a single message span with type-specific styling
 */
export const MessageSpan: React.FC<MessageSpanProps> = ({ span, index }) => {
  const theme = useTheme();

  switch (span.type) {
    case SpanType.USER_MENTION:
      return (
        <span key={index} style={{ color: theme.palette.primary.main, fontWeight: 600 }}>
          {span.text || span.userId}
        </span>
      );
    case SpanType.SPECIAL_MENTION:
      return (
        <span key={index} style={{ color: theme.palette.semantic.status.positive, fontWeight: 600 }}>
          @{span.specialKind}
        </span>
      );
    case SpanType.COMMUNITY_MENTION:
      return (
        <span key={index} style={{ color: theme.palette.primary.light, fontWeight: 600 }}>
          {span.text || span.communityId}
        </span>
      );
    case SpanType.ALIAS_MENTION:
      return (
        <span key={index} style={{ color: theme.palette.warning.main, fontWeight: 600 }}>
          {span.text || span.aliasId}
        </span>
      );
    case SpanType.PLAINTEXT:
    default:
      return <MarkdownRenderer key={index} text={span.text || ""} />;
  }
};

/**
 * Render an array of message spans
 */
// eslint-disable-next-line react-refresh/only-export-components
export const renderMessageSpans = (spans: Span[]): React.ReactNode => {
  return spans.map((span, idx) => <MessageSpan key={idx} span={span} index={idx} />);
};
