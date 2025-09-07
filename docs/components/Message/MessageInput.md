# MessageInput Component

> **Location:** `frontend/src/components/Message/MessageInput.tsx`  
> **Type:** Message Input with Mention Autocomplete  
> **Feature:** message-input, mention-system

## Overview

The MessageInput component provides a sophisticated message input interface with real-time mention autocomplete for users and channels. It integrates seamlessly with the mention system, WebSocket messaging, and rich text parsing to deliver a Discord-like messaging experience with keyboard shortcuts, autocomplete suggestions, and span-based message composition.

## Props Interface

```typescript
interface MessageInputProps {
  channelId: string;        // Target channel for messages
  authorId: string;         // Current user's ID (message author)
  communityId: string;      // Community ID for mention resolution
}
```

## Usage Examples

### Basic Integration in Channel Container

```tsx
import MessageInput from '@/components/Message/MessageInput';

function ChannelMessageContainer({ channelId, communityId, authorId }: {
  channelId: string;
  communityId: string;
  authorId: string;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Message list */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {messages?.map(message => (
          <MessageComponent key={message.id} message={message} />
        ))}
      </Box>
      
      {/* Message input */}
      <Box sx={{ 
        position: 'sticky',
        bottom: 0,
        backgroundColor: 'background.paper',
        zIndex: 2,
      }}>
        <MessageInput 
          channelId={channelId} 
          authorId={authorId} 
          communityId={communityId}
        />
      </Box>
    </Box>
  );
}
```

### Standalone Usage

```tsx
function DirectMessageInput({ recipientId, authorId }: {
  recipientId: string;
  authorId: string;
}) {
  return (
    <MessageInput 
      channelId={recipientId}  // For DMs, recipient ID can serve as channel ID
      authorId={authorId}
      communityId=""           // Empty for DMs, or global community context
    />
  );
}
```

## Core Features

### Mention Autocomplete System

The component integrates a comprehensive mention system supporting both user and channel mentions:

```typescript
// Mention autocomplete integration
const {
  state: mentionState,
  selectSuggestion,
  getSelectedSuggestion,
  close: closeMentions,
  handleKeyDown: handleMentionKeyDown,
} = useMentionAutocomplete({
  communityId,
  text,
  cursorPosition,
});

// Data fetching for mentions
const { data: memberData = [] } = useGetMembersForCommunityQuery(communityId);
const { data: channelData = [] } = useGetMentionableChannelsQuery(communityId);

// Transform to mention format
const userMentions: UserMention[] = memberData.map((member) => ({
  id: member.user!.id,
  username: member.user!.username,
  displayName: member.user!.displayName || undefined,
}));

const channelMentions: ChannelMention[] = channelData.map((channel) => ({
  id: channel.id,
  name: channel.name,
}));
```

### Rich Text Message Parsing

Messages are parsed into spans for rich text support:

```typescript
import {
  parseMessageWithMentions,
  insertMention,
  UserMention,
  ChannelMention,
} from "../../utils/mentionParser";

const handleSend = useCallback(async () => {
  if (!text.trim()) return;
  setSending(true);

  // Parse text with mentions to create spans
  const spans = parseMessageWithMentions(text, userMentions, channelMentions);

  const msg: NewMessagePayload = {
    channelId,
    authorId,
    spans,
    attachments: [],
    reactions: [],
    sentAt: new Date().toISOString(),
  };

  sendMessage(msg);
  setText("");
  setCursorPosition(0);
  closeMentions();
}, [authorId, channelId, channelMentions, text, userMentions]);
```

### Keyboard Navigation & Shortcuts

```typescript
const handleKeyDown = useCallback(
  (event: React.KeyboardEvent) => {
    // Let mention autocomplete handle its keys first
    if (handleMentionKeyDown(event.nativeEvent)) {
      if (event.key === "Enter" || event.key === "Tab") {
        // Handle mention selection
        const selectedSuggestion = getSelectedSuggestion();
        if (selectedSuggestion) {
          const mentionData = {
            type: selectedSuggestion.type,
            username: selectedSuggestion.type === "user" 
              ? selectedSuggestion.displayName 
              : undefined,
            name: selectedSuggestion.type === "channel" 
              ? selectedSuggestion.displayName 
              : undefined,
          };

          const result = insertMention(text, cursorPosition, mentionData);
          setText(result.newText);

          // Update cursor position after state update
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.setSelectionRange(
                result.newCursorPosition,
                result.newCursorPosition
              );
            }
          }, 0);

          closeMentions();
        }
      }
      return;
    }

    // Handle regular Enter for sending
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  },
  [
    handleMentionKeyDown,
    getSelectedSuggestion,
    handleSend,
    text,
    cursorPosition,
    closeMentions,
  ]
);
```

