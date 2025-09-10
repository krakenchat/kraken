# MessageReactions Component

## Overview

`MessageReactions` is a React component that displays emoji reactions on messages with Discord-like styling and behavior. It handles reaction display, user interaction, and provides hover tooltips showing which users reacted. The component supports both adding and removing reactions with visual feedback.

## Component Details

**Location**: `frontend/src/components/Message/MessageReactions.tsx`

**Type**: Functional Component with React hooks

**Purpose**: Display and manage emoji reactions on messages with interactive UI

## Props

```typescript
interface MessageReactionsProps {
  messageId: string;                           // Target message ID for reactions
  reactions: Reaction[];                       // Array of reaction objects
  onReactionClick: (emoji: string) => void;   // Callback when reaction is clicked
}
```

### Prop Details

- **`messageId`** (string, required)
  - MongoDB ObjectId of the message being reacted to
  - Used for tooltip and tracking purposes
  - Passed to nested components for context

- **`reactions`** (Reaction[], required)
  - Array of reaction objects containing emoji and user lists
  - Each reaction has emoji string and userIds array
  - Empty array renders nothing (component returns null)

- **`onReactionClick`** (function, required)
  - Callback invoked when user clicks on a reaction
  - Receives the emoji string as parameter
  - Handles both adding and removing reactions

### Reaction Type Structure

```typescript
interface Reaction {
  emoji: string;      // Unicode emoji (e.g., "👍", "❤️", "😄")
  userIds: string[];  // Array of user IDs who reacted with this emoji
}
```

## Component Architecture

### Nested Component Structure

```
MessageReactions (main component)
├── SingleReactionChip (individual reaction display)
│   └── ReactionTooltip (hover tooltip with user info)
│       └── Chip (Material-UI base component)
```

### SingleReactionChip Component

```typescript
const SingleReactionChip: React.FC<{ 
  reaction: Reaction; 
  userHasReacted: boolean; 
  onReactionClick: (emoji: string) => void 
}> = ({ reaction, userHasReacted, onReactionClick }) => {
  const count = reaction.userIds.length;
  
  return (
    <ReactionTooltip userIds={reaction.userIds}>
      <Chip
        label={`${reaction.emoji} ${count}`}
        size="small"
        variant="filled"
        onClick={() => onReactionClick(reaction.emoji)}
        sx={{
          height: '26px',
          fontSize: '13px',
          fontWeight: 500,
          cursor: 'pointer',
          backgroundColor: userHasReacted 
            ? 'rgba(88, 101, 242, 0.15)' // Discord-like blue
            : 'rgba(255, 255, 255, 0.08)', // Subtle background
          color: userHasReacted 
            ? 'rgb(88, 101, 242)' // Discord blue
            : 'text.primary',
          border: userHasReacted 
            ? '1px solid rgba(88, 101, 242, 0.3)'
            : '1px solid rgba(255, 255, 255, 0.15)',
          // ... additional styling
        }}
      />
    </ReactionTooltip>
  );
};
```

### Main Component Logic

```typescript
export const MessageReactions: React.FC<MessageReactionsProps> = ({ 
  reactions, 
  onReactionClick 
}) => {
  const { data: currentUser } = useProfileQuery();

  if (reactions.length === 0) return null;

  return (
    <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
      {reactions.map((reaction) => {
        const userHasReacted = currentUser ? reaction.userIds.includes(currentUser.id) : false;

        return (
          <SingleReactionChip
            key={reaction.emoji}
            reaction={reaction}
            userHasReacted={userHasReacted}
            onReactionClick={onReactionClick}
          />
        );
      })}
    </Box>
  );
};
```

## Visual Design Features

### Discord-Style Styling

The component implements Discord-like visual design with:

#### Color Scheme

```typescript
// User has reacted (active state)
backgroundColor: 'rgba(88, 101, 242, 0.15)'  // Light blue background
color: 'rgb(88, 101, 242)'                   // Discord blue text
border: '1px solid rgba(88, 101, 242, 0.3)' // Blue border

// User has not reacted (inactive state)
backgroundColor: 'rgba(255, 255, 255, 0.08)' // Subtle background
color: 'text.primary'                         // Default text color
border: '1px solid rgba(255, 255, 255, 0.15)' // Subtle border
```

#### Interactive Effects

```typescript
'&:hover': {
  backgroundColor: userHasReacted 
    ? 'rgba(88, 101, 242, 0.25)'     // Darker blue on hover
    : 'rgba(255, 255, 255, 0.12)',   // Slightly visible on hover
  borderColor: userHasReacted 
    ? 'rgba(88, 101, 242, 0.5)'      // Stronger blue border
    : 'rgba(255, 255, 255, 0.25)',   // More visible border
  transform: 'scale(1.05)',           // Slight grow effect
},
'&:active': {
  transform: 'scale(0.95)',           // Slight shrink on click
},
```

