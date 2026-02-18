import { SpanType, Span as MessageSpan } from "../types/message.type";

export interface MentionMatch {
  type: 'user' | 'special' | 'channel' | 'alias';
  start: number;
  end: number;
  text: string;
  query: string;
  id?: string;
}

export interface UserMention {
  id: string;
  username: string;
  displayName?: string;
}

export interface ChannelMention {
  id: string;
  name: string;
}

export interface AliasMention {
  id: string;
  name: string;
}

/**
 * Find regions in text that are inside code blocks or inline code.
 * Returns array of [start, end] ranges that should be excluded from mention parsing.
 */
export function getCodeRegions(text: string): [number, number][] {
  const regions: [number, number][] = [];

  // Match fenced code blocks (```...```) first, then inline code (`...`)
  const codeRegex = /```[\s\S]*?```|`[^`]+`/g;
  let match;
  while ((match = codeRegex.exec(text)) !== null) {
    regions.push([match.index, match.index + match[0].length]);
  }

  return regions;
}

/**
 * Check if a position falls inside any code region
 */
function isInsideCodeRegion(position: number, end: number, regions: [number, number][]): boolean {
  return regions.some(([start, regionEnd]) => position >= start && end <= regionEnd);
}

/**
 * Parse message text for potential mentions (@user, @here, @channel, #channel)
 * Returns array of mention objects with positions.
 * Mentions inside code blocks/inline code are excluded.
 */
export function findMentions(text: string): MentionMatch[] {
  const mentions: MentionMatch[] = [];
  const codeRegions = getCodeRegions(text);

  // User mentions pattern: @word (word can contain letters, numbers, underscore, hyphen)
  const userMentionRegex = /@(\w[\w\-_]*)/g;
  let match;

  while ((match = userMentionRegex.exec(text)) !== null) {
    const matchEnd = match.index + match[0].length;
    if (isInsideCodeRegion(match.index, matchEnd, codeRegions)) continue;

    const query = match[1];
    // Check if this is a special mention
    if (query === 'here' || query === 'channel') {
      mentions.push({
        type: 'special',
        start: match.index,
        end: matchEnd,
        text: match[0],
        query: query,
      });
    } else {
      mentions.push({
        type: 'user',
        start: match.index,
        end: matchEnd,
        text: match[0],
        query: query,
      });
    }
  }

  // Channel mentions pattern: #word (word can contain letters, numbers, underscore, hyphen)
  const channelMentionRegex = /#(\w[\w\-_]*)/g;

  while ((match = channelMentionRegex.exec(text)) !== null) {
    const matchEnd = match.index + match[0].length;
    if (isInsideCodeRegion(match.index, matchEnd, codeRegions)) continue;

    const query = match[1];
    mentions.push({
      type: 'channel',
      start: match.index,
      end: matchEnd,
      text: match[0],
      query: query,
    });
  }

  return mentions.sort((a, b) => a.start - b.start);
}

/**
 * Parse message text with resolved mentions into MessageSpan array
 * Used when converting user input to database spans
 */
export function parseMessageWithMentions(
  text: string,
  userMentions: UserMention[] = [],
  channelMentions: ChannelMention[] = [],
  aliasMentions: AliasMention[] = []
): MessageSpan[] {
  const spans: MessageSpan[] = [];
  const mentions = findMentions(text);

  let lastIndex = 0;

  for (const mention of mentions) {
    // Add plaintext before this mention
    if (mention.start > lastIndex) {
      const plaintext = text.substring(lastIndex, mention.start);
      if (plaintext) {
        spans.push({
          type: SpanType.PLAINTEXT,
          text: plaintext,
        });
      }
    }

    // Find resolved mention
    if (mention.type === 'user') {
      // First check if this is an alias group mention
      const resolvedAlias = aliasMentions.find(
        alias => alias.name.toLowerCase() === mention.query.toLowerCase()
      );

      if (resolvedAlias) {
        spans.push({
          type: SpanType.ALIAS_MENTION,
          text: `@${resolvedAlias.name}`,
          aliasId: resolvedAlias.id,
        });
      } else {
        // Then check if it's a user mention
        const resolvedUser = userMentions.find(
          user => user.username.toLowerCase() === mention.query.toLowerCase()
        );

        if (resolvedUser) {
          spans.push({
            type: SpanType.USER_MENTION,
            text: `@${resolvedUser.username}`,
            userId: resolvedUser.id,
          });
        } else {
          // Unresolved mention becomes plaintext
          spans.push({
            type: SpanType.PLAINTEXT,
            text: mention.text,
          });
        }
      }
    } else if (mention.type === 'special') {
      // Special mentions (@here, @channel)
      spans.push({
        type: SpanType.SPECIAL_MENTION,
        text: mention.text,
        specialKind: mention.query,
      });
    } else if (mention.type === 'channel') {
      // Channel mentions (#channel-name)
      const resolvedChannel = channelMentions.find(
        channel => channel.name.toLowerCase() === mention.query.toLowerCase()
      );

      if (resolvedChannel) {
        spans.push({
          type: SpanType.COMMUNITY_MENTION,
          text: `#${resolvedChannel.name}`,
          communityId: resolvedChannel.id,
        });
      } else {
        // Unresolved channel mention becomes plaintext
        spans.push({
          type: SpanType.PLAINTEXT,
          text: mention.text,
        });
      }
    }

    lastIndex = mention.end;
  }

  // Add remaining plaintext
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      spans.push({
        type: SpanType.PLAINTEXT,
        text: remainingText,
      });
    }
  }

  // If no mentions were found, return single plaintext span
  if (spans.length === 0 && text.trim()) {
    spans.push({
      type: SpanType.PLAINTEXT,
      text: text,
    });
  }

  return spans;
}