## Styling & Theming

### Material-UI Integration

```tsx
const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  margin: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: theme.palette.divider,
    },
    '&:hover fieldset': {
      borderColor: theme.palette.text.secondary,
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.palette.primary.main,
    },
  },
}));
```

### Layout & Responsive Design

```tsx
<Box sx={{ width: "100%", position: "relative" }}>
  {/* Mention Dropdown */}
  {mentionState.isOpen && (
    <MentionDropdown
      suggestions={mentionState.suggestions}
      selectedIndex={mentionState.selectedIndex}
      isLoading={mentionState.isLoading}
      onSelectSuggestion={handleMentionSelect}
      position={{ bottom: 80, left: 20 }}
    />
  )}

  <form onSubmit={handleFormSubmit}>
    <StyledPaper sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <StyledTextField
        fullWidth
        size="small"
        variant="outlined"
        placeholder="Type a message... Use @ for members, # for channels"
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onSelect={updateCursorPosition}
        inputRef={inputRef}
        autoComplete="off"
      />
      <IconButton
        color="primary"
        disabled={!text.trim() || sending}
        type="submit"
      >
        {sending ? <CircularProgress size={24} /> : <SendIcon />}
      </IconButton>
    </StyledPaper>
  </form>
</Box>
```

## State Management

### Local Component State

```typescript
const [text, setText] = useState("");                    // Input text content
const [cursorPosition, setCursorPosition] = useState(0); // Cursor position for mentions
const [sending, setSending] = useState(false);           // Send operation state
const inputRef = useRef<HTMLInputElement>(null);         // Input DOM reference
```

### External Integrations

```typescript
// Message sending via WebSocket
const sendMessage = useSendMessageSocket(() => setSending(false));

// Community member data for user mentions
const { data: memberData = [] } = useGetMembersForCommunityQuery(communityId);

// Available channels for channel mentions
const { data: channelData = [] } = useGetMentionableChannelsQuery(communityId);

// Mention autocomplete state management
const mentionAutocomplete = useMentionAutocomplete({
  communityId,
  text,
  cursorPosition,
});
```

## Advanced Features

### Cursor Position Management

```typescript
// Update cursor position when input changes
const updateCursorPosition = useCallback(() => {
  if (inputRef.current) {
    setCursorPosition(inputRef.current.selectionStart || 0);
  }
}, []);

useEffect(() => {
  const input = inputRef.current;
  if (!input) return;

  const handleSelectionChange = () => {
    updateCursorPosition();
  };

  input.addEventListener("selectionchange", handleSelectionChange);
  return () =>
    input.removeEventListener("selectionchange", handleSelectionChange);
}, [updateCursorPosition]);

const handleChange = useCallback(
  (event: React.ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value);
    updateCursorPosition();
  },
  [updateCursorPosition]
);
```

### Mention Insertion Logic

```typescript
const handleMentionSelect = useCallback(
  (index: number) => {
    selectSuggestion(index);
    const selectedSuggestion = mentionState.suggestions[index];
    if (selectedSuggestion) {
      const mentionData = {
        type: selectedSuggestion.type,
        username: selectedSuggestion.type === "user" 
          ? selectedSuggestion.displayName 
          : undefined,
        name: selectedSuggestion.type === "channel" 
          ? selectedSuggestion.displayName 
          : undefined,
      };

      const result = insertMention(text, cursorPosition, mentionData);
      setText(result.newText);

      // Update cursor position after state update
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(
            result.newCursorPosition,
            result.newCursorPosition
          );
        }
      }, 0);

      closeMentions();
    }
  },
  [
    selectSuggestion,
    mentionState.suggestions,
    text,
    cursorPosition,
    closeMentions,
  ]
);
```

### Form Submission & Validation

```typescript
const handleSend = useCallback(async () => {
  if (!text.trim()) return; // Prevent empty messages
  setSending(true);

  // Parse text with mentions to create spans
  const spans = parseMessageWithMentions(text, userMentions, channelMentions);

  const msg: NewMessagePayload = {
    channelId,
    authorId,
    spans,
    attachments: [],
    reactions: [],
    sentAt: new Date().toISOString(),
  };

  sendMessage(msg);
  setText("");
  setCursorPosition(0);
  closeMentions();

  // Fallback timeout if WebSocket doesn't respond
  setTimeout(() => {
    setSending(false);
  }, 2000);
}, [
  authorId,
  channelId,
  channelMentions,
  closeMentions,
  sendMessage,
  text,
  userMentions,
]);
```

