/**
 * MessageSpan Component
 *
 * Renders individual message spans with appropriate styling.
 * Supports mentions (user, special, community, alias) and plain text.
 */

import React from "react";
import { useTheme } from "@mui/material/styles";
import { Span, SpanType } from "../../types/message.type";

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
    default: {
      // Split text into segments: plain text and URLs
      const urlPattern = /(https?:\/\/[^\s<>)"']+)/g;
      const parts = span.text.split(urlPattern);

      return (
        <span key={index}>
          {parts.map((part, i) =>
            /^https?:\/\//.test(part) ? (
              <a
                key={i}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: theme.palette.primary.main, textDecoration: 'underline' }}
              >
                {part}
              </a>
            ) : (
              <React.Fragment key={i}>{part}</React.Fragment>
            )
          )}
        </span>
      );
    }
  }
};

/**
 * Render an array of message spans
 */
// eslint-disable-next-line react-refresh/only-export-components
export const renderMessageSpans = (spans: Span[]): React.ReactNode => {
  return spans.map((span, idx) => <MessageSpan key={idx} span={span} index={idx} />);
};