#### Typography and Sizing

```typescript
sx={{
  height: '26px',           // Consistent height
  fontSize: '13px',         // Readable small text
  fontWeight: userHasReacted ? 600 : 500,  // Bold when user reacted
  borderRadius: '12px',     // Rounded corners
  transition: 'all 0.15s ease',  // Smooth animations
  '& .MuiChip-label': {
    padding: '0 8px',       // Internal padding
    fontSize: '13px',       // Consistent text size
  }
}}
```

## User Experience Features

### Reaction State Detection

```typescript
const userHasReacted = currentUser ? reaction.userIds.includes(currentUser.id) : false;
```

**Logic:**
- Checks if current user's ID is in the reaction's userIds array
- Handles case where currentUser is null/undefined
- Used for visual state and interaction feedback

### Visual Feedback

1. **Active State**: User's reactions highlighted with Discord blue
2. **Hover Effects**: Scale and color changes on mouse over
3. **Click Animation**: Brief scale-down effect on interaction
4. **Count Display**: Shows emoji + count (e.g., "👍 5")

### Tooltip Integration

```typescript
<ReactionTooltip userIds={reaction.userIds}>
  <Chip {...chipProps} />
</ReactionTooltip>
```

- **User Information**: Shows who reacted when hovering
- **Rich Display**: Includes usernames and avatars
- **Contextual**: Appears only when needed (hover)

## Integration Points

### Parent Component Integration

Typically used within message components:

```typescript
// Inside MessageComponent
<MessageReactions
  messageId={message.id}
  reactions={message.reactions}
  onReactionClick={(emoji) => handleReactionClick(message.id, emoji)}
/>
```

### API Integration

The `onReactionClick` callback typically:

```typescript
const handleReactionClick = async (messageId: string, emoji: string) => {
  const userHasReacted = message.reactions
    .find(r => r.emoji === emoji)?.userIds
    .includes(currentUser.id);

  if (userHasReacted) {
    // Remove reaction
    await removeReaction({ messageId, emoji }).unwrap();
  } else {
    // Add reaction  
    await addReaction({ messageId, emoji }).unwrap();
  }
};
```

### Real-time Updates

Component updates automatically via:
- **WebSocket Events**: `REACTION_ADDED`, `REACTION_REMOVED`
- **RTK Query Cache**: Optimistic updates and cache invalidation
- **State Synchronization**: Multiple clients see reactions immediately

## Performance Optimizations

### Efficient Rendering

```typescript
// Early return for empty reactions
if (reactions.length === 0) return null;

// Memoized user check per reaction
const userHasReacted = currentUser ? reaction.userIds.includes(currentUser.id) : false;
```

### Layout Optimization

```typescript
<Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
  {/* Reactions wrap to new lines as needed */}
</Box>
```

**Features:**
- **Flex Layout**: Reactions arranged horizontally with wrapping
- **Consistent Spacing**: Gap between reaction chips
- **Responsive**: Adapts to container width
- **No Overflow**: Wraps to new lines when needed

## Accessibility Features

### Keyboard Navigation

- **Tab Order**: Chips are focusable in natural order
- **Enter/Space**: Activate reactions via keyboard
- **Screen Readers**: Proper labels and descriptions

### ARIA Support

```typescript
// Material-UI Chip provides built-in ARIA support
<Chip
  label={`${reaction.emoji} ${count}`}
  aria-label={`React with ${reaction.emoji}, ${count} users reacted`}
  role="button"
  tabIndex={0}
/>
```

## Usage Examples

### Basic Usage in Message Component

```typescript
import { MessageReactions } from '@/components/Message/MessageReactions';

function MessageComponent({ message }: { message: Message }) {
  const [addReaction] = useAddReactionMutation();
  const [removeReaction] = useRemoveReactionMutation();
  const { data: currentUser } = useProfileQuery();

  const handleReactionClick = async (emoji: string) => {
    const existingReaction = message.reactions.find(r => r.emoji === emoji);
    const userHasReacted = existingReaction?.userIds.includes(currentUser?.id || '') || false;

    try {
      if (userHasReacted) {
        await removeReaction({ messageId: message.id, emoji }).unwrap();
      } else {
        await addReaction({ messageId: message.id, emoji }).unwrap();
      }
    } catch (error) {
      console.error('Failed to update reaction:', error);
    }
  };

  return (
    <div className="message">
      <div className="message-content">
        {/* Message content */}
      </div>
      
      {message.reactions.length > 0 && (
        <MessageReactions
          messageId={message.id}
          reactions={message.reactions}
          onReactionClick={handleReactionClick}
        />
      )}
    </div>
  );
}
```

### With Custom Reaction Handling