## Integration Patterns

### Pattern 1: Channel Message Integration

```tsx
function ChannelWithMentions({ channelId, communityId }: {
  channelId: string;
  communityId: string;
}) {
  const { data: currentUser } = useProfileQuery();
  
  if (!currentUser) return <div>Loading...</div>;

  return (
    <div className="channel-container">
      <div className="messages">
        {/* Messages display */}
      </div>
      <div className="input-area">
        <MessageInput
          channelId={channelId}
          authorId={currentUser.id}
          communityId={communityId}
        />
      </div>
    </div>
  );
}
```

### Pattern 2: Direct Message Integration

```tsx
function DirectMessageInput({ conversationId, recipientId }: {
  conversationId: string;
  recipientId: string;
}) {
  const { data: currentUser } = useProfileQuery();
  
  return (
    <MessageInput
      channelId={conversationId}
      authorId={currentUser?.id || ''}
      communityId="" // DMs don't have community context
    />
  );
}
```

### Pattern 3: Mention-Only Context

```tsx
function MentionEnabledInput({ context }: { context: 'global' | string }) {
  const [inputText, setInputText] = useState('');
  
  // You can extract just the mention logic if needed
  const mentionLogic = useMentionAutocomplete({
    communityId: context === 'global' ? '' : context,
    text: inputText,
    cursorPosition: 0
  });
  
  return (
    <div>
      <input
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder="Type @ to mention users..."
      />
      {mentionLogic.state.isOpen && (
        <MentionDropdown {...mentionLogic.state} />
      )}
    </div>
  );
}
```

## Performance Considerations

### Debouncing & Optimization

```typescript
// The mention autocomplete hook handles debouncing internally
// No additional debouncing needed in the component

// Cursor position updates are optimized with useCallback
const updateCursorPosition = useCallback(() => {
  if (inputRef.current) {
    setCursorPosition(inputRef.current.selectionStart || 0);
  }
}, []);

// Message parsing is optimized for performance
const spans = useMemo(() => {
  if (!text.trim()) return [];
  return parseMessageWithMentions(text, userMentions, channelMentions);
}, [text, userMentions, channelMentions]);
```

### Memory Management

```typescript
// Clean up event listeners
useEffect(() => {
  const input = inputRef.current;
  if (!input) return;

  const handleSelectionChange = () => updateCursorPosition();
  
  input.addEventListener("selectionchange", handleSelectionChange);
  return () => {
    input.removeEventListener("selectionchange", handleSelectionChange);
  };
}, [updateCursorPosition]);

// Clean up mention state when component unmounts
useEffect(() => {
  return () => {
    closeMentions(); // Clean up mention dropdown state
  };
}, [closeMentions]);
```

## Accessibility Support

### Keyboard Navigation

```typescript
// Full keyboard support for mention system
const keyboardShortcuts = {
  'Enter': 'Send message (without Shift) or select mention',
  'Shift+Enter': 'New line in message',
  'Tab': 'Select mention suggestion',
  'Escape': 'Close mention dropdown',
  'ArrowUp/Down': 'Navigate mention suggestions',
  '@': 'Trigger user mention autocomplete',
  '#': 'Trigger channel mention autocomplete'
};
```

### Screen Reader Support

```tsx
<TextField
  aria-label="Message input with mention support"
  aria-describedby="mention-help"
  placeholder="Type a message... Use @ for members, # for channels"
  inputRef={inputRef}
/>

<div id="mention-help" className="sr-only">
  Type @ followed by a username to mention users, or # followed by a channel name to mention channels
</div>
```

### Focus Management

```tsx
useEffect(() => {
  // Focus input when component mounts
  inputRef.current?.focus();
}, []);

// Maintain focus after mention insertion
setTimeout(() => {
  if (inputRef.current) {
    inputRef.current.focus();
    inputRef.current.setSelectionRange(
      result.newCursorPosition,
      result.newCursorPosition
    );
  }
}, 0);
```

## Testing Strategies

### Component Testing

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageInput from './MessageInput';

