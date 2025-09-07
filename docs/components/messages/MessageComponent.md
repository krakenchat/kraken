# MessageComponent

> **Location:** `frontend/src/components/Message/MessageComponent.tsx`  
> **Type:** Message Display Component  
> **Feature:** messages

## Overview

The MessageComponent renders individual chat messages with rich text support through spans, user mentions, inline editing capabilities, and delete functionality. It features animated transitions for editing and deletion states, hover-based message tools, and comprehensive styling for different mention types.

## Props Interface

```typescript
interface MessageProps {
  message: MessageType;  // Complete message object with spans, author, timestamps
}

// MessageType includes:
interface Message {
  id: string;
  authorId: string;
  channelId?: string;
  spans: Span[];
  sentAt: string;
  editedAt?: string;
  // ... other message properties
}
```

## Usage Examples

### Basic Usage
```tsx
import MessageComponent from '@/components/Message/MessageComponent';

function MessageList({ messages }) {
  return (
    <Box>
      {messages.map(message => (
        <MessageComponent key={message.id} message={message} />
      ))}
    </Box>
  );
}
```

### Integration with Channel Messages
```tsx
// ChannelMessageContainer.tsx usage
function ChannelMessageContainer() {
  const { data: messages } = useGetMessagesQuery(channelId);
  
  return (
    <Box sx={{ flex: 1, overflow: 'auto' }}>
      {messages?.map(message => (
        <MessageComponent key={message.id} message={message} />
      ))}
    </Box>
  );
}
```

## Styling & Theming

- **Material-UI Components Used:**
  - `Avatar` (user profile picture)
  - `Typography` (message text and metadata)
  - `IconButton` (edit/delete actions)
  - `Box` (layout container)
  - `TextField` (edit input)
- **Material-UI Icons:** `Edit`, `Delete`, `Check`, `Cancel`
- **Styled Components:** Custom Container and MessageTools with complex animations
- **Theme Integration:** Uses theme spacing, colors, shadows, and breakpoints

```tsx
// Key styled components
const Container = styled("div")<{ stagedForDelete?: boolean; isDeleting?: boolean }>(
  ({ theme, stagedForDelete, isDeleting }) => ({
    padding: theme.spacing(0.5, 2),
    display: "flex",
    alignItems: "flex-start",
    backgroundColor: "transparent",
    border: stagedForDelete ? `2px solid ${theme.palette.error.main}` : "2px solid transparent",
    transition: isDeleting ? "all 0.3s ease-out" : "all 0.2s ease-in-out",
    opacity: isDeleting ? 0 : 1,
    transform: isDeleting ? "translateY(-10px) scale(0.98)" : "translateY(0) scale(1)",
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
      "& .message-tools": { opacity: 1 },
    },
  })
);

const MessageTools = styled(Box)<{ stagedForDelete?: boolean }>(
  ({ theme, stagedForDelete }) => ({
    position: "absolute",
    right: theme.spacing(1),
    top: theme.spacing(0.5),
    opacity: stagedForDelete ? 1 : 0,
    transition: "opacity 0.2s ease-in-out",
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[2],
  })
);
```

## State Management

- **Local State:**
  - `isEditing` (boolean) - controls edit mode
  - `editText` (string) - stores edit input value
  - `stagedForDelete` (boolean) - controls delete confirmation state
  - `isDeleting` (boolean) - controls delete animation
- **Redux Integration:**
  - `useGetUserByIdWithCacheQuery` - fetches message author data
  - `useProfileQuery` - gets current user for ownership checking
  - `useUpdateMessageMutation` - handles message editing
  - `useDeleteMessageMutation` - handles message deletion
- **Real-time Updates:** Messages updated via WebSocket events

## Dependencies

### Internal Dependencies
- `@/types/message.type` - Message and Span type definitions
- `@/features/users/usersSlice` - user data fetching
- `@/features/messages/messagesApiSlice` - message operations

### External Dependencies
- `@mui/material` - UI components and styling
- `@mui/icons-material` - action icons
- `react` (useState) - local state management

## Related Components

- **Parent Components:** ChannelMessageContainer, MessageList
- **Child Components:** None (leaf component)
- **Related Components:** MessageInput (message creation), MessageSkeleton (loading state)

## Common Patterns

### Pattern 1: Rich Text Rendering with Spans
```typescript
function renderSpan(span: Span, idx: number) {
  switch (span.type) {
    case SpanType.USER_MENTION:
      return (
        <span key={idx} style={{ color: "#1976d2", fontWeight: 600 }}>
          {span.text || span.userId}
        </span>
      );
    case SpanType.CHANNEL_MENTION:
      return (
        <span key={idx} style={{ color: "#7b1fa2", fontWeight: 600 }}>
          {span.text || span.channelId}
        </span>
      );
    case SpanType.PLAINTEXT:
    default:
      return <span key={idx}>{span.text}</span>;
  }
}

// Usage in render
<Typography variant="body1">
  {message.spans.map((span, idx) => renderSpan(span, idx))}
</Typography>
```

### Pattern 2: Inline Editing with Keyboard Support
```tsx
const handleEditClick = () => {
  const textSpan = message.spans.find(span => span.type === SpanType.PLAINTEXT);
  setEditText(textSpan?.text || "");
  setIsEditing(true);
};

// Edit input with keyboard shortcuts
<TextField
  value={editText}
  onChange={(e) => setEditText(e.target.value)}
  autoFocus
  onKeyDown={(e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEditSave();
    } else if (e.key === "Escape") {
      handleEditCancel();
    }
  }}
/>
```

