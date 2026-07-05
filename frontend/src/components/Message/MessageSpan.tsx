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
    case SpanType.CODE_BLOCK:
      return (
        <pre
          key={index}
          style={{
            margin: '4px 0',
            padding: '8px 12px',
            borderRadius: 6,
            backgroundColor: theme.palette.action.hover,
            border: `1px solid ${theme.palette.divider}`,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            fontSize: '0.85em',
            whiteSpace: 'pre-wrap',
            overflowX: 'auto',
            wordBreak: 'break-word',
          }}
        >
          <code>{span.text ?? ""}</code>
        </pre>
      );
    case SpanType.PLAINTEXT:
    default: {
      let content: React.ReactNode;

      if (span.code) {
        // Inline code is verbatim: no auto-linking or further parsing.
        content = (
          <code
            style={{
              padding: '1px 5px',
              borderRadius: 4,
              backgroundColor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
              fontSize: '0.85em',
            }}
          >
            {span.text ?? ""}
          </code>
        );
      } else {
        // Split text into segments: plain text and URLs (auto-link).
        const urlPattern = /(https?:\/\/[^\s<>)"']*[^\s<>)"'.,!?;:])/g;
        const parts = (span.text ?? "").split(urlPattern);

        content = parts.map((part, i) =>
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
        );
      }

      // Compose the inline-formatting flags by nesting wrappers.
      if (span.strikethrough) content = <s>{content}</s>;
      if (span.italic) content = <em>{content}</em>;
      if (span.bold) content = <strong>{content}</strong>;

      return <span key={index}>{content}</span>;
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
