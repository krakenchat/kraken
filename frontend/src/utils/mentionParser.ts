import { SpanType, MessageSpan } from "../types/message.type";

export interface MentionMatch {
  type: 'user' | 'channel';
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

/**
 * Parse message text for potential mentions (@user, #channel)
 * Returns array of mention objects with positions
 */
export function findMentions(text: string): MentionMatch[] {
  const mentions: MentionMatch[] = [];
  
  // User mentions pattern: @word (word can contain letters, numbers, underscore, hyphen)
  const userMentionRegex = /@(\w[\w\-_]*)/g;
  let match;
  
  while ((match = userMentionRegex.exec(text)) !== null) {
    mentions.push({
      type: 'user',
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      query: match[1],
    });
  }
  
  // Channel mentions pattern: #word
  const channelMentionRegex = /#(\w[\w\-_]*)/g;
  
  while ((match = channelMentionRegex.exec(text)) !== null) {
    mentions.push({
      type: 'channel',
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      query: match[1],
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
  channelMentions: ChannelMention[] = []
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
    } else if (mention.type === 'channel') {
      const resolvedChannel = channelMentions.find(
        channel => channel.name.toLowerCase() === mention.query.toLowerCase()
      );
      
      if (resolvedChannel) {
        spans.push({
          type: SpanType.CHANNEL_MENTION,
          text: `#${resolvedChannel.name}`,
          channelId: resolvedChannel.id,
        });
      } else {
        // Unresolved mention becomes plaintext
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
      case SpanType.CHANNEL_MENTION:
        return span.text || `#channel`;
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
): { type: 'user' | 'channel'; query: string; start: number; end: number } | null {
  // Look backwards from cursor to find start of potential mention
  let start = cursorPosition;
  
  // Find the start of the current word/mention
  while (start > 0) {
    const char = text[start - 1];
    if (char === '@' || char === '#') {
      const mentionType = char === '@' ? 'user' : 'channel';
      const query = text.substring(start, cursorPosition);
      
      // Validate query (should only contain valid mention characters)
      if (/^[\w\-_]*$/.test(query)) {
        return {
          type: mentionType,
          query,
          start: start - 1, // Include the @ or #
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
  mention: { type: 'user' | 'channel'; username?: string; name?: string }
): { newText: string; newCursorPosition: number } {
  const currentMention = getCurrentMention(text, cursorPosition);
  
  if (!currentMention) {
    // No current mention, just insert at cursor
    const prefix = mention.type === 'user' ? '@' : '#';
    const mentionText = mention.type === 'user' ? mention.username : mention.name;
    const insertText = `${prefix}${mentionText} `;
    
    const newText = text.slice(0, cursorPosition) + insertText + text.slice(cursorPosition);
    return {
      newText,
      newCursorPosition: cursorPosition + insertText.length,
    };
  }
  
  // Replace current mention
  const mentionText = mention.type === 'user' ? mention.username : mention.name;
  const insertText = `${mention.type === 'user' ? '@' : '#'}${mentionText} `;
  
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
  users: UserMention[] = [],
  channels: ChannelMention[] = []
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
      
    case SpanType.CHANNEL_MENTION:
      if (span.channelId) {
        const channel = channels.find(c => c.id === span.channelId);
        if (channel) {
          return `#${channel.name}`;
        }
      }
      return span.text || '#unknown';
      
    case SpanType.PLAINTEXT:
    default:
      return span.text || '';
  }
}