### Pattern 3: Animated Delete Confirmation
```tsx
const handleDeleteClick = () => {
  setStagedForDelete(true);
};

const handleConfirmDelete = async () => {
  setIsDeleting(true);
  
  // Wait for animation before API call
  setTimeout(async () => {
    try {
      await deleteMessage({ id: message.id, channelId: message.channelId }).unwrap();
    } catch (error) {
      setIsDeleting(false);
      setStagedForDelete(false);
    }
  }, 300); // Match animation duration
};
```

### Pattern 4: Hover-based Message Tools
```tsx
// Tools only visible on hover or when staged for delete
<MessageTools className="message-tools" stagedForDelete={stagedForDelete}>
  {stagedForDelete ? (
    <>
      <Typography>Delete?</Typography>
      <IconButton onClick={handleConfirmDelete} color="error">
        <CheckIcon />
      </IconButton>
      <IconButton onClick={handleCancelDelete}>
        <CancelIcon />
      </IconButton>
    </>
  ) : (
    <>
      <IconButton onClick={handleEditClick}>
        <EditIcon />
      </IconButton>
      <IconButton onClick={handleDeleteClick} color="error">
        <DeleteIcon />
      </IconButton>
    </>
  )}
</MessageTools>
```

## Testing

- **Test Location:** Not currently implemented
- **Key Test Cases:**
  - Message renders with correct author and content
  - Mentions display with proper styling
  - Edit mode toggles correctly for own messages
  - Delete confirmation flow works properly
  - Keyboard shortcuts function in edit mode
  - Animations play during deletion
  - Tools only show for message author

```tsx
// Example test patterns
test('should render message with author avatar and content', () => {
  // Render with mock message data
  // Assert avatar, author name, content, timestamp are displayed
});

test('should show edit tools only for own messages', () => {
  // Mock current user matching message author
  // Render and hover over message
  // Assert edit/delete buttons are visible
});

test('should handle inline editing with keyboard shortcuts', () => {
  // Start edit mode
  // Type new content
  // Press Enter
  // Assert updateMessage mutation called
});
```

## Accessibility

- **ARIA Labels:** 
  - Avatar has proper alt text from author name
  - IconButtons have implicit labels from MUI
- **Keyboard Navigation:**
  - Edit input supports Enter/Escape shortcuts
  - All interactive elements keyboard accessible
- **Screen Reader Support:**
  - Semantic heading structure for author names
  - Clear message content with proper timestamps

## Performance Considerations

- **User Data Caching:** Uses cached user queries to avoid redundant API calls
- **Memoization:** None implemented (could benefit from React.memo)
- **Animation Performance:** CSS transitions optimized for GPU acceleration
- **Bundle Size:** Rich component with multiple dependencies

## Rich Text Support

### Span Types and Styling
- **USER_MENTION** - Blue color (`#1976d2`) with bold weight, no @ prefix in display
- **SPECIAL_MENTION** - Green color (`#388e3c`) for @everyone, @here
- **CHANNEL_MENTION** - Purple color (`#7b1fa2`) with bold weight, no # prefix in display
- **COMMUNITY_MENTION** - Light blue color (`#0288d1`)
- **ALIAS_MENTION** - Yellow color (`#fbc02d`) for role mentions
- **PLAINTEXT** - Default styling for regular text

### Mention Rendering
- **Clean Display:** Mention text is displayed without @ or # prefixes for cleaner appearance
- **Fallback Logic:** Displays mention text if available, falls back to ID
- **Interactive Design:** Preserves mention functionality for clickable interactions (future feature)
- **Consistent Styling:** All mention types follow consistent color and weight patterns
- **Semantic Accuracy:** The `span.text` field contains the complete mention including prefixes when needed

## Message Operations

### Edit Functionality
- Only available for message author
- Preserves original message structure with spans
- Updates `editedAt` timestamp on successful edit
- Shows "(edited)" indicator after author name

### Delete Functionality
- Two-step confirmation process (stage → confirm)
- Smooth animation during deletion process
- Immediate UI feedback with staged styling
- Error handling restores original state on failure

## Troubleshooting

### Common Issues
1. **Author information not displaying**
   - **Cause:** User cache miss or invalid authorId
   - **Solution:** Verify user exists and cache is populated

2. **Edit mode not working**
   - **Cause:** Message spans don't contain PLAINTEXT type
   - **Solution:** Ensure message has editable text span

3. **Mentions not rendering correctly**
   - **Cause:** Invalid span data or missing mention text
   - **Solution:** Verify span structure matches expected format

4. **Delete animation stuttering**
   - **Cause:** CSS conflicts or theme timing issues
   - **Solution:** Check theme transition values and CSS specificity

## Recent Changes

- **Current:** Full message display with editing, deletion, and rich text support
- **Needs:** Reaction support, reply threading, better mobile responsive design

## Related Documentation

- [MessageInput](./MessageInput.md)
- [Messages API](../../api/messages.md)
- [Mentions System](../../features/mentions-system.md)
- [Message Types](../../types/message.md)