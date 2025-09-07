import { SpanType, MessageSpan } from "../types/message.type";

export interface MentionMatch {
  type: 'user' | 'special';
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

/**
 * Parse message text for potential mentions (@user, @here, @channel)
 * Returns array of mention objects with positions
 */
export function findMentions(text: string): MentionMatch[] {
  const mentions: MentionMatch[] = [];
  
  // User mentions pattern: @word (word can contain letters, numbers, underscore, hyphen)
  const userMentionRegex = /@(\w[\w\-_]*)/g;
  let match;
  
  while ((match = userMentionRegex.exec(text)) !== null) {
    const query = match[1];
    // Check if this is a special mention
    if (query === 'here' || query === 'channel') {
      mentions.push({
        type: 'special',
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        query: query,
      });
    } else {
      mentions.push({
        type: 'user',
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        query: query,
      });
    }
  }
  
  return mentions.sort((a, b) => a.start - b.start);
}

/**
 * Parse message text with resolved mentions into MessageSpan array
 * Used when converting user input to database spans
 */
export function parseMessageWithMentions(
  text: string,
  userMentions: UserMention[] = []
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
    } else if (mention.type === 'special') {
      // Special mentions (@here, @channel)
      spans.push({
        type: SpanType.SPECIAL_MENTION,
        text: mention.text,
        specialKind: mention.query,
      });
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
): { type: 'user' | 'special'; query: string; start: number; end: number } | null {
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
  mention: { type: 'user' | 'special'; username?: string; specialKind?: string }
): { newText: string; newCursorPosition: number } {
  const currentMention = getCurrentMention(text, cursorPosition);
  
  if (!currentMention) {
    // No current mention, just insert at cursor
    const mentionText = mention.type === 'user' ? mention.username : mention.specialKind;
    const insertText = `@${mentionText} `;
    
    const newText = text.slice(0, cursorPosition) + insertText + text.slice(cursorPosition);
    return {
      newText,
      newCursorPosition: cursorPosition + insertText.length,
    };
  }
  
  // Replace current mention
  const mentionText = mention.type === 'user' ? mention.username : mention.specialKind;
  const insertText = `@${mentionText} `;
  
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