```typescript
function EnhancedMessageReactions({ message }: { message: Message }) {
  const [addReaction] = useAddReactionMutation();
  const [removeReaction] = useRemoveReactionMutation();
  
  const handleReactionClick = async (emoji: string) => {
    // Custom logic for reaction handling
    if (await confirmReaction(emoji)) {
      const userHasReacted = checkUserReaction(message, emoji);
      
      if (userHasReacted) {
        await removeReaction({ messageId: message.id, emoji });
        trackReactionRemoved(message.id, emoji);
      } else {
        await addReaction({ messageId: message.id, emoji });
        trackReactionAdded(message.id, emoji);
      }
    }
  };

  return (
    <MessageReactions
      messageId={message.id}
      reactions={message.reactions}
      onReactionClick={handleReactionClick}
    />
  );
}
```

### Conditional Rendering

```typescript
function ConditionalMessageReactions({ message, showReactions }: Props) {
  if (!showReactions || message.reactions.length === 0) {
    return null;
  }

  return (
    <MessageReactions
      messageId={message.id}
      reactions={message.reactions}
      onReactionClick={handleReactionClick}
    />
  );
}
```

## Testing

### Unit Testing

**Test File**: `MessageReactions.test.tsx`

**Test Coverage:**
- Reaction display with various emoji
- User reaction state detection
- Click handling and callbacks
- Empty state handling
- Visual styling and theme compliance

**Example Tests:**
```typescript
describe('MessageReactions', () => {
  it('renders reactions with correct counts', () => {
    const reactions = [
      { emoji: '👍', userIds: ['user1', 'user2'] },
      { emoji: '❤️', userIds: ['user1'] }
    ];
    
    render(
      <MessageReactions
        messageId="msg1"
        reactions={reactions}
        onReactionClick={jest.fn()}
      />
    );
    
    expect(screen.getByText('👍 2')).toBeInTheDocument();
    expect(screen.getByText('❤️ 1')).toBeInTheDocument();
  });

  it('highlights reactions from current user', () => {
    // Mock current user
    jest.mocked(useProfileQuery).mockReturnValue({
      data: { id: 'current-user' }
    });
    
    const reactions = [
      { emoji: '👍', userIds: ['current-user', 'other-user'] }
    ];
    
    const { container } = render(
      <MessageReactions
        messageId="msg1"
        reactions={reactions}
        onReactionClick={jest.fn()}
      />
    );
    
    // Check for active state styling
    const reactionChip = container.querySelector('.MuiChip-root');
    expect(reactionChip).toHaveStyle({
      backgroundColor: 'rgba(88, 101, 242, 0.15)'
    });
  });

  it('calls onReactionClick with correct emoji', () => {
    const mockOnClick = jest.fn();
    const reactions = [
      { emoji: '👍', userIds: ['user1'] }
    ];
    
    render(
      <MessageReactions
        messageId="msg1"
        reactions={reactions}
        onReactionClick={mockOnClick}
      />
    );
    
    fireEvent.click(screen.getByText('👍 1'));
    expect(mockOnClick).toHaveBeenCalledWith('👍');
  });

  it('returns null for empty reactions', () => {
    const { container } = render(
      <MessageReactions
        messageId="msg1"
        reactions={[]}
        onReactionClick={jest.fn()}
      />
    );
    
    expect(container.firstChild).toBeNull();
  });
});
```

### Integration Testing

- **Real-time Reaction Updates**: Test WebSocket reaction events
- **Multi-user Interactions**: Test reactions from multiple users
- **API Integration**: Test with actual reaction API calls

## Related Components

### Direct Dependencies

- **`ReactionTooltip`**: Shows user information on hover
- **`useProfileQuery`**: Gets current user for reaction state
- **Material-UI Chip**: Base component for reaction display
- **Material-UI Box**: Container layout component

### Related Message Components

- **`MessageComponent`**: Parent component that renders reactions
- **`MessageInput`**: May include reaction picker (future feature)
- **`EmojiPicker`**: Potential integration for adding reactions

### WebSocket Integration

- **`useChannelWebSocket`**: Handles real-time reaction events for channels
- **`useDirectMessageWebSocket`**: Handles real-time reaction events for DMs
- **RTK Query mutations**: `useAddReactionMutation`, `useRemoveReactionMutation`

---

## Design System Integration

### Theme Compliance

- **Color Palette**: Uses Discord-inspired colors with theme integration
- **Typography**: Consistent with app typography system
- **Spacing**: Uses Material-UI spacing system
- **Shadows**: Subtle elevation for interactive elements

### Responsive Design

- **Mobile Friendly**: Touch targets are appropriately sized
- **Flexible Layout**: Wraps reactions across multiple lines
- **Consistent Sizing**: Works across different screen sizes

This component provides a polished, Discord-like reaction experience that enhances message interactivity while maintaining consistency with Kraken's overall design system and real-time architecture.