const mockProps = {
  channelId: 'test-channel',
  authorId: 'test-user',
  communityId: 'test-community'
};

describe('MessageInput', () => {
  it('renders input field with correct placeholder', () => {
    render(<MessageInput {...mockProps} />);
    
    expect(screen.getByPlaceholderText(/Type a message/)).toBeInTheDocument();
  });

  it('triggers mention autocomplete on @ symbol', async () => {
    const user = userEvent.setup();
    render(<MessageInput {...mockProps} />);
    
    const input = screen.getByPlaceholderText(/Type a message/);
    
    await user.type(input, '@joh');
    
    // Should trigger mention dropdown
    await waitFor(() => {
      expect(screen.getByText(/Members/)).toBeInTheDocument();
    });
  });

  it('sends message on Enter key', async () => {
    const user = userEvent.setup();
    const mockSendMessage = jest.fn();
    
    // Mock the WebSocket hook
    jest.mock('@/hooks/useSendMessageSocket', () => ({
      useSendMessageSocket: () => mockSendMessage
    }));
    
    render(<MessageInput {...mockProps} />);
    
    const input = screen.getByPlaceholderText(/Type a message/);
    
    await user.type(input, 'Test message{enter}');
    
    expect(mockSendMessage).toHaveBeenCalled();
  });

  it('maintains cursor position during mention insertion', async () => {
    const user = userEvent.setup();
    render(<MessageInput {...mockProps} />);
    
    const input = screen.getByPlaceholderText(/Type a message/) as HTMLInputElement;
    
    await user.type(input, 'Hello @joh');
    
    // Simulate mention selection
    // Should update text and maintain proper cursor position
  });
});
```

### Integration Testing

```tsx
describe('MessageInput Integration', () => {
  it('integrates with mention autocomplete system', async () => {
    // Test complete mention flow from typing to selection to message sending
    const user = userEvent.setup();
    render(<MessageInputWithProviders {...mockProps} />);
    
    const input = screen.getByPlaceholderText(/Type a message/);
    
    // Type to trigger mention
    await user.type(input, '@john');
    
    // Wait for suggestions to appear
    await waitFor(() => {
      expect(screen.getByText('john_doe')).toBeInTheDocument();
    });
    
    // Select mention
    await user.click(screen.getByText('john_doe'));
    
    // Verify mention was inserted
    expect(input.value).toContain('@john_doe');
    
    // Send message
    await user.keyboard('{enter}');
    
    // Verify message was sent with proper spans
  });
});
```

## Troubleshooting

### Common Issues

1. **Mention dropdown not appearing**
   - **Cause:** Missing `position: relative` on parent container
   - **Solution:** Ensure parent container has relative positioning

2. **Cursor position incorrect after mention insertion**
   - **Cause:** React state updates are asynchronous
   - **Solution:** Use `setTimeout` for cursor positioning after state updates

3. **Messages not sending**
   - **Cause:** WebSocket connection issue or invalid message format
   - **Solution:** Check WebSocket connection and validate message payload

4. **Mention parsing errors**
   - **Cause:** Invalid mention data or parsing logic
   - **Solution:** Verify `parseMessageWithMentions` function and input data

### Debug Utilities

```typescript
// Debug mode for development
const DEBUG_MENTIONS = process.env.NODE_ENV === 'development';

if (DEBUG_MENTIONS) {
  console.log('MessageInput Debug:', {
    text,
    cursorPosition,
    mentionState,
    userMentions: userMentions.length,
    channelMentions: channelMentions.length
  });
}
```

## Recent Changes

- **Current:** Full mention autocomplete with user and channel support
- **Added:** Rich text parsing with span-based message structure
- **Added:** Comprehensive keyboard navigation and shortcuts
- **Added:** Real-time cursor position tracking for mention insertion

## Future Enhancements

- **File Upload:** Drag & drop file attachment support
- **Emoji Picker:** Integrated emoji selection interface
- **Message Threading:** Reply and thread functionality
- **Voice Messages:** Audio recording and playback
- **Rich Text Editor:** WYSIWYG editing with formatting options

## Related Documentation

- [MentionDropdown Component](./MentionDropdown.md)
- [MessageComponent](./MessageComponent.md)
- [useMentionAutocomplete Hook](../../hooks/useMentionAutocomplete.md)
- [mentionParser Utilities](../../utils/mentionParser.md)
- [useSendMessageSocket Hook](../../hooks/useSendMessageSocket.md)
- [Mention System Overview](../../features/mention-system.md)