/**
 * Convert message spans back to display text for editing
 * Used when loading existing message for editing
 */
export function spansToText(spans: MessageSpan[]): string {
  return spans.map(span => {
    switch (span.type) {
      case SpanType.USER_MENTION:
        return span.text || `@user`;
      case SpanType.SPECIAL_MENTION:
        return span.text || `@${span.specialKind}`;
      case SpanType.PLAINTEXT:
      default:
        return span.text || '';
    }
  }).join('');
}

/**
 * Get the current mention being typed (if any) at cursor position
 * Returns null if no mention, or mention info if typing a mention
 */
export function getCurrentMention(
  text: string,
  cursorPosition: number
): { type: 'user' | 'special' | 'channel'; query: string; start: number; end: number } | null {
  // Look backwards from cursor to find start of potential mention
  let start = cursorPosition;

  // Find the start of the current word/mention
  while (start > 0) {
    const char = text[start - 1];
    if (char === '@') {
      const query = text.substring(start, cursorPosition);

      // Validate query (should only contain valid mention characters)
      if (/^[\w\-_]*$/.test(query)) {
        // Determine if this is a special mention
        const mentionType = (query === 'here' || query === 'channel') ? 'special' : 'user';
        return {
          type: mentionType,
          query,
          start: start - 1, // Include the @
          end: cursorPosition,
        };
      }
      break;
    } else if (char === '#') {
      const query = text.substring(start, cursorPosition);

      // Validate query (should only contain valid mention characters)
      if (/^[\w\-_]*$/.test(query)) {
        return {
          type: 'channel',
          query,
          start: start - 1, // Include the #
          end: cursorPosition,
        };
      }
      break;
    } else if (/[\w\-_]/.test(char)) {
      start--;
    } else {
      // Hit a non-mention character, stop looking
      break;
    }
  }

  return null;
}

/**
 * Insert a resolved mention into text at the current cursor position
 * Used when user selects a mention from autocomplete
 */
export function insertMention(
  text: string,
  cursorPosition: number,
  mention: { type: 'user' | 'special' | 'channel' | 'alias'; username?: string; specialKind?: string; channelName?: string; aliasName?: string }
): { newText: string; newCursorPosition: number } {
  const currentMention = getCurrentMention(text, cursorPosition);

  if (!currentMention) {
    // No current mention, just insert at cursor
    let insertText: string;
    if (mention.type === 'user') {
      insertText = `@${mention.username} `;
    } else if (mention.type === 'special') {
      insertText = `@${mention.specialKind} `;
    } else if (mention.type === 'alias') {
      insertText = `@${mention.aliasName} `;
    } else {
      insertText = `#${mention.channelName} `;
    }

    const newText = text.slice(0, cursorPosition) + insertText + text.slice(cursorPosition);
    return {
      newText,
      newCursorPosition: cursorPosition + insertText.length,
    };
  }

  // Replace current mention
  let insertText: string;
  if (mention.type === 'user') {
    insertText = `@${mention.username} `;
  } else if (mention.type === 'special') {
    insertText = `@${mention.specialKind} `;
  } else if (mention.type === 'alias') {
    insertText = `@${mention.aliasName} `;
  } else {
    insertText = `#${mention.channelName} `;
  }

  const newText = text.slice(0, currentMention.start) + insertText + text.slice(currentMention.end);
  return {
    newText,
    newCursorPosition: currentMention.start + insertText.length,
  };
}

/**
 * Resolve mention text for display purposes
 * Used in MessageComponent to show resolved mentions
 */
export function resolveMentionText(
  span: MessageSpan,
  users: UserMention[] = []
): string {
  switch (span.type) {
    case SpanType.USER_MENTION:
      if (span.userId) {
        const user = users.find(u => u.id === span.userId);
        if (user) {
          return `@${user.displayName || user.username}`;
        }
      }
      return span.text || '@unknown';
      
    case SpanType.SPECIAL_MENTION:
      return span.text || `@${span.specialKind}`;
      
    case SpanType.PLAINTEXT:
    default:
      return span.text || '';
  }
}